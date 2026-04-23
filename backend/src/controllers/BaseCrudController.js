/**
 * @module BaseCrudController
 * @description Abstract base controller providing standard CRUD operations for HTTP requests.
 * @responsibility
 * - Provides reusable getAll, getById, create, update, and delete methods.
 * - Handles async error wrapping, parameter parsing, and 404 checks.
 * - Delegates business logic to the injected service.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic (beyond parameter extraction).
 * - ❌ MUST NOT interact directly with Repositories.
 * - ✅ All business logic MUST be delegated to Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 *
 * @dependency_injection
 * Services are injected via the constructor using Constructor Injection pattern.
 */
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { handleFileDownload } = require('../utils/fileHandler');
const { HTTP_STATUS } = require('../config/constants');

/**
  * @class BaseCrudController
  * @abstract Base class for CRUD HTTP controllers.
  * @param {Object} config - Configuration object
  * @param {Object} config.service - The service instance for business logic delegation
  * @param {string} config.entityName - The entity name for error messages (e.g., 'Dimension', 'Blueprint')
  */
class BaseCrudController {
    /**
     * @constructor
     * @param {Object} config - Configuration object
     * @param {Object} config.service - The service instance
     * @param {string} config.entityName - Human-readable entity name for error messages
     * @param {Object} config.methodMap - Optional mapping of CRUD operation names to service method names
     * @param {Object} config.fileService - Optional FileService instance for file operations
     * @param {Object} config.queueService - Optional QueueService instance for retry task enqueuing
     * @param {string} config.retryTaskName - Optional queue task name for retry operation
     * @param {string} config.retryServiceMethod - Optional service method name for retry (e.g., 'retryMatchAssessment')
     */
    constructor({ service, entityName, methodMap = {}, fileService, queueService, retryTaskName, retryServiceMethod }) {
        this.service = service;
        this.entityName = entityName;
        this._fileService = fileService;
        this._queueService = queueService;
        this._retryTaskName = retryTaskName;
        this._retryServiceMethod = retryServiceMethod;

        this._methodMap = {
            getAll: methodMap.getAll || 'getAll',
            getById: methodMap.getById || 'getById',
            create: methodMap.create || 'create',
            update: methodMap.update || 'update',
            delete: methodMap.delete || 'delete'
        };
    }

    /**
     * Protected helper method to safely parse and validate the ID parameter from request.
     * Extracts req.params.id, parses it as an integer, and validates it is not NaN.
     *
     * @method _extractId
     * @memberof BaseCrudController
     * @param {Object} req - Express request object
     * @returns {number} The parsed and validated ID
     * @throws {AppError} With status 400 if ID is invalid or NaN
     *
     * @description
     * DRY consolidation method that eliminates boilerplate duplicate code for ID extraction
     * and validation across controller methods (getById, update, delete).
     *
     * @socexplanation
     * This method enforces the Controller Boilerplate Ban by centralizing the repetitive
     * pattern of parseInt(req.params.id) followed by NaN checks. It provides a single point
     * of validation that throws a consistent AppError with 400 status.
     */
    _extractId(req) {
        const { id } = req.params;
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            throw new AppError('Invalid ID format', HTTP_STATUS.BAD_REQUEST);
        }
        return parsedId;
    }

    _extractDto(_req) {
        throw new Error('_extractDto must be implemented by child controller to prevent req.body leakage');
    }

    /**
     * GET /
     * Retrieves all entities.
     * @method getAll
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with all entities
     */
    getAll = asyncHandler(async (req, res) => {
        const entities = this.service[this._methodMap.getAll]();
        res.json({ [this.entityName.toLowerCase() + 's']: entities });
    });

    /**
     * GET /:id
     * Retrieves a single entity by ID.
     * @method getById
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with the entity or 404 error
     */
    getById = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

        const entity = this.service[this._methodMap.getById](id);

        if (!entity) {
            throw new AppError(`${this.entityName} not found`, HTTP_STATUS.NOT_FOUND);
        }

        res.json({ [this.entityName.toLowerCase()]: entity });
    });

    /**
     * POST /
     * Creates a new entity.
     * @method create
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with created entity ID and 201 status
     */
    create = asyncHandler(async (req, res) => {
        const dto = this._extractDto(req);
        const newEntity = this.service[this._methodMap.create](dto);
        res.status(HTTP_STATUS.CREATED).json({ [this.entityName.toLowerCase()]: newEntity });
    });

    /**
     * PUT /:id
     * Updates an existing entity.
     * @method update
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with updated entity or 404 error
     */
    update = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        const dto = this._extractDto(req);

        const existing = this.service[this._methodMap.getById](id);
        if (!existing) {
            throw new AppError(`${this.entityName} not found`, HTTP_STATUS.NOT_FOUND);
        }

        const updatedEntity = this.service[this._methodMap.update](id, dto);
        res.json({ [this.entityName.toLowerCase()]: updatedEntity });
    });

    /**
     * DELETE /:id
     * Deletes an entity by ID.
     * @method delete
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with success message or 404 error
     */
    delete = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

        const existing = this.service[this._methodMap.getById](id);
        if (!existing) {
            throw new AppError(`${this.entityName} not found`, HTTP_STATUS.NOT_FOUND);
        }

        this.service[this._methodMap.delete](id);
        res.json({ success: true, message: `${this.entityName} deleted successfully` });
    });

    /**
     * GET /:id/files/:filename
     * Downloads a specific file from the entity's folder.
     * @method getFile
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} File stream to response
     *
     * @responsibility
     * - Extracts entity ID and filename from request parameters.
     * - Resolves absolute folder path via service.getEntityFolderPath.
     * - Streams file to response using handleFileDownload utility.
     *
     * @socexplanation
     * - Consolidates file download logic across EntityController and MatchController.
     * - Uses getEntityFolderPath to resolve absolute paths (handles staging vs vault logic).
     */
    getFile = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        const { filename } = req.params;

        if (!filename) {
            throw new AppError('Filename is required', HTTP_STATUS.BAD_REQUEST);
        }

        const absoluteFolderPath = this.service.getEntityFolderPath(id);

        if (!absoluteFolderPath) {
            throw new AppError('Could not resolve folder path for this entity.', HTTP_STATUS.NOT_FOUND);
        }

        return await handleFileDownload({
            fileService: this.service._fileService,
            res,
            entity: { absolutePath: absoluteFolderPath },
            fileName: filename,
            folderPathKey: 'absolutePath'
        });
    });

    /**
     * GET /:id/files
     * Lists all physical files in the entity's folder.
     * @method getFiles
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with files array
     *
     * @responsibility
     * - Extracts entity ID from request parameters.
     * - Calls service.listPhysicalFiles to get physical file listing.
     * - Returns JSON with files array.
     *
     * @boundary_rules
     * - ✅ Uses service.listPhysicalFiles for file listing.
     * - ❌ MUST NOT contain business logic.
     */
    getFiles = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

        const files = this.service.listPhysicalFiles(id);

        res.json({ files });
    });

    /**
     * POST /:id/folder/open
     * Opens the entity's folder in the native OS file manager.
     * @method openFolder
     */
    openFolder = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        this.service.openFolder(id);
        res.json({ success: true });
    });

    /**
     * POST /:id/retry
     * Retries a failed processing task by resetting state and re-enqueueing the task.
     * @method retry
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with retry status
     *
     * @responsibility
     * - Extracts entity ID from request parameters.
     * - Calls the configured service retry method to reset error state.
     * - Enqueues the configured retry task with required payload.
     *
     * @boundary_rules
     * - ✅ Uses configured retryServiceMethod for state reset.
     * - ✅ Uses configured retryTaskName for queue task.
     * - ❌ MUST NOT be used if retryTaskName or retryServiceMethod not configured.
     *
     * @socexplanation
     * - Consolidates retry logic that was duplicated in EntityController and MatchController.
     * - Requires retryTaskName and retryServiceMethod to be configured in constructor.
     */
    retry = asyncHandler(async (req, res) => {
        if (!this._retryTaskName || !this._retryServiceMethod) {
            throw new AppError('Retry endpoint not configured for this controller', HTTP_STATUS.NOT_FOUND);
        }

        const id = this._extractId(req);

        const entity = this.service[this._retryServiceMethod](id);

        const payload = this._buildRetryPayload(id, entity);

        this._queueService.enqueue(this._retryTaskName, payload);

        res.json({ success: true, message: 'Queued for retry' });
    });

    /**
     * Builds the payload for retry tasks. Override in child classes for custom payloads.
     * @method _buildRetryPayload
     * @param {number} id - The entity ID
     * @param {Object} entity - The entity object returned by retryServiceMethod
     * @returns {Object} The payload object for queue service
     * @protected
     */
    _buildRetryPayload(id, _entity) {
        return { entityId: id };
    }

    /**
     * POST /:id/master-file
     * Generates and writes the master file for an entity.
     * @method writeMasterFile
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with success status
     *
     * @responsibility
     * - Extracts entity ID from request parameters.
     * - Delegates master file generation to service.writeMasterFile.
     *
     * @socexplanation
     * - Consolidates master file generation logic that was duplicated in controllers.
     * - Simply extracts ID and calls the service method.
     */
    writeMasterFile = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

        await this.service.writeMasterFile(id);

        res.json({ success: true, message: 'Master file written successfully' });
    });

    /**
     * GET /:id/master-file
     * Fetches the generated master markdown file content for an entity.
     * @method getMasterFile
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with success status and file data
     *
     * @responsibility
     * - Extracts entity ID from request parameters.
     * - Delegates file content retrieval to service.readMasterFileContent.
     *
     * @socexplanation
     * - Consolidates master file retrieval logic that was previously duplicated across 3 controllers.
     * - Resolves property mismatch bugs by delegating resolution to the BaseEntityService.
     */
    getMasterFile = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

        // Delegate all lookups and file I/O to the service layer
        const content = await this.service.readMasterFileContent(id);

        res.json({ success: true, data: content });
    });
}

module.exports = BaseCrudController;