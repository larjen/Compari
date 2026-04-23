/**
 * @module EntityController
 * @description HTTP Controller responsible for handling HTTP requests related to generic entities.
 * Extends BaseCrudController to inherit standard CRUD operations while providing custom overrides
 * for Entity-specific behavior (pagination, DTO mapping, metadata updates, queue orchestration).
 *
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual business logic to Services (EntityService, MatchService, CriteriaService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 *
 * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ❌ MUST NOT handle raw file system operations.
 * - ❌ MUST NOT use OS-level file sending methods like res.sendFile().
 * - ✅ All business logic MUST be delegated to Services.
 * - ✅ All data access MUST go through Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 *
 * @dependency_injection
 * All services (entityService, criteriaService, matchService, queueService, logService, fileService)
 * are injected via constructor. No global service locator is used - dependencies are explicitly provided.
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { QUEUE_TASKS, ENTITY_STATUS, LOG_LEVELS, HTTP_STATUS } = require('../config/constants');
const BaseCrudController = require('./BaseCrudController');

/**
  * @class EntityController
  * @extends BaseCrudController
  * @description Controller handling HTTP requests for Entity domain (Requirements and Offerings).
  * Provides custom overrides for getAll, create, update, and delete while inheriting getById from BaseCrudController.
  */
class EntityController extends BaseCrudController {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.entityService - Entity service instance
     * @param {Object} dependencies.criteriaService - Criteria service instance
     * @param {Object} dependencies.matchService - Match service instance
     * @param {Object} dependencies.queueService - Queue service instance
     * @param {Object} dependencies.logService - Logging service instance
     * @param {Object} dependencies.fileService - File service instance
     * @param {Object} dependencies.matchAnalyticsWorkflow - MatchAnalyticsWorkflow instance
     */
    constructor({ entityService, criteriaService, matchService, queueService, logService, fileService, matchAnalyticsWorkflow }) {
        super({
            service: entityService,
            entityName: 'Entity',
            methodMap: {
                getById: 'getEntityById'
            },
            fileService,
            queueService,
            retryTaskName: QUEUE_TASKS.PROCESS_DOCUMENT,
            retryServiceMethod: 'retryProcessing'
        });

        this._entityService = entityService;
        this._criteriaService = criteriaService;
        this._matchService = matchService;
        this._queueService = queueService;
        this._logService = logService;
        this._fileService = fileService;
        this._matchAnalyticsWorkflow = matchAnalyticsWorkflow;
    }

    /**
     * Builds retry payload for entity processing, including file name.
     * @method _buildRetryPayload
     * @param {number} id - The entity ID
     * @param {Object} entity - The entity object
     * @returns {Object} Payload with entityId and fileName
     * @protected
     */
    _buildRetryPayload(id, _entity) {
        const fileName = this._entityService.getOriginalUploadedFileName(id);
        return { entityId: id, fileName };
    }

    /**
     * GET /api/entities
     * Retrieves all entities with pagination, search, and status filtering.
     * @override - Custom pagination, type filtering (requirement/offering), and search.
     */
    getAll = asyncHandler(async (req, res) => {
        const type = req.query.type || null;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const search = req.query.search || null;
        const status = req.query.status || null;

        const result = this._entityService.getAllEntities({ type, page, limit, search, status });
        res.json(result);
    });

    /**
     * POST /api/entities
     * Creates a new entity.
     * @override - Requires custom DTO payload parsing (req.body.type -> entityType).
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @socexplanation Enforces DTO mapping to prevent raw req.body from leaking into Service layer.
     */
    create = asyncHandler(async (req, res) => {
        const dto = {
            entityType: req.body.type || req.body.entityType || req.body.entity_type,
            nicename: req.body.name || req.body.nicename,
            niceNameLine1: req.body.niceNameLine1,
            niceNameLine2: req.body.niceNameLine2,
            folderPath: req.body.folderPath,
            metadata: req.body.metadata,
            blueprintId: req.body.blueprintId
        };

        const id = await this._entityService.createEntity(dto);
        res.status(HTTP_STATUS.CREATED).json({ success: true, entityId: id });
    });

    /**
     * DELETE /api/entities/:id
     * Deletes an entity by ID.
     * @override - Must call _queueService.cancelEntityExtractionTasks before delegating deletion.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Cancels pending queue tasks before deletion to prevent zombie tasks.
     * - Delegates queue orchestration to the Controller to maintain strict domain isolation in the Service layer.
     */
    delete = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        this._queueService.cancelEntityExtractionTasks(id);
        this._entityService.deleteEntity(id);
        res.json({ success: true, message: 'Entity deleted successfully' });
    });

    /**
     * PUT /api/entities/:id
     * Updates an entity's metadata.
     * @override - Specifically extracts and updates metadata rather than standard entity columns.
     * @param {Object} req - Express request object (req.params.id, req.body.metadata)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    update = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        const { metadata } = req.body;
        this._entityService.updateMetadata(id, metadata);
        res.json({ success: true, message: 'Entity updated' });
    });

    /**
     * Private helper method to process uploaded files.
     * Handles: updating entity state to PENDING, moving files, enqueuing tasks, and logging activity.
     * @method _processUploadedFiles
     * @param {number} entityId - The entity ID.
     * @param {Array<Object>} filesArray - Array of file objects.
     * @returns {Array<string>} Array of moved file paths.
     * @private
     */
    async _processUploadedFiles(entityId, filesArray) {
        const movedPaths = await this._entityService.uploadEntityFiles(entityId, filesArray);

        this._entityService.updateState(entityId, { status: ENTITY_STATUS.PENDING });

        for (const file of filesArray) {
            const safeFileName = require('path').basename(file.originalname);
            this._queueService.enqueue(QUEUE_TASKS.PROCESS_DOCUMENT, {
                entityId: entityId,
                fileName: safeFileName
            });

            this._entityService.logActivity(entityId, {
                logType: LOG_LEVELS.INFO,
                message: `Document uploaded: ${safeFileName}. Queued for processing.`
            });
        }

        return movedPaths;
    }

    /**
     * POST /api/entities/:id/upload
     * Uploads a single document file for an entity and queues AI criteria extraction.
     * @param {Object} req - Express request object (req.file, req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * Delegates to the atomized pipeline starting with PARSE_DOCUMENT_CONTENT.
     */
    uploadFile = asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new AppError('No document was uploaded.', HTTP_STATUS.BAD_REQUEST);
        }

        const entityId = this._extractId(req);
        const movedPaths = await this._processUploadedFiles(entityId, [req.file]);

        res.json({ success: true, message: 'File uploaded successfully. Document has been queued for processing.', path: movedPaths[0] });
    });

    /**
     * POST /api/entities/:id/upload-multiple
     * Uploads multiple document files for an entity and queues AI criteria extraction for each file.
     * @param {Object} req - Express request object (req.files, req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    uploadFiles = asyncHandler(async (req, res) => {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            throw new AppError('No documents were uploaded.', HTTP_STATUS.BAD_REQUEST);
        }

        const entityId = this._extractId(req);
        const movedPaths = await this._processUploadedFiles(entityId, req.files);

        res.json({ success: true, message: 'Files uploaded successfully. AI criteria extraction has been queued.', paths: movedPaths });
    });

    /**
     * GET /api/entities/:id/matches
     * Retrieves all matches for a specific entity.
     * @param {Object} req - Express request object (req.params.id, req.query.role)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    getMatches = asyncHandler(async (req, res) => {
        const entityId = this._extractId(req);
        const role = req.query.role;
        const matches = this._matchService.getMatchesForEntity(entityId, role);
        res.json({ matches });
    });

    /**
     * GET /api/entities/:id/criteria
     * Retrieves criteria for a specific entity.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    getCriteria = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        const criteria = this._criteriaService.getCriteriaForEntity(id);
        res.json({ criteria });
    });

    /**
     * POST /api/entities/:id/extract
     * Manually triggers AI criteria extraction on a specific file for an entity.
     * @param {Object} req - Express request object (req.params.id, req.body.fileName)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * - Delegates business validation to EntityService.triggerCriteriaExtraction.
     * - Controller handles HTTP transport: parameter extraction and response formatting.
     * - Delegates queue orchestration to the Controller to maintain strict domain isolation in the Service layer.
     */
    triggerExtraction = asyncHandler(async (req, res) => {
        const entityId = this._extractId(req);
        const { fileName } = req.body;
        
        this._entityService.updateState(entityId, { status: ENTITY_STATUS.PENDING });
        
        await this._entityService.triggerCriteriaExtraction(entityId, fileName);
        
        this._queueService.enqueue(QUEUE_TASKS.EXTRACT_ENTITY_CRITERIA, { entityId, fileName });

        res.json({ 
            success: true, 
            message: `AI criteria extraction queued for file: ${fileName}` 
        });
    });

/**
     * DELETE /api/entities/:id/extract
     * Cancels all pending or processing extraction tasks for an entity.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * - Cancels pending queue tasks before updating entity status.
     * - Delegates queue orchestration to the Controller to maintain strict domain isolation in the Service layer.
     */
    cancelExtraction = asyncHandler(async (req, res) => {
        const entityId = this._extractId(req);
        this._queueService.cancelEntityExtractionTasks(entityId);
        this._entityService.cancelExtraction(entityId);
        res.json({ success: true });
    });

    /**
     * GET /api/entities/:id/top-matches
     * Retrieves a paginated chunk of evaluated matches for a specific entity.
     * @param {Object} req - Express request object (req.params.id, req.query.offset, req.query.limit)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @architectural_reasoning
     * - Extracts offset and limit query parameters to support chunked/paginated evaluation.
     * - Delegated to MatchService.evaluateMatchesChunk which uses pure vector math (MatchingEngine)
     *   instead of heavy AI report generation.
     * - Returns evaluatedChunk and totalOpposites to enable frontend to track progress
     *   and recursively fetch subsequent chunks.
     */
    getTopMatches = asyncHandler(async (req, res) => {
        const entityId = this._extractId(req);
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;

        const result = this._matchAnalyticsWorkflow.evaluateMatchesChunk(entityId, offset, limit);
        res.json(result);
    });
}

module.exports = EntityController;