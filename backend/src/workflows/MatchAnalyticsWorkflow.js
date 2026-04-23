/**
 * @module MatchAnalyticsWorkflow
 * @description Cross-domain workflow for orchestrating match analytics, PDF generation, and fast vector evaluations.
 *
 * @responsibility
 * - Orchestrates PDF generation for match reports using PdfGeneratorService and FileService.
 * - Evaluates potential matches using pure vector math via MatchingEngine (bypasses heavy AI generation).
 * - Coordinates data retrieval across MatchRepo, EntityRepo, CriteriaRepo, and DimensionRepo.
 * - Applies dimension weights and threshold settings for match scoring.
 *
 * @boundary_rules
 * - ✅ MAY call PdfGeneratorService for PDF generation.
 * - ✅ MAY call FileService for file I/O.
 * - ✅ MAY call MatchingEngine for pure vector math calculations.
 * - ✅ MAY call MatchRepo, EntityRepo, CriteriaRepo, DimensionRepo for data retrieval.
 * - ✅ MAY call SettingsManager for threshold configuration.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT emit events directly (use EventService if needed).
 * - ❌ MUST NOT contain SQL queries (use Repositories).
 * - ❌ MUST NOT call criteriaManagerWorkflow (which triggers AI report generation).
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const { ENTITY_TYPES } = require('../config/constants');

/**
 * @socexplanation
 * Error handling was refactored to explicitly catch and log data corruption/math failures
 * via injected LogService, eliminating silent failures while maintaining graceful degradation.
 */

class MatchAnalyticsWorkflow {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.matchService - The MatchService instance
     * @param {Object} deps.matchRepo - The MatchRepo instance
     * @param {Object} deps.entityRepo - The EntityRepo instance
     * @param {Object} deps.entityService - The EntityService instance
     * @param {Object} deps.criteriaRepo - The CriteriaRepo instance
     * @param {Object} deps.dimensionRepo - The DimensionRepo instance
     * @param {Object} deps.settingsManager - The SettingsManager instance
     * @param {Object} deps.fileService - The FileService instance
     * @param {Object} deps.pdfGenerator - The PdfGeneratorService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.matchingEngine - The MatchingEngine instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ matchService, matchRepo, entityRepo, entityService, criteriaRepo, dimensionRepo, settingsManager, fileService, pdfGeneratorService, logService, matchingEngine }) {
        this._matchService = matchService;
        this._matchRepo = matchRepo;
        this._entityRepo = entityRepo;
        this._entityService = entityService;
        this._criteriaRepo = criteriaRepo;
        this._dimensionRepo = dimensionRepo;
        this._settingsManager = settingsManager;
        this._fileService = fileService;
        this._pdfGeneratorService = pdfGeneratorService;
        this._logService = logService;
        this._matchingEngine = matchingEngine;
    }

    /**
     * Generates a match PDF report and returns the buffer for download.
     * @method generateAndGetMatchPdf
     * @param {number} matchId - The match ID.
     * @returns {Promise<{pdfBuffer: Buffer, pdfFileName: string}>} Object containing PDF buffer and filename.
     *
     * @workflow_steps
     * 1. Fetches the match by ID. Throws if not found.
     * 2. Generates the PDF filename from entity names.
     * 3. Checks if PDF already exists in the match folder.
     * 4. If not, calls PdfGeneratorService to generate the report.
     * 5. Writes the PDF to disk using this._fileService.
     * 6. Registers the document record.
     * 7. Returns the PDF buffer and filename.
     *
     * @socexplanation
     * - Encapsulates all file system operations for PDF generation.
     * - Moved from MatchService to enable workflow-level orchestration.
     * - Uses FileService for file I/O to enforce SoC.
     */
    async generateAndGetMatchPdf(matchId) {
        this._matchService.assertExists(matchId);

        const pdfFileName = this._matchService.getMatchPdfFileName(matchId);
        let pdfBuffer;
        
        const pdfPath = this._matchService.resolveEntityFilePath(matchId, pdfFileName);

        if (pdfPath && this._fileService.validatePath(pdfPath)) {
            pdfBuffer = await this._fileService.readBuffer(pdfPath);
        }

        if (!pdfBuffer) {
            const rawPdfData = await this._pdfGeneratorService.generateMatchReport(matchId);
            pdfBuffer = Buffer.from(rawPdfData);

            if (pdfPath) {
                await this._fileService.saveBuffer(pdfPath, pdfBuffer);
                const existingDocs = this._matchService.getDocuments(matchId);
                if (!existingDocs.some(d => d.file_name === pdfFileName)) {
                    this._matchService.registerDocumentRecord({
                        entityId: matchId,
                        docType: 'Match Report PDF',
                        fileName: pdfFileName
                    });
                }
            }
        }

        return { pdfBuffer, pdfFileName };
    }

    /**
     * Evaluates a paginated chunk of potential matches for an entity using pure vector math.
     * @method evaluateMatchesChunk
     * @param {number} entityId - The base entity ID to find matches for.
     * @param {number} offset - The offset for pagination (0-indexed).
     * @param {number} limit - The number of entities to evaluate in this chunk.
     * @returns {Object} Object containing evaluatedChunk array and totalOpposites count.
     *
     * @architectural_reasoning
     * - This method bypasses the heavy AI report generation (criteriaManagerWorkflow.calculateCriteriaMatch)
     *   which invokes AiReportGenerator. Instead, it directly calls MatchingEngine.calculateFastMatchScore()
     *   to obtain the pure mathematical vector similarity score without generating JSON reports.
     * - By working in chunks (offset/limit), it prevents blocking the Node.js event loop and enables
     *   progressive UI updates as chunks are processed.
     * - The frontend recursively fetches chunks until all entities are evaluated, maintaining a running
     *   top-20 list that updates dynamically.
     * - Uses dimension weights from the database to compute weighted match scores per dimension.
     *
     * @dry_principles
     * - Delegates to MatchingEngine.calculateFastMatchScore() which reuses evaluateCriteriaPair internally.
     * - Reuses existing repository methods for criteria and entity retrieval.
     * - Fetches active dimensions once per chunk and reuses across all evaluations in that chunk.
     * - Uses getCriteriaWithEmbeddingsForEntities() to batch-fetch criteria for all opposites, eliminating N+1 queries.
     *
     * @boundary_rules
     * - ✅ MAY call MatchingEngine for pure vector math.
     * - ✅ MAY call entityRepo, criteriaRepo, and dimensionRepo for data retrieval.
     * - ✅ MAY call SettingsManager for threshold configuration.
     * - ❌ MUST NOT call criteriaManagerWorkflow (which triggers AI report generation).
     * - ❌ MUST NOT call MatchingEngine.calculate() or buildRawComparison() (generates heavy JSON).
     */
    evaluateMatchesChunk(entityId, offset = 0, limit = 20) {
        const entityRole = this._entityService.getEntityRole(entityId);
        this._entityService.assertExists(entityId);

        const oppositeType = entityRole === ENTITY_TYPES.REQUIREMENT ? ENTITY_TYPES.OFFERING : ENTITY_TYPES.REQUIREMENT;

        const baseCriteria = this._criteriaRepo.getCriteriaWithEmbeddingsForEntity(entityId);
        if (!baseCriteria || baseCriteria.length === 0) {
            throw new Error('Base entity has no criteria with embeddings to match against.');
        }

        const activeDimensions = this._dimensionRepo.getActiveDimensions();

        const minimumFloor = parseFloat(this._settingsManager.get('minimum_match_floor')) || 0.50;
        const perfectScore = parseFloat(this._settingsManager.get('perfect_match_score')) || 0.85;

        const page = Math.floor(offset / limit) + 1;
        const { entities: opposites, meta } = this._entityRepo.getAllEntities({
            type: oppositeType,
            page: page,
            limit: limit
        });

        if (!opposites || opposites.length === 0) {
            return {
                evaluatedChunk: [],
                totalOpposites: meta.total
            };
        }

        const oppositeIds = opposites.map(opp => opp.id);
        const allOppositeCriteria = this._criteriaRepo.getCriteriaWithEmbeddingsForEntities(oppositeIds);

        const evaluatedChunk = [];

        for (const opp of opposites) {
            try {
                const reqId = entityRole === ENTITY_TYPES.REQUIREMENT ? entityId : opp.id;
                const offId = entityRole === ENTITY_TYPES.OFFERING ? entityId : opp.id;

                const oppositeCriteria = allOppositeCriteria[opp.id] || [];
                if (!oppositeCriteria || oppositeCriteria.length === 0) {
                    continue;
                }

                const reqCriteria = entityRole === ENTITY_TYPES.REQUIREMENT ? baseCriteria : oppositeCriteria;
                const offCriteria = entityRole === ENTITY_TYPES.REQUIREMENT ? oppositeCriteria : baseCriteria;

                const evaluationDto = {
                    criteria: {
                        requirementCriteria: reqCriteria,
                        offeringCriteria: offCriteria
                    },
                    activeDimensions,
                    matchSettings: {
                        minimumFloor,
                        perfectScore
                    }
                };

                const fastScore = this._matchingEngine.calculateFastMatchScore(evaluationDto);

                const existingMatch = this._matchRepo.getMatchByRequirementAndOffering(reqId, offId);

                evaluatedChunk.push({
                    entity: opp,
                    score: fastScore,
                    existingMatchId: existingMatch ? existingMatch.id : null,
                    existingMatchStatus: existingMatch ? existingMatch.status : null
                });
            } catch(e) {
                /**
                 * @socexplanation
                 * Raw console.error was replaced with logSystemFault to ensure failures are captured
                 * in the persistent audit trail, enforcing the strict logging policy.
                 */
                this._logService.logSystemFault({ origin: 'MatchAnalyticsWorkflow', message: `Chunk evaluation failed for entity ${entityId}`, errorObj: e });
                continue;
            }
        }

        return {
            evaluatedChunk,
            totalOpposites: meta.total
        };
    }
}

module.exports = MatchAnalyticsWorkflow;