/**
 * @module EntityService
 * @description Domain Service orchestration for unified Entity lifecycle.
 *
 * @responsibility
 * - Acts as the generic API for creating, updating, and retrieving entities.
 * - Handles entity file uploads and management.
 * - Wraps EntityRepo to abstract database concepts.
 * - Supports both 'source' (user) and 'target' (job) entity types.
 *
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (FileService, LogService, EventService).
 * - ❌ MUST NOT call QueueService directly (queue orchestration is delegated to Controllers to enforce SoC and prevent circular dependencies).
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business rules or workflow logic (delegates to Workflows if needed).
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */
const path = require('path');
const { TRASHED_DIR, ENTITY_STATUS, APP_EVENTS, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');
const BaseEntityService = require('./BaseEntityService');
const HashGenerator = require('../utils/HashGenerator');

class EntityService extends BaseEntityService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.entityRepo - The EntityRepo instance
     * @param {Object} deps.fileService - The FileService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.eventService - The EventService instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ entityRepo, fileService, logService, eventService }) {
        super({ repository: entityRepo, eventService, logService, resourceName: 'Entity', getByIdMethod: 'getEntityById' });
        this._entityRepo = entityRepo;
        this._fileService = fileService;
        this._logService = logService;
        this._eventService = eventService;
    }

    /**
     * Retrieves all entities with pagination, search, and status filtering.
     * @method getAllEntities
     * @param {Object} params - Query parameters.
     * @param {string|null} [params.type] - Optional entity type filter ('requirement' or 'offering').
     * @param {number} [params.page=1] - Page number for pagination.
     * @param {number} [params.limit=12] - Number of items per page.
     * @param {string|null} [params.search] - Search term for filtering by name or description.
     * @param {string|null} [params.status] - Status filter.
     * @returns {Object} Object containing entities array and pagination metadata.
     */
    getAllEntities({ type, page = 1, limit = 12, search, status } = {}) {
        return this._entityRepo.getAllEntities({ type, page, limit, search, status });
    }

    /**
     * Retrieves a single entity by ID.
     * @method getEntityById
     * @param {number} id - The entity ID.
     * @returns {Entity|null} The Entity instance or null if not found.
     */
    getEntityById(id) {
        return this._entityRepo.getEntityById(id);
    }

    /**
     * Creates a new entity with a dedicated staging folder inside UPLOADS_DIR.
     * Entities are isolated in staging until the finalizeEntityWorkspace task completes.
     *
     * @method createEntity
     * @param {Object} entityDto - The entity DTO object.
     * @param {string} entityDto.type - The entity type ('requirement' or 'offering').
     * @param {string} entityDto.name - The entity name.
     * @param {string|null} [entityDto.description] - The entity description.
     * @param {string|null} [entityDto.folderPath] - Path to the entity's folder. If not provided, a staging folder inside UPLOADS_DIR is created.
     * @param {Object|null} [entityDto.metadata] - Flexible JSON data.
     * @param {number|null} [entityDto.blueprintId] - The blueprint ID to associate with this entity.
     * @returns {number} The ID of the newly created entity.
     *
     * @responsibility
     * - Creates a staging folder inside UPLOADS_DIR when no folderPath is provided.
     * - Ensures the entity is saved to the database with the staging folderPath.
     * - Keeps entities isolated from permanent vault until FINALIZE_ENTITY_WORKSPACE.
     *
     * @boundary_rules
     * - ✅ Creates staging folder in UPLOADS_DIR by default.
     * - ❌ MUST NOT create permanent vault folders (REQUIREMENTS_DIR/OFFERINGS_DIR) at this stage.
     */
    createEntity(entityDto) {
        const finalType = entityDto.entityType || entityDto.type;
        const finalName = entityDto.nicename || entityDto.name || 'Entity';
        const folderPath = entityDto.folderPath;
        
        let finalFolderPath = folderPath;
        if (!finalFolderPath) {
            finalFolderPath = this._fileService.prepareStagingDirectory(finalName);
        }

        const hash = HashGenerator.generateUniqueHash();
        const dtoWithFolderPath = { ...entityDto, entityType: finalType, nicename: finalName, folderPath: finalFolderPath, blueprintId: entityDto.blueprintId, hash };
        const entityId = this._entityRepo.createEntity(dtoWithFolderPath);

        try {
            this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `Entity '${finalName}' created in staging.`,
                folderPath: finalFolderPath
            });
        } catch (err) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'EntityService', message: `Failed to log entity creation: ${err.message}` });
        }

        return entityId;
    }

    /**
     * Deletes an entity by ID and moves its physical folder to the Trashed directory.
     * @method deleteEntity
     * @param {number} id - The entity ID to delete.
     * @socexplanation
     * - Coordinates between the Repository layer (for DB deletion) and the 
     * Infrastructure layer (FileService) to maintain data hygiene.
     * - File operations are wrapped in try/catch to ensure DB deletion succeeds 
     * even if the physical files are already missing.
     */
    deleteEntity(id) {
        const entity = this.getEntityById(id);
        
        // Move physical files to trash before deleting the database record
        if (entity && entity.folderPath) {
            try {
                const folderName = path.basename(entity.folderPath);
                const targetPath = path.join(TRASHED_DIR, folderName);
                this._fileService.moveDirectory(entity.folderPath, targetPath);
                this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.INFO, origin: 'EntityService', message: `Moved entity folder to trash: ${targetPath}` });
            } catch (err) {
                this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'EntityService', message: `Failed to move entity folder to trash (it may already be deleted): ${err.message}` });
            }
        }

        this._entityRepo.deleteById(id);
        this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED);
    }

    /**
     * Uploads multiple files for an entity by moving the temporarily uploaded files to the entity's current folder.
     * The entity's folder is expected to be in the staging area (UPLOADS_DIR).
     *
     * @method uploadEntityFiles
     * @param {number} entityId - The ID of the entity to upload the files for.
     * @param {Object[]} files - Array of file objects from Multer middleware.
     * @returns {string[]} Array of final paths where the files were moved.
     * @throws {Error} If entity is not found or file move operation fails.
     * 
     * @socexplanation
     * - Iterates through each file in the array and moves it to the entity's current folderPath (staging).
     * - Delegates file system operations to FileService via _files.moveFile to maintain SoC.
     * - Returns an array of moved file paths for the controller to return to the client.
     * - Does not finalize the folder - that happens at the end of the pipeline.
     */
    uploadEntityFiles(entityId, files) {
        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            throw new Error('Entity not found or has no folder path');
        }

        const destinationPath = entity.folderPath;
        const movedPaths = [];
        
        for (const file of files) {
            const safeFileName = require('path').basename(file.originalname);
            const movedPath = this._fileService.moveFile(file.path, destinationPath, safeFileName);
            if (!movedPath) {
                throw new Error(`Failed to move uploaded file: ${safeFileName}`);
            }
            movedPaths.push(movedPath);
        }
        
        return movedPaths;
    }

    /**
     * Uploads a file for an entity by moving the temporarily uploaded file to the entity's current folder.
     * The entity's folder is expected to be in the staging area (UPLOADS_DIR).
     *
     * @method uploadEntityFile
     * @param {number} entityId - The ID of the entity to upload the file for.
     * @param {Object} file - The file object from Multer middleware.
     * @returns {string} The final path where the file was moved.
     * @throws {Error} If entity is not found or file move operation fails.
     *
     * @socexplanation
     * - Moves file into the entity's current folderPath (which should be in staging).
     * - Does not finalize the folder - that happens at the end of the pipeline.
     */
    uploadEntityFile(entityId, file) {
        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            throw new Error('Entity not found or has no folder path');
        }

        const destinationPath = entity.folderPath;
        const safeFileName = require('path').basename(file.originalname);
        const movedPath = this._fileService.moveFile(file.path, destinationPath, safeFileName);
        
        if (!movedPath) {
            throw new Error('Failed to move uploaded file to entity folder');
        }
        
        return movedPath;
    }

    /**
     * Retrieves all files in an entity's folder.
     * @method getEntityFiles
     * @param {number} entityId - The entity ID.
     * @returns {Array<string>} Array of file names.
     */
    getEntityFiles(entityId) {
        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            return [];
        }

        return this._fileService.listFilesInFolder(entity.folderPath);
    }

    /**
     * Triggers AI criteria extraction for a specific file in the entity's folder.
     * @method triggerCriteriaExtraction
     * @param {number} entityId - The entity ID.
     * @param {string} fileName - The name of the file to extract criteria from.
     * @returns {Promise<void>}
     * @throws {Error} If entity is not found, file is missing, or AI is offline.
     */
    async triggerCriteriaExtraction(entityId, fileName) {
        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity) {
            throw new Error('Entity not found');
        }

        const entityFiles = this.getEntityFiles(entityId);
        if (!entityFiles.includes(fileName)) {
            throw new Error('File not found in entity folder');
        }

        this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `AI criteria extraction manually queued for file: ${fileName}`,
                folderPath: entity.folderPath
            });
    }

    /**
     * Cancels all pending or processing EXTRACT_ENTITY_CRITERIA tasks for an entity.
     * Transitions the entity to a failed state with a user-aborted message.
     * @method cancelExtraction
     * @param {number} entityId - The entity ID whose extraction tasks should be cancelled.
     * @returns {void}
     */
    cancelExtraction(entityId) {
        this.updateState(entityId, { status: ENTITY_STATUS.FAILED, error: 'User aborted the processing.' });
    }

    /**
     * Retrieves the original uploaded file name for an entity.
     * @method getOriginalUploadedFileName
     * @param {number} entityId - The entity ID.
     * @returns {string|null} The original uploaded file name, or null if not found.
     *
     * @workflow_steps
     * 1. First checks entity metadata for processingFileName.
     * 2. If not in metadata, scans the entity folder for non-markdown files.
     * 3. Filters out common generated files (raw-extraction.txt, .DS_Store).
     * 4. Returns the first matching uploaded file name.
     *
     * @socexplanation
     * - Encapsulates file system scanning logic that was previously in EntityController.
     * - Uses FileService.listFilesInFolder to enforce SoC.
     */
    getOriginalUploadedFileName(entityId) {
        const entity = this.getEntityById(entityId);
        if (!entity) {
            return null;
        }

        let fileName = entity.metadata?.processingFileName;
        const folderPath = entity.folderPath;

        if (!fileName && folderPath) {
            const files = this._fileService.listFilesInFolder(folderPath);
            const uploadedFile = files.find(f =>
                !f.endsWith('.md') &&
                f !== 'raw-extraction.txt' &&
                f !== '.DS_Store'
            );
            if (uploadedFile) {
                fileName = uploadedFile;
            }
        }

        return fileName;
    }

    /**
     * Retrieves all documents for an entity.
     * @method getDocumentsForEntity
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of document objects.
     */
    getDocumentsForEntity(entityId) {
        return this._entityRepo.getDocuments(entityId);
    }

    /**
     * Opens the entity's folder in the native OS file manager.
     * @method openEntityFolder
     * @param {number} entityId - The entity ID.
     */
    openEntityFolder(entityId) {
        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'EntityService', message: 'Cannot open folder: entity not found or has no folder path' });
            return;
        }
        this._fileService.openFolderInOS(entity.folderPath);
    }

    /**
     * Updates the core naming fields of an entity.
     * @method updateEntityDetails
     * @param {number} id - The entity ID.
     * @param {Object} details - DTO containing naming details.
     * @param {string} [details.name] - The core nicename.
     * @param {string} [details.niceNameLine1] - Line 1 description.
     * @param {string} [details.niceNameLine2] - Line 2 description.
     */
    updateEntityDetails(id, { name, niceNameLine1, niceNameLine2 }) {
        const existing = this.getEntityById(id);
        if (!existing) {
            throw new Error('Entity not found');
        }

        const finalName = name || existing.nicename;
        const finalLine1 = niceNameLine1 || existing.niceNameLine1 || 'Unknown';
        const finalLine2 = niceNameLine2 || existing.niceNameLine2 || 'Unknown';

        this._entityRepo.updateEntity(id, { name: finalName, niceNameLine1: finalLine1, niceNameLine2: finalLine2 });

        const updatedEntity = this.getEntityById(id);
        this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
    }
}

module.exports = EntityService;