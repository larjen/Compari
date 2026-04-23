/**
 * @module MatchController
 * @description HTTP Controller responsible for handling HTTP requests related to matches.
 * Extends BaseCrudController to inherit standard CRUD operations with clean overrides.
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
 * - Extends BaseCrudController to follow DRY CRUD architecture (Section 8 of ARCHITECTURE.md).
 * - getById is inherited from BaseCrudController - automatically handles 404, ID parsing, and { match: ... } response.
 */
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, QUEUE_TASKS } = require('../config/constants');
const BaseCrudController = require('./BaseCrudController');

/**
  * @class MatchController
  * @extends BaseCrudController
  * @description HTTP Controller for Match entity operations.
  * Implements clean overrides for custom business logic while inheriting standard CRUD from BaseCrudController.
  */
class MatchController extends BaseCrudController {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.matchService - Match service instance
     * @param {Object} dependencies.queueService - Queue service instance
     * @param {Object} dependencies.fileService - File service instance
     * @param {Object} dependencies.matchAnalyticsWorkflow - MatchAnalyticsWorkflow instance
     */
    constructor({ matchService, queueService, fileService, matchAnalyticsWorkflow }) {
        super({
            service: matchService,
            entityName: 'Match',
            methodMap: {
                getById: 'getMatchById'
            },
            fileService,
            queueService,
            retryTaskName: QUEUE_TASKS.ASSESS_ENTITY_MATCH,
            retryServiceMethod: 'retryMatchAssessment'
        });

        this._queueService = queueService;
        this._fileService = fileService;
        this._matchAnalyticsWorkflow = matchAnalyticsWorkflow;
    }

    /**
     * Builds retry payload for match assessment, including entity IDs and match ID.
     * @method _buildRetryPayload
     * @param {number} id - The match ID
     * @param {Object} match - The match object
     * @returns {Object} Payload with sourceEntityId, targetEntityId, matchId
     * @protected
     */
    _buildRetryPayload(id, match) {
        return {
            sourceEntityId: match.requirement_id,
            targetEntityId: match.offering_id,
            matchId: id
        };
    }

    /**
     * GET /api/matches
     * Retrieves matches with pagination, search, and status filtering.
     * @override
     * @socexplanation
     * - Override required due to custom pagination, status filtering, and search via getPaginatedMatches.
     * - BaseCrudController.getAll returns all entities without pagination support.
     */
    getAll = asyncHandler(async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const result = this.service.getPaginatedMatches({ page, limit, search, status });
        res.json(result);
    });

    /**
     * POST /api/matches
     * Creates a new match and queues an assessment.
     * @override
     * @param {Object} req - Express request object (req.body.sourceEntityId, req.body.targetEntityId)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Override required due to file system operations (createMatchWithFolder) and queue orchestration.
     * - BaseCrudController.create delegates to service.create which lacks folder creation and queueing.
     * - Controller orchestrates the queueing to maintain SoC and prevent circular dependencies.
     */
    create = asyncHandler(async (req, res) => {
        const { requirementEntityId, offeringEntityId } = req.body;

        const matchId = await this.service.createMatchWithFolder({
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
     * @override
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Override required due to file system operations (deleteMatchWithFolder).
     * - BaseCrudController.delete only handles service deletion without folder cleanup.
     * - Delegates file system operations to MatchService.deleteMatchWithFolder.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    delete = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

        this.service.deleteMatchWithFolder(id);

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
        const id = this._extractId(req);
        const match = this.service.getMatchById(id);

        if (!match) {
            throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);
        }

        const docs = this.service.getDocuments(id);
        const files = docs.map(d => d.file_name);
        res.json({ files });
    });

    /**
     * GET /api/matches/:id/pdf
     * Downloads the match report as a PDF.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Custom endpoint not in BaseCrudController.
     * - Delegates PDF generation to MatchService.
     * - Controller only handles HTTP transport: response headers and streaming.
     */
    downloadPdf = asyncHandler(async (req, res) => {
        const matchId = this._extractId(req);

        const { pdfBuffer, pdfFileName } = await this._matchAnalyticsWorkflow.generateAndGetMatchPdf(matchId);

        const encodedName = encodeURIComponent(pdfFileName);
        const asciiName = pdfFileName.replace(/[^\x20-\x7E]/g, '_');

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
            'Content-Length': pdfBuffer.length,
            'Access-Control-Expose-Headers': 'Content-Disposition'
        });

        res.end(pdfBuffer);
    });
}

module.exports = MatchController;