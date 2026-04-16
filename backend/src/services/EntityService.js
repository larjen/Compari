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
 * - ✅ MAY call QueueService for background task queuing.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business rules or workflow logic (delegates to Workflows if needed).
 */
const path = require('path');
const { REQUIREMENTS_DIR, OFFERINGS_DIR, QUEUE_TASKS, TRASHED_DIR, ENTITY_STATUS, ENTITY_ROLES, APP_EVENTS, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');
const logService = require('./LogService');
const eventService = require('./EventService');

class EntityService {
    constructor({
        entityRepo,
        fileService
    } = {}) {
        this._entityRepo = entityRepo;
        this._fileService = fileService;
    }

    get _repo() {
        if (!this._entityRepo) {
            this._entityRepo = require('../repositories/EntityRepo');
        }
        return this._entityRepo;
    }

    get _files() {
        if (!this._fileService) {
            this._fileService = require('./FileService');
        }
        return this._fileService;
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
        return this._repo.getAllEntities({ type, page, limit, search, status });
    }

    /**
     * Retrieves a single entity by ID.
     * @method getEntityById
     * @param {number} id - The entity ID.
     * @returns {Entity|null} The Entity instance or null if not found.
     */
    getEntityById(id) {
        return this._repo.getEntityById(id);
    }

    /**
     * Creates a new entity with a dedicated folder for files and logs.
     * @method createEntity
     * @param {string} type - The entity type ('source' or 'target').
     * @param {string} name - The entity name.
     * @param {string|null} [description] - The entity description.
     * @param {string|null} [folderPath] - Path to the entity's folder.
     * @param {Object|null} [metadata] - Flexible JSON data.
     * @param {number|null} [blueprintId] - The blueprint ID to associate with this entity.
     * @returns {number} The ID of the newly created entity.
     */
    createEntity(type, name, description, folderPath, metadata, blueprintId) {
        let finalFolderPath = folderPath;
        
        if (!finalFolderPath) {
            const timestamp = Date.now();
            const safeName = name.replace(/[^a-zA-Z0-9]/g, '');
            const folderName = `${timestamp}-${safeName}`;
            
            const baseDir = type === ENTITY_ROLES.REQUIREMENT ? REQUIREMENTS_DIR : OFFERINGS_DIR;
            finalFolderPath = path.join(baseDir, folderName);
            this._files.createDirectory(finalFolderPath);
        }

        const entityId = this._repo.createEntity(type, name, description, finalFolderPath, metadata, blueprintId);

        try {
            logService.addActivityLog('Entity', entityId, LOG_LEVELS.INFO, `Entity '${name}' created successfully.`, finalFolderPath);
        } catch (err) {
            logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'EntityService', `Failed to log entity creation: ${err.message}`);
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
        // Halt any background AI processing to prevent zombie tasks
        const queueService = require('./QueueService');
        queueService.cancelEntityExtractionTasks(id);

        const entity = this.getEntityById(id);
        
        // Move physical files to trash before deleting the database record
        if (entity && entity.folderPath) {
            try {
                const folderName = path.basename(entity.folderPath);
                const targetPath = path.join(TRASHED_DIR, folderName);
                this._files.moveDirectory(entity.folderPath, targetPath);
                logService.logTerminal(LOG_LEVELS.INFO, LOG_SYMBOLS.INFO, 'EntityService', `Moved entity folder to trash: ${targetPath}`);
            } catch (err) {
                logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'EntityService', `Failed to move entity folder to trash (it may already be deleted): ${err.message}`);
            }
        }

        this._repo.deleteById(id);
        eventService.emit(APP_EVENTS.ENTITY_UPDATE);
    }

    /**
     * Performs a partial update to an existing entity's metadata.
     * Merges new partialMetadata with existing metadata JSON object.
     * @method updateEntityMetadata
     * @param {number} id - The entity ID to update.
     * @param {Object} partialMetadata - The partial metadata to merge with existing.
     * @returns {void}
     * @throws {Error} If entity is not found.
     * @fires entityUpdate - Emits an event to trigger frontend refetch
     */
    updateEntityMetadata(id, partialMetadata) {
        const existingEntity = this._repo.getEntityById(id);
        if (!existingEntity) {
            throw new Error('Entity not found');
        }

        const existingMetadata = existingEntity.metadata || {};
        const mergedMetadata = {
            ...existingMetadata,
            ...partialMetadata
        };

        this._repo.updateEntityMetadata(id, mergedMetadata);
        
        eventService.emit(APP_EVENTS.ENTITY_UPDATE);
    }

    /**
     * Uploads multiple files for an entity by moving the temporarily uploaded files to the entity's folder.
     * @method uploadEntityFiles
     * @param {number} entityId - The ID of the entity to upload the files for.
     * @param {Object[]} files - Array of file objects from Multer middleware.
     * @returns {string[]} Array of final paths where the files were moved.
     * @throws {Error} If entity is not found or file move operation fails.
     * 
     * @socexplanation
     * - Iterates through each file in the array and moves it to the entity's folder.
     * - Delegates file system operations to FileService via _files.moveFile to maintain SoC.
     * - Returns an array of moved file paths for the controller to return to the client.
     */
    uploadEntityFiles(entityId, files) {
        const entity = this._repo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            throw new Error('Entity not found or has no folder path');
        }

        const destinationPath = entity.folderPath;
        const movedPaths = [];
        
        for (const file of files) {
            const movedPath = this._files.moveFile(file.path, destinationPath, file.filename);
            if (!movedPath) {
                throw new Error(`Failed to move uploaded file: ${file.filename}`);
            }
            movedPaths.push(movedPath);
        }
        
        return movedPaths;
    }

    /**
     * Uploads a file for an entity by moving the temporarily uploaded file to the entity's folder.
     * @method uploadEntityFile
     * @param {number} entityId - The ID of the entity to upload the file for.
     * @param {Object} file - The file object from Multer middleware.
     * @returns {string} The final path where the file was moved.
     * @throws {Error} If entity is not found or file move operation fails.
     */
    uploadEntityFile(entityId, file) {
        const entity = this._repo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            throw new Error('Entity not found or has no folder path');
        }

        const destinationPath = entity.folderPath;
        const movedPath = this._files.moveFile(file.path, destinationPath, file.filename);
        
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
        const entity = this._repo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            return [];
        }

        return this._files.listFilesInFolder(entity.folderPath);
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
        const entity = this._repo.getEntityById(entityId);
        if (!entity) {
            throw new Error('Entity not found');
        }

        const entityFiles = this.getEntityFiles(entityId);
        if (!entityFiles.includes(fileName)) {
            throw new Error('File not found in entity folder');
        }

        const aiService = require('./AiService');
        
        try {
            await aiService.isHealthy();
        } catch (error) {
            throw new Error('AI agent is not running, please start it.');
        }

        const queueService = require('./QueueService');
        queueService.enqueue(QUEUE_TASKS.EXTRACT_ENTITY_CRITERIA, { entityId, fileName });

        logService.addActivityLog('Entity', entityId, LOG_LEVELS.INFO, `AI criteria extraction manually queued for file: ${fileName}`, entity.folderPath);
    }

    /**
     * Cancels all pending or processing EXTRACT_ENTITY_CRITERIA tasks for an entity.
     * Transitions the entity to a failed state with a user-aborted message.
     * @method cancelExtraction
     * @param {number} entityId - The entity ID whose extraction tasks should be cancelled.
     * @returns {void}
     */
    cancelExtraction(entityId) {
        const queueService = require('./QueueService');
        queueService.cancelEntityExtractionTasks(entityId);
        
        // Explicitly set the failed status and the user aborted error message
        this.updateEntityStatus(entityId, ENTITY_STATUS.FAILED);
        this.updateEntityError(entityId, 'User aborted the processing.');
    }

    /**
     * Updates the status for an entity.
     * This is the single source of truth for entity processing state.
     * @method updateEntityStatus
     * @param {number} id - The entity ID.
     * @param {string} status - The new status (must conform to ENTITY_STATUS).
     * @socexplanation
     * - Sanitizes the status string to lowercase and trims whitespace before
     *   passing to the repository to prevent CHECK constraint violations
     *   due to casing issues.
     */
    updateEntityStatus(id, status) {
        const sanitizedStatus = status.toLowerCase().trim();
        this._repo.updateEntityStatus(id, sanitizedStatus);
        eventService.emit(APP_EVENTS.ENTITY_UPDATE);
    }

    /**
     * Updates the presentation-layer processing step without affecting status.
     * This safely updates the UI state for granular real-time feedback while keeping
     * the core status state machine intact for background worker semantics.
     * 
     * @method updateProcessingStep
     * @param {number} id - The entity ID.
     * @param {string|null} step - The processing step description (e.g., 'Extracting Metadata').
     *                              Pass null to clear the step.
     * @returns {void}
     */
    updateProcessingStep(id, step) {
        this.updateEntityMetadata(id, { processingStep: step });
        eventService.emit(APP_EVENTS.ENTITY_UPDATE);
    }

    /**
     * Updates an entity's error message, logs the failure to the activity log, and emits an update event.
     * @method updateEntityError
     * @param {number} id - The entity ID.
     * @param {string|null} error - The error message.
     */
    updateEntityError(id, error) {
        this._repo.updateEntityError(id, error);

        if (error) {
            const entity = this._repo.getEntityById(id);
            const folderPath = entity ? entity.folderPath : null;
            logService.addActivityLog('Entity', id, LOG_LEVELS.ERROR, `Processing failed: ${error}`, folderPath);
        }

        eventService.emit(APP_EVENTS.ENTITY_UPDATE);
    }

    /**
     * Registers a document record for an entity.
     * @method registerDocumentRecord
     * @param {number} entityId - The entity ID.
     * @param {string} docType - The document type.
     * @param {string} fileName - The file name.
     * @param {string} filePath - The file path.
     */
    registerDocumentRecord(entityId, docType, fileName, filePath) {
        this._repo.registerDocumentRecord(entityId, docType, fileName, filePath);
    }

    /**
     * Retrieves all documents for an entity.
     * @method getDocumentsForEntity
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of document objects.
     */
    getDocumentsForEntity(entityId) {
        return this._repo.getDocumentsForEntity(entityId);
    }

    /**
     * Deletes a log entry for an entity.
     * @method deleteLogEntry
     * @param {number} entityId - The entity ID.
     * @param {number} logId - The log entry ID to delete.
     */
    deleteLogEntry(entityId, logId) {
        const entity = this._repo.getEntityById(entityId);
        const folderPath = entity ? entity.folderPath : null;
        logService.deleteActivityLog(logId, folderPath);
    }

    /**
     * Opens the entity's folder in the native OS file manager.
     * @method openEntityFolder
     * @param {number} entityId - The entity ID.
     */
    openEntityFolder(entityId) {
        const entity = this._repo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'EntityService', 'Cannot open folder: entity not found or has no folder path');
            return;
        }
        this._files.openFolderInOS(entity.folderPath);
    }

    /**
     * Updates the root folder path for an entity after a directory move.
     * @method updateEntityFolderPath
     * @param {number} id - The entity ID.
     * @param {string} newFolderPath - The new absolute folder path.
     * * @socexplanation
     * - Maintains data integrity by ensuring the DB path matches the OS filesystem path.
     * - Delegates DB operations to the Repository layer.
     */
    updateEntityFolderPath(id, newFolderPath) {
        if (typeof this._repo.updateEntityFolderPath === 'function') {
            this._repo.updateEntityFolderPath(id, newFolderPath);
        } else {
            logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'EntityService', 'Repository missing updateEntityFolderPath method. Path sync may fail.');
        }
        eventService.emit(APP_EVENTS.ENTITY_UPDATE);
    }

    }

module.exports = new EntityService();
