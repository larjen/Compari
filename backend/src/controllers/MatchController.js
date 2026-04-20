/**
 * @module MatchController
 * @description HTTP Controller responsible for handling HTTP requests related to matches.
 *
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual data access to Domain Services (MatchService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 *
 * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ❌ MUST NOT handle file system operations (path, FileService, MATCH_REPORTS_DIR, TRASHED_DIR).
 * - ✅ All data access MUST go through Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 *
 * @dependency_injection
 * All services (matchService, queueService, fileService) are injected via constructor.
 * No global service locator is used - dependencies are explicitly provided.
 *
 * @socexplanation
 * - Standardizes error handling by delegating ALL errors to the global error middleware.
 * - This ensures consistent error responses and centralized error logging.
 * - File system operations are delegated to MatchService to maintain SoC.
 * - Uses asyncHandler to eliminate try/catch boilerplate.
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { handleFileDownload } = require('../utils/fileHandler');
const { HTTP_STATUS, QUEUE_TASKS } = require('../config/constants');

class MatchController {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.matchService - Match service instance
     * @param {Object} dependencies.queueService - Queue service instance
     * @param {Object} dependencies.fileService - File service instance
     * @param {Object} dependencies.matchAnalyticsWorkflow - MatchAnalyticsWorkflow instance
     */
    constructor({ matchService, queueService, fileService, matchAnalyticsWorkflow }) {
        this._matchService = matchService;
        this._queueService = queueService;
        this._fileService = fileService;
        this._matchAnalyticsWorkflow = matchAnalyticsWorkflow;
    }

    /**
     * GET /api/matches
     * Retrieves matches with pagination, search, and status filtering.
     */
    getAll = asyncHandler(async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const result = this._matchService.getPaginatedMatches({ page, limit, search, status });
        res.json(result);
    });

    /**
     * GET /api/matches/:id
     */
    getById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const match = this._matchService.getMatchById(id);
        if (!match) {
            throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);
        }
        res.json({ match });
    });

    /**
     * POST /api/matches
     * Creates a new match and queues an assessment.
     * @param {Object} req - Express request object (req.body.sourceEntityId, req.body.targetEntityId)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Delegates file system operations to MatchService.createMatchWithFolder.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     * - Controller orchestrates the queueing to maintain SoC and prevent circular dependencies.
     */
    create = asyncHandler(async (req, res) => {
        const { requirementEntityId, offeringEntityId } = req.body;

        const matchId = this._matchService.createMatchWithFolder({
            requirementId: requirementEntityId,
            offeringId: offeringEntityId
        });

        this._queueService.enqueue(QUEUE_TASKS.ASSESS_ENTITY_MATCH, {
            sourceEntityId: requirementEntityId,
            targetEntityId: offeringEntityId,
            matchId
        });

        res.json({ success: true, matchId });
    });

    /**
     * DELETE /api/matches/:id
     * Deletes a match by ID.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Delegates file system operations to MatchService.deleteMatchWithFolder.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    delete = asyncHandler(async (req, res) => {
        const { id } = req.params;

        this._matchService.deleteMatchWithFolder(id);

        res.json({ success: true });
    });

    /**
     * POST /api/matches/:id/folder/open
     * Opens the match folder in the native OS file manager.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * - Delegates file system logic to MatchService.
     * - Controller purely handles the HTTP transport and response payload.
     */
    openFolder = asyncHandler(async (req, res) => {
        const { id } = req.params;
        this._matchService.openMatchFolder(id);
        res.json({ success: true });
    });

    /**
     * GET /api/matches/:id/files
     * Retrieves files in the match folder.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    getFiles = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const match = this._matchService.getMatchById(id);

        if (!match) {
            throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);
        }

        const docs = this._matchService.getDocumentsForMatch(id);
        const files = docs.map(d => d.file_name);
        res.json({ files });
    });

    /**
     * GET /api/matches/:id/files/:filename
     * Downloads a specific file from the match folder.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    getFile = asyncHandler(async (req, res) => {
        const { id, filename } = req.params;
        const match = this._matchService.getMatchById(id);
        return handleFileDownload({
            fileService: this._fileService,
            res,
            entity: match,
            fileName: filename,
            folderPathKey: 'folder_path'
        });
    });

    /**
     * POST /api/matches/:id/retry
     * Retries a failed match assessment by re-queuing the task.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * - Delegates retry orchestration to MatchService.retryMatchAssessment.
     * - Controller orchestrates the queueing to maintain SoC and prevent circular dependencies.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    retryProcessing = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const match = this._matchService.retryMatchAssessment(id);
        this._queueService.enqueue(QUEUE_TASKS.ASSESS_ENTITY_MATCH, {
            sourceEntityId: match.requirement_id,
            targetEntityId: match.offering_id,
            matchId: id
        });
        res.json({ success: true, message: 'Queued for retry' });
    });

    /**
     * GET /api/matches/:id/pdf
     * Downloads the match report as a PDF.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Delegates PDF generation to MatchService.
     * - Controller only handles HTTP transport: response headers and streaming.
     */
    downloadPdf = asyncHandler(async (req, res) => {
        const matchId = parseInt(req.params.id);

        const { pdfBuffer, pdfFileName } = await this._matchAnalyticsWorkflow.generateAndGetMatchPdf(matchId);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${pdfFileName}"`,
            'Content-Length': pdfBuffer.length,
            'Access-Control-Expose-Headers': 'Content-Disposition'
        });

        res.end(pdfBuffer);
    });
}

module.exports = MatchController;