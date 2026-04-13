/**
 * @module MatchAssessmentWorkflow
 * @description Domain Workflow for generating match reports between source and target entities.
 * 
 * @responsibility
 * - Orchestrates the match assessment process using deterministic criteria matching.
 * - Validates criteria preconditions and generates detailed match reports.
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
 */
const FileService = require('../services/FileService');
const logService = require('../services/LogService');
const eventService = require('../services/EventService');
const criteriaManagerWorkflow = require('../workflows/CriteriaManagerWorkflow');
const matchRepo = require('../repositories/MatchRepo');
const matchService = require('../services/MatchService');
const entityService = require('../services/EntityService');
const aiReportGenerator = require('../utils/AiReportGenerator');
const AiService = require('../services/AiService');
const PromptBuilder = require('../utils/PromptBuilder');
const DimensionRepo = require('../repositories/DimensionRepo');
const path = require('path');

class MatchAssessmentWorkflow {

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
     * 
     * @workflow_steps
     * 1. Update match queue status to 'processing'.
     * 2. Validate match exists; if not, throw error.
     * 3. Ensure folder path exists using FileService.
     * 4. Fetch source and target entity models.
     * 5. Call criteriaManagerWorkflow.calculateCriteriaMatch() to get match data.
     * 6. MAP PHASE: Generate dimensional AI summaries concurrently.
     * 7. REDUCE PHASE: Generate executive summary from dimensional summaries.
     * 8. Build single source of truth report object.
     * 9. Save matchData as JSON file to match folder.
     * 10. Update match record: score, report path, status 'completed', clear errors.
     * 11. Log success via logService and emit matchUpdate event.
     * 
     * @error_handling
     * - On any error: set queue status to 'error', save error message, log error, emit failure event, re-throw.
     */
    async assessMatch(sourceEntityId, targetEntityId, matchId) {
        if (!matchId) {
            throw new Error("matchId is required for assessment workflow");
        }

        matchRepo.updateMatchQueueStatus(matchId, 'processing');

        const match = matchRepo.getMatchById(matchId);
        if (!match) {
            throw new Error(`Match not found: ${matchId}`);
        }

        let matchFolderPath = match.folder_path;
        if (!matchFolderPath) {
            matchFolderPath = FileService.generateMatchFolderPath(sourceEntityId, targetEntityId);
            FileService.createDirectory(matchFolderPath);
            matchRepo.updateFolderPath(matchId, matchFolderPath);
        }

        const sourceEntity = entityService.getEntityById(sourceEntityId);
        const targetEntity = entityService.getEntityById(targetEntityId);

        try {
            logService.addActivityLog('Match', matchId, 'INFO', `Started match assessment for source ${sourceEntityId} against target ${targetEntityId}.`, matchFolderPath);

            // 1. Calculate vector match data
            const matchData = criteriaManagerWorkflow.calculateCriteriaMatch(sourceEntityId, targetEntityId);

            // 2. Prepare AI Prompt Inputs in memory (DO NOT save these to disk)
            const dimensionalAiReports = aiReportGenerator.generateDimensionalAiReports(matchData.rawComparison);

            // 3. MAP PHASE: Generate Dimensional AI Summaries Concurrently (In-Memory)
            logService.logTerminal('INFO', 'LIGHTNING', 'MatchAssessmentWorkflow', `Generating dimensional AI summaries for match ${matchId}...`);
            const aiSummaries = { dimensional: {} };
            const dimensionalTasks = [];

            // Tasks: Dimensional Summaries
            for (const [dimension, reportData] of Object.entries(dimensionalAiReports)) {
                dimensionalTasks.push((async () => {
                    const messages = PromptBuilder.buildMatchSummaryMessages(reportData);
                    aiSummaries.dimensional[dimension] = await AiService.generateChatResponse(messages, { logFolderPath: matchFolderPath });
                })());
            }

            await Promise.all(dimensionalTasks);

            // 4. REDUCE PHASE: Generate Executive Summary from Dimensional Summaries
            logService.logTerminal('INFO', 'LIGHTNING', 'MatchAssessmentWorkflow', `Synthesizing executive summary for match ${matchId}...`);
            const reqName = sourceEntity.name || 'the requirement';
            const offName = targetEntity.name || 'the offering';
            const executiveMessages = PromptBuilder.buildExecutiveSummaryMessages(aiSummaries.dimensional, reqName, offName);
            aiSummaries.executive = await AiService.generateChatResponse(executiveMessages, { logFolderPath: matchFolderPath });

            // 5. Gather Metadata & Context
            const allDimensions = DimensionRepo.getAllDimensions() || [];
            const dimensionDisplayNames = {};
            const dimensionIds = {}; // NEW: Create an ID map
            
            allDimensions.forEach(dim => {
                dimensionDisplayNames[dim.name] = dim.displayName;
                dimensionIds[dim.name] = dim.id || dim.dimension_id; // Map name to DB ID
            });

            const totalChecked = matchData.rawComparison.summary ? matchData.rawComparison.summary.totalRequirementsChecked : 0;
            const missingRequired = matchData.rawComparison.summary ? matchData.rawComparison.summary.missingRequired : 0;

            // 5. Build the ONE and ONLY output object
            const singleSourceOfTruthReport = {
                ...matchData.rawComparison,
                _match_context: {
                    requirement_id: sourceEntityId,
                    requirement_name: sourceEntity.name || "Requirement",
                    offering_id: targetEntityId,
                    offering_name: targetEntity.name || "Offering",
                    overall_match_score: matchData.score,
                    total_requirements_checked: totalChecked,
                    missing_required_count: missingRequired
                },
                _metadata: {
                    dimension_display_names: dimensionDisplayNames,
                    dimension_ids: dimensionIds
                },
                _ai_summary_executive: aiSummaries.executive,
                _ai_summaries_dimensional: aiSummaries.dimensional
            };

            // 6. Write the SINGLE file to disk
            const reportFileName = 'raw_json_comparison.json';
            const reportPath = path.join(matchFolderPath, reportFileName);
            FileService.writeJsonFile(reportPath, singleSourceOfTruthReport);
            
            // 7. Register Match Report in the Database
            matchService.registerDocumentRecord(matchId, 'Match Report', reportFileName, reportPath);

            // 7b. Register AI Debug Logs if generated
            const matchFiles = FileService.listFilesInFolder(matchFolderPath);
            if (matchFiles.includes('ai_interactions.jsonl')) {
                // Prevent duplicate database entries if this workflow is retried
                const existingDocs = matchService.getDocumentsForMatch(matchId);
                const isRegistered = existingDocs.some(doc => doc.file_name === 'ai_interactions.jsonl');
                
                if (!isRegistered) {
                    matchService.registerDocumentRecord(
                        matchId, 
                        'AI Debug Log', 
                        'ai_interactions.jsonl', 
                        path.join(matchFolderPath, 'ai_interactions.jsonl')
                    );
                }
            }

            // 8. Update match record state
            matchRepo.updateMatchScore(matchId, matchData.score);
            matchRepo.updateReportPath(matchId, reportPath);
            matchRepo.updateMatchQueueStatus(matchId, 'completed');
            matchRepo.updateMatchError(matchId, null);

            logService.addActivityLog('Match', matchId, 'INFO', `Match assessment complete. Single JSON report generated. Score: ${matchData.score}%.`, matchFolderPath);

            const updatedMatch = matchRepo.getMatchById(matchId);
            if (updatedMatch) {
                eventService.emit('matchUpdate', updatedMatch);
            }

            // 9. Generate and save PDF report to disk
            try {
                logService.logTerminal('INFO', 'LIGHTNING', 'MatchAssessmentWorkflow', `Generating PDF report for match ${matchId}...`);
                const PdfGeneratorService = require('../services/PdfGeneratorService');
                const rawPdfData = await PdfGeneratorService.generateMatchReport(matchId);
                const pdfBuffer = Buffer.from(rawPdfData);
                
                const safeReqName = (sourceEntity.name || "Requirement").replace(/[/\\?%*:|"<>]/g, '-');
                const safeOffName = (targetEntity.name || "Offering").replace(/[/\\?%*:|"<>]/g, '-');
                const pdfFileName = `Match - ${safeReqName} - ${safeOffName}.pdf`;
                const pdfPath = path.join(matchFolderPath, pdfFileName);
                
                const fs = require('fs');
                fs.writeFileSync(pdfPath, pdfBuffer);
                matchService.registerDocumentRecord(matchId, 'Match Report PDF', pdfFileName, pdfPath);
                logService.logTerminal('INFO', 'CHECKMARK', 'MatchAssessmentWorkflow', `PDF report saved to ${pdfPath}`);
            } catch (pdfError) {
                logService.logTerminal('WARN', 'WARNING', 'MatchAssessmentWorkflow', `Failed to generate PDF during assessment: ${pdfError.message}`);
            }
        } catch (error) {
            matchRepo.updateMatchQueueStatus(matchId, 'error');
            matchRepo.updateMatchError(matchId, error.message);

            logService.addActivityLog('Match', matchId, 'ERROR', `Match assessment failed: ${error.message}`, matchFolderPath);

            const updatedMatch = matchRepo.getMatchById(matchId);
            if (updatedMatch) {
                eventService.emit('matchUpdate', updatedMatch);
            }

            throw error;
        }
    }
}

module.exports = new MatchAssessmentWorkflow();
