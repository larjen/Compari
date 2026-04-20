/**
 * @module EntityController
 * @description HTTP Controller responsible for handling HTTP requests related to generic entities.
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
const { handleFileDownload } = require('../utils/fileHandler');
const { QUEUE_TASKS, ENTITY_STATUS, LOG_LEVELS, HTTP_STATUS } = require('../config/constants');

class EntityController {
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
        this._entityService = entityService;
        this._criteriaService = criteriaService;
        this._matchService = matchService;
        this._queueService = queueService;
        this._logService = logService;
        this._fileService = fileService;
        this._matchAnalyticsWorkflow = matchAnalyticsWorkflow;
    }

    /**
     * GET /api/entities
     * Retrieves all entities with pagination, search, and status filtering.
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

        const id = this._entityService.createEntity(dto);
        res.status(HTTP_STATUS.CREATED).json({ success: true, entityId: id });
    });

    /**
     * GET /api/entities/:id
     */
    getById = asyncHandler(async (req, res) => {
        const entity = this._entityService.getEntityById(req.params.id);
        if (!entity) {
            throw new AppError('Entity not found', HTTP_STATUS.NOT_FOUND);
        }
        res.json({ entity });
    });

    /**
     * DELETE /api/entities/:id
     * Deletes an entity by ID.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Cancels pending queue tasks before deletion to prevent zombie tasks.
     * - Delegates queue orchestration to the Controller to maintain strict domain isolation in the Service layer.
     */
    delete = asyncHandler(async (req, res) => {
        this._queueService.cancelEntityExtractionTasks(parseInt(req.params.id));
        this._entityService.deleteEntity(parseInt(req.params.id));
        res.json({ success: true, message: 'Entity deleted successfully' });
    });

    /**
     * PUT /api/entities/:id
     * Updates an entity's metadata.
     * @param {Object} req - Express request object (req.params.id, req.body.metadata)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    update = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        const { metadata } = req.body;
        this._entityService.updateMetadata(id, metadata);
        res.json({ success: true, message: 'Entity updated' });
    });

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

        const entityId = req.params.id;
        if (!entityId) {
            throw new AppError('Entity ID is required', HTTP_STATUS.BAD_REQUEST);
        }

        const movedPath = this._entityService.uploadEntityFile(entityId, req.file);
        const entity = this._entityService.getEntityById(entityId);

        this._entityService.updateState(entityId, { status: ENTITY_STATUS.PENDING });

        const safeFileName = require('path').basename(req.file.originalname);

        this._queueService.enqueue(QUEUE_TASKS.PROCESS_DOCUMENT, {
            entityId: parseInt(entityId),
            folderPath: entity?.folderPath,
            fileName: safeFileName
        });

        this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `Document uploaded: ${safeFileName}. Queued for processing.`,
                folderPath: entity?.folderPath
            });
        
        res.json({ success: true, message: 'File uploaded successfully. Document has been queued for processing.', path: movedPath });
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

        const entityId = req.params.id;
        if (!entityId) {
            throw new AppError('Entity ID is required', HTTP_STATUS.BAD_REQUEST);
        }
        
        const movedPaths = this._entityService.uploadEntityFiles(entityId, req.files);
        const entity = this._entityService.getEntityById(entityId);
        
        this._entityService.updateState(entityId, { status: ENTITY_STATUS.PENDING });

        for (const file of req.files) {
            const safeFileName = require('path').basename(file.originalname);
            this._queueService.enqueue(QUEUE_TASKS.PROCESS_DOCUMENT, {
                entityId: parseInt(entityId),
                folderPath: entity?.folderPath,
                fileName: safeFileName
            });
            
            this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `Document uploaded: ${safeFileName}. Queued for AI processing.`,
                folderPath: entity?.folderPath
            });
        }
        
        res.json({ success: true, message: 'Files uploaded successfully. AI criteria extraction has been queued.', paths: movedPaths });
    });

    /**
     * GET /api/entities/:id/files
     * Retrieves all files in an entity's folder.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    getFiles = asyncHandler(async (req, res) => {
        const entityId = req.params.id;
        const files = this._entityService.getEntityFiles(entityId);
        res.json({ files });
    });

    /**
     * GET /api/entities/:id/files/:filename
     * Downloads a specific file from an entity's folder.
     * @param {Object} req - Express request object (req.params.id, req.params.filename)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    downloadFile = asyncHandler(async (req, res) => {
        const entity = this._entityService.getEntityById(req.params.id);
        if (!entity) {
            throw new AppError('Entity not found', HTTP_STATUS.NOT_FOUND);
        }
        return handleFileDownload({
            fileService: this._fileService,
            res,
            entity,
            fileName: req.params.filename
        });
    });

    /**
     * GET /api/entities/:id/matches
     * Retrieves all matches for a specific entity.
     * @param {Object} req - Express request object (req.params.id, req.query.role)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    getMatches = asyncHandler(async (req, res) => {
        const entityId = parseInt(req.params.id);
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
        const criteria = this._criteriaService.getCriteriaForEntity(req.params.id);
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
        const entityId = parseInt(req.params.id);
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
     * POST /api/entities/:id/folder/open
     * Opens the entity's folder in the native OS file manager.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * Handles the HTTP request to open the entity's folder in the host OS.
     * Delegates the actual OS interaction to EntityService.openEntityFolder which in turn uses FileService
     * to maintain separation of concerns.
     */
    openFolder = asyncHandler(async (req, res) => {
        const entityId = parseInt(req.params.id);
        this._entityService.openEntityFolder(entityId);
        res.json({ success: true });
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
        const entityId = parseInt(req.params.id);
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
        const entityId = parseInt(req.params.id);
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;

        const result = this._matchAnalyticsWorkflow.evaluateMatchesChunk(entityId, offset, limit);
        res.json(result);
    });

    /**
     * POST /api/entities/:id/retry
     * Retries the AI extraction process for a failed entity.
     * Clears error state, resets queue status to pending, and re-enqueues the processing task.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @responsibility
     * - Sets macro status to PENDING to signal the entity is queued.
     * - Clears previous error state.
     * - Re-enqueues the document processing task.
     *
     * @socexplanation
     * - Setting status to PENDING ensures the UI reflects a queued state until the worker claims the task.
     * - The DocumentProcessorWorkflow.parseDocumentContent method handles the transition to PARSING_DOCUMENT when processing begins.
     * - Delegates file name resolution to EntityService.getOriginalUploadedFileName.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    retryProcessing = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);

        const entity = this._entityService.getEntityById(id);
        if (!entity) {
            throw new AppError('Entity not found', HTTP_STATUS.NOT_FOUND);
        }

        const fileName = this._entityService.getOriginalUploadedFileName(id);
        const folderPath = entity.folderPath;

        if (!fileName || !folderPath) {
            throw new AppError('No processing file name found for retry. The file may have been deleted from the disk.', HTTP_STATUS.BAD_REQUEST);
        }

        this._entityService.updateState(id, { status: ENTITY_STATUS.PENDING, error: null });

        this._queueService.enqueue(QUEUE_TASKS.PROCESS_DOCUMENT, {
            entityId: id,
            folderPath,
            fileName
        });

        this._logService.addActivityLog({
                entityType: 'Entity',
                entityId: id,
                logType: LOG_LEVELS.INFO,
                message: `Retrying AI extraction for: ${fileName}.`,
                folderPath
            });

        res.json({ message: 'Queued for retry' });
    });
}

module.exports = EntityController;