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
 * @socexplanation
 * - Uses asyncHandler middleware to eliminate try/catch boilerplate.
 * - All methods are wrapped with asyncHandler for automatic error catching.
 * - Controllers focus purely on HTTP transport (parameter extraction, response formatting).
 * - Errors are automatically forwarded to global error middleware via next(error).
 */

const entityService = require('../services/EntityService');
const criteriaService = require('../services/CriteriaService');
const matchService = require('../services/MatchService');
const queueService = require('../services/QueueService');
const logService = require('../services/LogService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { handleFileDownload } = require('../utils/fileHandler');
const { QUEUE_TASKS, ENTITY_STATUS, LOG_LEVELS, HTTP_STATUS } = require('../config/constants');

class EntityController {
    /**
     * GET /api/entities
     * Retrieves all entities, optionally filtered by type, with pagination, search, and status filtering.
     * @param {Object} req - Express request object (req.query.type, req.query.page, req.query.limit, req.query.search, req.query.status)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getAll = asyncHandler(async (req, res) => {
        const type = req.query.type || null;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const search = req.query.search || null;
        const status = req.query.status || null;

        const result = entityService.getAllEntities({ type, page, limit, search, status });
        res.json(result);
    });

    /**
     * GET /api/entities/:id
     * Retrieves a single entity by ID.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getById = asyncHandler(async (req, res) => {
        const entity = entityService.getEntityById(req.params.id);
        if (!entity) {
            throw new AppError('Entity not found', HTTP_STATUS.NOT_FOUND);
        }
        res.json({ entity });
    });

    /**
     * POST /api/entities
     * Creates a new entity.
     * @param {Object} req - Express request object (req.body.type, req.body.name, req.body.description, req.body.blueprintId)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static create = asyncHandler(async (req, res) => {
        const { type, name, description, folderPath, metadata, blueprintId } = req.body;
        const entityId = entityService.createEntity(type, name, description, folderPath, metadata, blueprintId);
        res.json({ success: true, entityId });
    });

    /**
     * PUT /api/entities/:id
     * Updates an entity's metadata.
     * @param {Object} req - Express request object (req.params.id, req.body.metadata)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static update = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        const { metadata } = req.body;
        entityService.updateEntityMetadata(id, metadata);
        res.json({ success: true, message: 'Entity updated' });
    });

    /**
     * DELETE /api/entities/:id
     * Deletes an entity by ID.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static delete = asyncHandler(async (req, res) => {
        entityService.deleteEntity(parseInt(req.params.id));
        res.json({ success: true, message: 'Entity deleted successfully' });
    });

    /**
     * POST /api/entities/:id/upload
     * Uploads a single document file for an entity and queues AI criteria extraction.
     * @param {Object} req - Express request object (req.file, req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static uploadFile = asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new AppError('No document was uploaded.', HTTP_STATUS.BAD_REQUEST);
        }

        const entityId = req.params.id;
        if (!entityId) {
            throw new AppError('Entity ID is required', HTTP_STATUS.BAD_REQUEST);
        }
        
        const movedPath = entityService.uploadEntityFile(entityId, req.file);
        const entity = entityService.getEntityById(entityId);
        
        // Explicitly mark the entity as pending so the UI can reflect the queued state via SSE.
        entityService.updateEntityStatus(entityId, ENTITY_STATUS.PENDING);
        
        queueService.enqueue(QUEUE_TASKS.PROCESS_ENTITY_DOCUMENT, { 
            entityId: parseInt(entityId), 
            folderPath: entity?.folderPath,
            fileName: req.file.filename
        });
        
        logService.addActivityLog('Entity', entityId, LOG_LEVELS.INFO, `Document uploaded: ${req.file.filename}. Queued for AI processing.`, entity?.folderPath);
        
        res.json({ success: true, message: 'File uploaded successfully. AI criteria extraction has been queued.', path: movedPath });
    });

    /**
     * POST /api/entities/:id/upload-multiple
     * Uploads multiple document files for an entity and queues AI criteria extraction for each file.
     * @param {Object} req - Express request object (req.files, req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static uploadFiles = asyncHandler(async (req, res) => {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            throw new AppError('No documents were uploaded.', HTTP_STATUS.BAD_REQUEST);
        }

        const entityId = req.params.id;
        if (!entityId) {
            throw new AppError('Entity ID is required', HTTP_STATUS.BAD_REQUEST);
        }
        
        const movedPaths = entityService.uploadEntityFiles(entityId, req.files);
        const entity = entityService.getEntityById(entityId);
        
        // Setting pending state guarantees real-time visual feedback of the queue.
        entityService.updateEntityStatus(entityId, ENTITY_STATUS.PENDING);
        
        for (const file of req.files) {
            queueService.enqueue(QUEUE_TASKS.PROCESS_ENTITY_DOCUMENT, { 
                entityId: parseInt(entityId), 
                folderPath: entity?.folderPath,
                fileName: file.filename
            });
            
            logService.addActivityLog('Entity', entityId, LOG_LEVELS.INFO, `Document uploaded: ${file.filename}. Queued for AI processing.`, entity?.folderPath);
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
    static getFiles = asyncHandler(async (req, res) => {
        const entityId = req.params.id;
        const files = entityService.getEntityFiles(entityId);
        res.json({ files });
    });

    /**
     * GET /api/entities/:id/files/:filename
     * Downloads a specific file from an entity's folder.
     * @param {Object} req - Express request object (req.params.id, req.params.filename)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static downloadFile = asyncHandler(async (req, res) => {
        const entity = entityService.getEntityById(req.params.id);
        if (!entity) {
            throw new AppError('Entity not found', HTTP_STATUS.NOT_FOUND);
        }
        return handleFileDownload(res, entity, req.params.filename);
    });

    /**
     * GET /api/entities/:id/matches
     * Retrieves all matches for a specific entity.
     * @param {Object} req - Express request object (req.params.id, req.query.role)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getMatches = asyncHandler(async (req, res) => {
        const entityId = parseInt(req.params.id);
        const role = req.query.role;
        const matches = matchService.getMatchesForEntity(entityId, role);
        res.json({ matches });
    });

    /**
     * GET /api/entities/:id/criteria
     * Retrieves criteria for a specific entity.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getCriteria = asyncHandler(async (req, res) => {
        const criteria = criteriaService.getCriteriaForEntity(req.params.id);
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
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    static triggerExtraction = asyncHandler(async (req, res) => {
        const entityId = parseInt(req.params.id);
        const { fileName } = req.body;
        
        // Controller updates HTTP-driven status; Service handles domain-specific extraction.
        entityService.updateEntityStatus(entityId, ENTITY_STATUS.PENDING);
        
        await entityService.triggerCriteriaExtraction(entityId, fileName);

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
    static openFolder = asyncHandler(async (req, res) => {
        const entityId = parseInt(req.params.id);
        entityService.openEntityFolder(entityId);
        res.json({ success: true });
    });

    /**
     * DELETE /api/entities/:id/extract
     * Cancels all pending or processing extraction tasks for an entity.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static cancelExtraction = asyncHandler(async (req, res) => {
        const entityId = parseInt(req.params.id);
        entityService.cancelExtraction(entityId);
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
    static getTopMatches = asyncHandler(async (req, res) => {
        const entityId = parseInt(req.params.id);
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || 20;

        const result = matchService.evaluateMatchesChunk(entityId, offset, limit);
        res.json(result);
    });

    /**
     * POST /api/entities/:id/retry
     * Retries the AI extraction process for a failed entity.
     * Clears error state, resets queue status to pending, and re-enqueues the processing task.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static retryProcessing = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);
        
        const entity = entityService.getEntityById(id);
        if (!entity) {
            throw new AppError('Entity not found', HTTP_STATUS.NOT_FOUND);
        }

        let fileName = entity.metadata?.processingFileName;
        const folderPath = entity.folderPath;

        // Fallback: If metadata was wiped, physically scan the directory for the original file
        if (!fileName && folderPath) {
            const fs = require('fs');
            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath);
                const uploadedFile = files.find(f => 
                    !f.endsWith('.md') && 
                    f !== 'raw-extraction.txt' && 
                    f !== '.DS_Store'
                );
                if (uploadedFile) {
                    fileName = uploadedFile;
                }
            }
        }

        if (!fileName || !folderPath) {
            throw new AppError('No processing file name found for retry. The file may have been deleted from the disk.', HTTP_STATUS.BAD_REQUEST);
        }

        entityService.updateEntityStatus(id, ENTITY_STATUS.PENDING);
        entityService.updateEntityError(id, null);

        queueService.enqueue(QUEUE_TASKS.PROCESS_ENTITY_DOCUMENT, { 
            entityId: id, 
            folderPath, 
            fileName 
        });

        logService.addActivityLog('Entity', id, LOG_LEVELS.INFO, `Retrying AI extraction for: ${fileName}.`, folderPath);

        res.json({ message: 'Queued for retry' });
    });
}

module.exports = EntityController;
