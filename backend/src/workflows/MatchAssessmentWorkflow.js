/**
 * @module MatchAssessmentWorkflow
 * @description Domain Workflow for generating match reports between source and target entities.
 *
 * @responsibility
 * - Orchestrates the match assessment process using deterministic criteria matching.
 * - Validates criteria preconditions and generates detailed JSON match reports for frontend rendering.
 * - Coordinates with FileService, CriteriaManagerWorkflow, LogService, and EventService.
 *
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (FileService) and Domain Services/Workflows.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT write SQL queries (use Repositories).
 * - ❌ MUST NOT perform AI-based text analysis - relies on extracted criteria.
 * - ❌ MUST NOT contain matching logic - delegates to CriteriaManagerWorkflow.
 *
 * @socexplanation
 * - This workflow orchestrates domain logic and infrastructure I/O without performing calculations itself.
 * - The CriteriaManagerWorkflow handles the complex semantic matching logic.
 * - This workflow saves structured JSON data for the frontend to render dynamically,
 *   rather than generating static Markdown. This delegates presentation logic to React.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const aiReportGenerator = require('../utils/AiReportGenerator');
const { processAiTasks } = require('../utils/asyncHandler');
const { LOG_LEVELS, LOG_SYMBOLS, SETTING_KEYS, DOCUMENT_TYPES, ENTITY_STATUS } = require('../config/constants');
const path = require('path');

class MatchAssessmentWorkflow {

    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.entityService - The EntityService instance
     * @param {Object} deps.matchService - The MatchService instance
     * @param {Object} deps.fileService - The FileService instance
     * @param {Object} deps.settingsManager - The SettingsManager instance
     * @param {Object} deps.aiService - The AiService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.criteriaManagerWorkflow - The CriteriaManagerWorkflow instance
     * @param {Object} deps.matchRepo - The MatchRepo instance
     * @param {Object} deps.dimensionRepo - The DimensionRepo instance
     * @param {Object} deps.promptBuilder - The PromptBuilder instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ entityService, matchService, fileService, settingsManager, aiService, logService, criteriaManagerWorkflow, matchRepo, dimensionRepo, promptBuilder }) {
        this._entityService = entityService;
        this._matchService = matchService;
        this._fileService = fileService;
        this._settingsManager = settingsManager;
        this._aiService = aiService;
        this._logService = logService;
        this._criteriaManagerWorkflow = criteriaManagerWorkflow;
        this._matchRepo = matchRepo;
        this._dimensionRepo = dimensionRepo;
        this._promptBuilder = promptBuilder;
    }

    /**
     * Assesses a match between source and target entities using deterministic criteria matching.
     * Generates structured JSON report data for frontend rendering.
     * 
     * Uses a Map-Reduce architecture for AI summary generation:
     * - MAP PHASE: Generate dimensional summaries concurrently via Promise.all.
     * - REDUCE PHASE: Synthesize dimensional summaries into a single executive summary.
     * This sequential staging ensures the executive summary has access to all dimensional outputs.
     * 
     * @async
     * @method assessMatch
     * @memberof MatchAssessmentWorkflow
     * @param {number} sourceEntityId - The source entity ID.
     * @param {number} targetEntityId - The target entity ID.
     * @param {number} matchId - The match record ID.
     * @returns {Promise<void>} Resolves when assessment is complete.
     * @throws {Error} If match not found, criteria missing, or file operations fail.
     */
    async assessMatch(sourceEntityId, targetEntityId, matchId) {
        const startTime = Date.now();

        if (!matchId) {
            throw new Error("matchId is required for assessment workflow");
        }

        const match = this._matchRepo.getMatchById(matchId);
        if (!match) {
            const error = new Error(`Match not found: ${matchId}`);
            error.isFatalClientError = true;
            throw error;
        }

        let matchFolderPath = match.folder_path;
        if (!matchFolderPath) {
            matchFolderPath = this._fileService.prepareStagingDirectory(`match-${sourceEntityId}-${targetEntityId}`);
            this._matchService.updateFolderPath(matchId, matchFolderPath);
        }

        const sourceEntity = this._entityService.getEntityById(sourceEntityId);
        const targetEntity = this._entityService.getEntityById(targetEntityId);

        if (!sourceEntity || !targetEntity) {
            const error = new Error(`Source or target entity not found for match assessment.`);
            error.isFatalClientError = true;
            throw error;
        }

        try {
            this._logService.addActivityLog({
                entityType: 'Match',
                entityId: matchId,
                logType: LOG_LEVELS.INFO,
                message: `Started match assessment for source ${sourceEntityId} against target ${targetEntityId}.`,
                folderPath: matchFolderPath
            });

            // 0. Reset processing timer for frontend UI counter
            this._matchService.updateMetadata(matchId, { processingStartedAt: new Date().toISOString() });

            // 1. Calculate vector match data
            this._matchService.updateState(matchId, { status: ENTITY_STATUS.CALCULATING_MATCH_SCORES });
            const matchData = this._criteriaManagerWorkflow.calculateCriteriaMatch(sourceEntityId, targetEntityId);

            // 2. Generate AI Summaries
            this._matchService.updateState(matchId, { status: ENTITY_STATUS.GENERATING_MATCH_SUMMARY });
            const dimensionalSummaries = await this._generateDimensionalSummaries(matchData, matchFolderPath);
            const executiveSummary = await this._generateExecutiveSummary(dimensionalSummaries, sourceEntity, targetEntity, matchFolderPath);
            const aiSummaries = { dimensional: dimensionalSummaries, executive: executiveSummary };

            // 3. Build & Save Report
            this._matchService.updateState(matchId, { status: ENTITY_STATUS.GENERATING_MATCH_REPORT });
            const finalReport = this._buildFinalReport(matchData, aiSummaries, sourceEntity, targetEntity);
            const reportPath = this._saveAndRegisterReport(matchId, finalReport, matchFolderPath);

            // 4. Update DB State
            this._matchService.updateMatchScore(matchId, matchData.score);
            this._matchService.updateReportPath(matchId, reportPath);
            this._matchService.updateState(matchId, { error: null });

            // 5. Move to Vault
            this._matchService.updateState(matchId, { status: ENTITY_STATUS.MOVING_TO_VAULT });
            
            const reqLine1 = sourceEntity.niceNameLine1 || sourceEntity.nicename || 'Unknown Requirement';
            const offLine1 = targetEntity.niceNameLine1 || targetEntity.nicename || 'Unknown Offering';
            
            const finalFolderPath = this._fileService.finalizeWorkspace({
                entityType: 'match',
                line1: reqLine1,
                line2: offLine1,
                currentStagingPath: matchFolderPath
            });
            this._matchService.updateFolderPath(matchId, finalFolderPath);
            matchFolderPath = finalFolderPath; // Update local variable so the final log writes to the correct path

            // 5.5 Generate dynamic master document named after the folder
            const finalFolderName = require('path').basename(finalFolderPath);
            const finalFileName = `${finalFolderName}.md`;

            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            const deeplink = `${baseUrl}/matches?matchId=${matchId}`;
            
            const mdContent = `# ${finalFolderName}\n\n**[View Match in Compari](${deeplink})**\n\n${aiSummaries.executive}`;
            this._fileService.saveTextFile(finalFolderPath, finalFileName, mdContent);

            this._matchService.registerDocumentRecord({
                matchId,
                docType: DOCUMENT_TYPES.MATCH_REPORT,
                fileName: finalFileName
            });

            this._matchService.updateMasterFile(matchId, finalFileName);

            // 6. Complete
            this._matchService.updateState(matchId, { status: ENTITY_STATUS.COMPLETED });

            const durationMs = Date.now() - startTime;
            const durationStr = this._logService.formatDuration(durationMs);

            this._logService.addActivityLog({
                entityType: 'Match',
                entityId: matchId,
                logType: LOG_LEVELS.INFO,
                message: `Match assessment complete. Single JSON report generated. Score: ${matchData.score}%. Processing took ${durationStr}.`,
                folderPath: matchFolderPath
            });
        } catch (error) {
            this._matchService.updateState(matchId, { status: ENTITY_STATUS.FAILED, error: error.message });

            this._logService.logTerminal({ 
                status: LOG_LEVELS.ERROR, 
                symbolKey: LOG_SYMBOLS.ERROR, 
                origin: 'MatchAssessmentWorkflow', 
                message: `Match assessment failed: ${error.message}`,
                errorObj: error
            });

            this._logService.logErrorFile({
                origin: 'MatchAssessmentWorkflow',
                message: `Match assessment failed for match ${matchId}`,
                errorObj: error,
                details: { matchFolderPath }
            });

            throw error;
        }
    }

    /**
     * @private
     * Generates dimensional AI summaries concurrently using processAiTasks.
     * @param {Object} matchData - The match data from criteria matching.
     * @param {string} matchFolderPath - The match folder path for logging.
     * @returns {Promise<Object>} Dimensional summaries object.
     */
    async _generateDimensionalSummaries(matchData, matchFolderPath) {
        this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.LIGHTNING, origin: 'MatchAssessmentWorkflow', message: `Generating dimensional AI summaries...` });

        const dimensionalAiReports = aiReportGenerator.generateDimensionalAiReports(matchData.rawComparison);
        const dimensionalSummaries = {};
        const dimensionalTasks = [];

        for (const [dimension, reportData] of Object.entries(dimensionalAiReports)) {
            dimensionalTasks.push(async () => {
                const messages = this._promptBuilder.buildMatchSummaryMessages(reportData);
                const { content } = await this._aiService.generateChatResponse(messages, { logFolderPath: matchFolderPath, logAction: `Generated dimensional AI summary for ${dimension}.` });
                dimensionalSummaries[dimension] = content;
            });
        }

        const allowConcurrent = this._settingsManager.get(SETTING_KEYS.ALLOW_CONCURRENT_AI) === 'true';

        await processAiTasks(
            dimensionalTasks,
            async (task) => {
                return await task();
            },
            allowConcurrent
        );

        return dimensionalSummaries;
    }

    /**
     * @private
     * @socexplanation REDUCE PHASE of the atomized AI pipeline. Synthesizes dimensional summaries into a single executive summary.
     * This method is isolated from infrastructure logic - it only transforms AI output without side effects.
     * @param {Object} dimensionalSummaries - The dimensional summaries from AI (MAP PHASE output).
     * @param {Object} sourceEntity - The source entity model.
     * @param {Object} targetEntity - The target entity model.
     * @param {string} matchFolderPath - The match folder path for logging.
     * @returns {Promise<string>} The executive summary content.
     * @pipeline_phase REDUCE - Consolidates dimensional outputs into executive summary.
     */
    async _generateExecutiveSummary(dimensionalSummaries, sourceEntity, targetEntity, matchFolderPath) {
        this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.LIGHTNING, origin: 'MatchAssessmentWorkflow', message: `Synthesizing executive summary...` });

        const reqName = sourceEntity.nicename || 'the requirement';
        const offName = targetEntity.nicename || 'the offering';
        const executiveMessages = this._promptBuilder.buildExecutiveSummaryMessages(dimensionalSummaries, reqName, offName);
        const { content: executiveContent } = await this._aiService.generateChatResponse(executiveMessages, { logFolderPath: matchFolderPath, logAction: `Generated executive AI summary.` });

        return executiveContent;
    }

    /**
     * @private
     * Builds the final structured report object from match data and AI summaries.
     * @param {Object} matchData - The match data from criteria matching.
     * @param {Object} aiSummaries - The AI summaries (dimensional and executive).
     * @param {Object} sourceEntity - The source entity model.
     * @param {Object} targetEntity - The target entity model.
     * @returns {Object} The final report object.
     */
    _buildFinalReport(matchData, aiSummaries, sourceEntity, targetEntity) {
        const allDimensions = this._dimensionRepo.getAllDimensions() || [];
        const dimensionDisplayNames = {};
        const dimensionIds = {};

        allDimensions.forEach(dim => {
            dimensionDisplayNames[dim.name] = dim.displayName;
            dimensionIds[dim.name] = dim.id || dim.dimension_id;
        });

        const totalChecked = matchData.rawComparison.summary ? matchData.rawComparison.summary.totalRequirementsChecked : 0;
        const missingRequired = matchData.rawComparison.summary ? matchData.rawComparison.summary.missingRequired : 0;

        let singleSourceOfTruthReport = {
            ...matchData.rawComparison,
            _match_context: {
                requirement_id: sourceEntity.id,
                requirement_name: sourceEntity.name || "Requirement",
                offering_id: targetEntity.id,
                offering_name: targetEntity.name || "Offering",
                overall_match_score: matchData.score,
                total_requirements_checked: totalChecked,
                missing_required_count: missingRequired
            },
            _metadata: {
                dimension_display_names: dimensionDisplayNames,
                dimension_ids: dimensionIds
            }
        };

        if (singleSourceOfTruthReport.reportInfo) {
            singleSourceOfTruthReport.reportInfo.ai_summary_executive = aiSummaries.executive || null;
        }

        const dimensionalSummaries = aiSummaries.dimensional || {};
        for (const [dimKey, summaryText] of Object.entries(dimensionalSummaries)) {
            if (singleSourceOfTruthReport[dimKey]) {
                singleSourceOfTruthReport[dimKey].ai_summary = summaryText;
            }
        }

        const finalReport = singleSourceOfTruthReport;
        const restructuredReport = {
            _document_meta: {
                document_type: "Semantic Match Assessment Report",
                purpose: "Evaluates the fit between a specific Requirement (e.g., Job Listing) and an Offering (e.g., Candidate Resume) using vector-based semantic matching.",
                generated_at: new Date().toISOString()
            },
            reportInfo: finalReport.reportInfo,
            dimensions: {}
        };

        const metaIds = finalReport._metadata?.dimension_ids || {};
        const metaNames = finalReport._metadata?.dimension_display_names || {};

        const reservedKeys = ['reportInfo', '_metadata', '_ai_summary_executive', '_ai_summaries_dimensional', 'allDimensions', '_match_context'];

        for (const [key, value] of Object.entries(finalReport)) {
            if (!reservedKeys.includes(key) && typeof value === 'object') {
                restructuredReport.dimensions[key] = {
                    ...value,
                    id: metaIds[key] || 0,
                    displayName: metaNames[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                };
            }
        }

        if (finalReport.allDimensions) {
            restructuredReport.allDimensions = finalReport.allDimensions;
        }

        return restructuredReport;
    }

    /**
     * @private
     * @socexplanation Atomized pipeline stage for persistence. Writes JSON report to disk and registers document metadata.
     * This method isolates infrastructure I/O (file system, DB registration) from domain logic. Does not mutate global state.
     * @param {number} matchId - The match ID.
     * @param {Object} finalReport - The final report object.
     * @param {string} matchFolderPath - The match folder path.
     * @returns {string} The path to the saved report.
     * @pipeline_stage PERSISTENCE - Atomic write and registration operation.
     */
    _saveAndRegisterReport(matchId, finalReport, matchFolderPath) {
        const reportFileName = 'match_report.json';
        const reportPath = path.join(matchFolderPath, reportFileName);
        this._fileService.writeJsonFile(reportPath, finalReport);

        this._matchService.registerDocumentRecord({
            matchId,
            docType: DOCUMENT_TYPES.MATCH_REPORT,
            fileName: reportFileName
        });

        const matchFiles = this._fileService.listFilesInFolder(matchFolderPath);
        const existingDocs = this._matchService.getDocumentsForMatch(matchId);

        if (matchFiles.includes('ai_interactions.jsonl')) {
            const isRegistered = existingDocs.some(doc => doc.file_name === 'ai_interactions.jsonl');
            if (!isRegistered) {
                this._matchService.registerDocumentRecord({
                    matchId,
                    docType: DOCUMENT_TYPES.AI_DEBUG_LOG,
                    fileName: 'ai_interactions.jsonl'
                });
            }
        }

        if (matchFiles.includes('activity.jsonl')) {
            const isRegistered = existingDocs.some(doc => doc.file_name === 'activity.jsonl');
            if (!isRegistered) {
                this._matchService.registerDocumentRecord({
                    matchId,
                    docType: DOCUMENT_TYPES.ACTIVITY_LOG,
                    fileName: 'activity.jsonl'
                });
            }
        }

        return reportPath;
    }
}

module.exports = MatchAssessmentWorkflow;