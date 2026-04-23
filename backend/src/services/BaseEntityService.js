/**
 * @module BaseEntityService
 * @description Abstract base class for entity services providing unified state transition orchestration.
 *
 * @responsibility
 * - Provides a single `updateState` method that handles status, error, and isBusy updates.
 * - Emits a unified SSE event (`RESOURCE_STATE_CHANGED`) after any state mutation.
 * - Eliminates code duplication across EntityService and MatchService.
 * - Manages physical file system bindings for entity folders (lifecycle: move, rename, delete).
 *
 * @boundary_rules
 * - ✅ MAY emit events via EventService.
 * - ✅ MAY call FileService for folder lifecycle operations.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business logic or workflow orchestration.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor.
 */
const path = require('path');
const { TRASHED_DIR, UPLOADS_DIR, APP_EVENTS, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');
const HashGenerator = require('../utils/HashGenerator');
const NameGenerator = require('../utils/NameGenerator');

class BaseEntityService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.repository - The repository instance (EntityRepo or MatchRepo)
     * @param {Object} deps.eventService - The EventService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.fileService - The FileService instance (optional)
     * @param {string} deps.resourceName - The resource name for logging ('Entity' or 'Match')
     * @param {string} deps.getByIdMethod - The method name to fetch the entity with full JOINed data
     */
    constructor({ repository, eventService, logService, fileService, resourceName, getByIdMethod }) {
        this._repository = repository;
        this._eventService = eventService;
        this._logService = logService;
        this._fileService = fileService;
        this._resourceName = resourceName;
        this._getByIdMethod = getByIdMethod;
    }

    /**
     * Standard CRUD: Retrieves all entities from the repository.
     * @method getAll
     * @returns {Array<Object>} List of all entities.
     * @socexplanation Delegates generic read operations to the repository.
     */
    getAll() {
        return this._repository.getAll();
    }

    /**
     * Standard CRUD: Retrieves a single entity by ID.
     * @method getById
     * @param {number} id - The entity ID.
     * @returns {Object} The complete entity object with JOINs applied.
     * @socexplanation Utilizes the configured _getByIdMethod to ensure fully populated data structures are returned.
     */
    getById(id) {
        return this._repository[this._getByIdMethod](id);
    }

    /**
     * Asserts that an entity exists, throwing an error if it does not.
     * @param {number} id - The entity ID.
     * @throws {Error} If the entity is not found.
     */
    assertExists(id) {
        if (!this.getById(id)) {
            throw new Error(`${this._resourceName} not found`);
        }
    }

    /**
     * Standard CRUD: Creates a new entity.
     * @method create
     * @param {Object} dto - The validated Data Transfer Object.
     * @returns {number} The ID of the newly created entity.
     * @socexplanation Passes mapped DTOs down to the data access layer.
     */
    create(dto) {
        return this._repository.create(dto);
    }

    /**
     * Template Method: Orchestrates the complete staging lifecycle for entity creation.
     * Centralizes boilerplate for preparing staging folders, generating hashes, emitting events,
     * and logging activity to prevent code duplication across EntityService, MatchService, and CriteriaService.
     *
     * @method createStagedEntity
     * @param {Object} baseDto - The base data transfer object containing entityType and nicename.
     * @param {string} baseDto.entityType - The entity type (e.g., 'requirement', 'offering', 'match', 'criterion').
     * @param {string} baseDto.nicename - The display name for the entity.
     * @param {Function} repoInsertStrategy - Callback function that executes the repository-specific insert operation.
     * @param {Function} repoInsertStrategy.execute - Async function that receives the merged DTO and returns the inserted ID.
     * @returns {Promise<number>} The ID of the newly created entity.
     *
     * @responsibility
     * - Orchestrates the complete staging lifecycle: folder preparation → hash generation → DB insertion → event emission → activity logging.
     * - Prevents path leakage by extracting basename before storing in database.
     * - Centralizes error handling via logSystemFault to preserve stack traces.
     *
     * @boundary_rules
     * - ✅ Uses FileService.prepareStagingDirectory for folder creation.
     * - ✅ Uses HashGenerator.generateUniqueHash for unique identifiers.
     * - ✅ Uses EventService.emit for SSE state changes.
     * - ✅ Uses logService.logSystemFault for error logging.
     * - ❌ MUST NOT handle HTTP request/response objects directly.
     * - ❌ MUST NOT contain business logic or workflow orchestration beyond the staging lifecycle.
     *
     * @socexplanation
     * This method implements the Template Method pattern to eliminate duplicated boilerplate code.
     * Previously, each service (Entity, Match, Criteria) duplicated: prepareStagingDirectory, path.basename extraction,
     * hash generation, event emission, and activity logging. Now all services share this centralized implementation,
     * ensuring consistent behavior and easier maintenance. Only the repository-specific insertion logic varies per entity type.
     */
    async createStagedEntity(baseDto, repoInsertStrategy, suppressEvent = false) {
        const entityType = baseDto.entityType || baseDto.type;
        const rawNicename = baseDto.nicename || baseDto.name || 'Entity';

        const nicename = NameGenerator.sanitizeForFileSystem(rawNicename);

        const absoluteFolderPath = this._fileService.prepareStagingDirectory(entityType, nicename);
        const folderName = path.basename(absoluteFolderPath);

        const hash = HashGenerator.generateUniqueHash();

        const mergedDto = {
            ...baseDto,
            entityType,
            nicename,
            folderPath: folderName,
            hash,
            isStaged: 1 // Explicitly use integer 1 for SQLite compatibility
        };

        try {
            const insertedId = await repoInsertStrategy.execute(mergedDto);

            if (!suppressEvent) {
                const fetchedEntity = this.getById(insertedId);
                if (fetchedEntity) {
                    this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, fetchedEntity);
                }
            }

            this.logActivity(insertedId, {
                logType: LOG_LEVELS.INFO,
                message: `Entity '${nicename}' created in staging.`
            });

            return insertedId;
        } catch (err) {
            this._logService.logSystemFault({
                origin: this._resourceName + 'Service',
                message: `Failed to create staged entity '${nicename}'`,
                errorObj: err
            });
            throw err;
        }
    }

    /**
     * Standard CRUD: Updates an existing entity and broadcasts the change.
     * @method update
     * @param {number} id - The entity ID.
     * @param {Object} dto - The validated update Data Transfer Object.
     * @socexplanation Mutates data via repository and guarantees an SSE broadcast so the UI reflects the new state immediately.
     */
    update(id, dto) {
        this._repository.update(id, dto);
        const updatedEntity = this.getById(id);
        if (updatedEntity) {
            this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
        }
    }

    /**
     * Standard CRUD: Deletes an entity by ID.
     * @method delete
     * @param {number} id - The entity ID to delete.
     * @socexplanation Delegates destructive operations to the repository layer.
     */
    delete(id) {
        this._repository.delete(id);
    }

    /**
     * Unified state transition orchestrator.
     * Updates database via repository and emits a single unified SSE event.
     * @method updateState
     * @param {number} id - The entity ID.
     * @param {Object} stateDto - The state DTO.
     * @param {string} [stateDto.status] - New status.
     * @param {string|null} [stateDto.error] - New error message.
     * @param {boolean} [stateDto.isBusy] - Processing flag.
     */
    updateState(id, { status, error, isBusy }) {
        if (status !== undefined) {
            const sanitizedStatus = status.toLowerCase().trim();
            this._repository.updateStatus(id, sanitizedStatus);
        }
        if (error !== undefined) {
            this._repository.updateError(id, error);
        }
        if (isBusy !== undefined) {
            this._repository.updateIsBusy(id, isBusy ? 1 : 0);
        }

        const updatedEntity = this._repository[this._getByIdMethod](id);
        if (updatedEntity) {
            this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
        }
    }

    /**
     * Centralized facade for resolving an entity's absolute folder path.
     * Evaluates explicit is_staged column to route to either UPLOADS_DIR or the permanent Vault.
     * @method getEntityFolderPath
     * @param {number} id - The entity ID.
     * @returns {string|null} The fully resolved absolute folder path, or null if not found.
     *
     * @responsibility
     * - Acts as the Single Source of Truth for absolute path resolution across the application.
     * - Evaluates explicit is_staged column to determine storage location.
     *
     * @boundary_rules
     * - ✅ MUST be used by all workflows and controllers needing physical file access.
     * - ❌ MUST NOT be bypassed by manually joining paths in the Workflow layer.
     *
     * @socexplanation
     * Abstracts the "Staging vs Vault" complexity away from Workflows. Workflows simply
     * ask for the path and receive the correct location based on the entity's current lifecycle state.
     */
    getEntityFolderPath(id) {
        const entity = this.getById(id);
        if (!entity || !entity.folder_path && !entity.folderPath) return null;

        const storedPath = entity.folder_path || entity.folderPath;

        if (storedPath.includes('/') || storedPath.includes('\\')) {
            return storedPath;
        }

        const isStaged = entity.is_staged === 1 || entity.isStaged === true;
        if (isStaged) {
            return path.join(UPLOADS_DIR, storedPath);
        }

        if (this._fileService && typeof this._fileService.resolveAbsoluteVaultPath === 'function') {
            return this._fileService.resolveAbsoluteVaultPath(entity.entity_type || entity.type || entity.entityType, storedPath);
        }

        return path.join(UPLOADS_DIR, storedPath);
    }

    /**
     * Resolves the absolute path to a file within an entity's folder.
     * Centralizes file-within-folder path resolution.
     *
     * @method resolveEntityFilePath
     * @memberof BaseEntityService
     * @param {number} id - The entity ID.
     * @param {string} fileName - The file name within the entity folder.
     * @returns {string|null} The absolute file path, or null if entity folder path is not found.
     *
     * @responsibility
     * - Centralizes file-within-folder path resolution.
     * - Returns null if entity folder path cannot be resolved.
     *
     * @boundary_rules
     * - ✅ Uses getEntityFolderPath for path resolution.
     * - ❌ MUST NOT contain business logic.
     */
    resolveEntityFilePath(id, fileName) {
        const absoluteFolderPath = this.getEntityFolderPath(id);
        if (!absoluteFolderPath) {
            return null;
        }
        return path.join(absoluteFolderPath, fileName);
    }

    /**
     * Gets a safe basename from an entity's folder path.
     * Centralizes entity name extraction for wiki links and headers.
     *
     * @method _getSafeBasename
     * @memberof BaseEntityService
     * @param {number} id - The entity ID.
     * @param {string} [fallback='Unknown'] - Fallback name if entity not found.
     * @returns {string} The folder basename or fallback.
     *
     * @responsibility
     * - Centralizes entity name extraction for consistent naming.
     * - Returns path.basename of folderPath if available.
     *
     * @boundary_rules
     * - ✅ Uses getEntityFolderPath for path resolution.
     * - ❌ MUST NOT contain business logic beyond name extraction.
     */
    _getSafeBasename(id, fallback = 'Unknown') {
        const folderPath = this.getEntityFolderPath(id);
        if (!folderPath) {
            return fallback;
        }
        return path.basename(folderPath);
    }

    /**
     * Lists all physical files in the entity's folder.
     * Centralizes file listing for physical disk files.
     *
     * @method listPhysicalFiles
     * @memberof BaseEntityService
     * @param {number} id - The entity ID.
     * @returns {Array<string>} Array of file names in the entity's folder.
     *
     * @responsibility
     * - Returns an array of filenames from the entity's physical folder.
     * - Returns empty array if folder path cannot be resolved.
     *
     * @boundary_rules
     * - ✅ Uses getEntityFolderPath for path resolution.
     * - ✅ Uses FileService.listFilesInFolder for file listing.
     * - ❌ MUST NOT handle business logic.
     */
    listPhysicalFiles(id) {
        const absoluteFolderPath = this.getEntityFolderPath(id);
        if (!absoluteFolderPath) {
            return [];
        }
        return this._fileService.listFilesInFolder(absoluteFolderPath);
    }

    /**
     * Updates the folder path for an entity and internally resolves staging status.
     * Automatically extracts the basename and ensures absolute paths never leak into the database.
     * @method updateFolderPath
     * @param {number} id - The entity ID.
     * @param {string} absolutePath - The new absolute folder path.
     * @param {boolean} [suppressEvent=false] - If true, suppresses the RESOURCE_STATE_CHANGED event.
     *
     * @responsibility
     * - Encapsulates path updates and internally resolves staging status via prefix detection
     *   to enforce TDA and prevent path leakage.
     * - If folderName starts with "[Staging]", isStaged is true; otherwise false.
     *
     * @boundary_rules
     * - ✅ MUST extract basename from absolute path before DB write.
     * - ❌ MUST NOT store absolute paths in database.
     */
    updateFolderPath(id, absolutePath, suppressEvent = false) {
        const folderName = path.basename(absolutePath);

        const entity = this.getById(id);
        if (!entity) return;

        const newIsStaged = folderName.startsWith('[Staging]') ? 1 : 0;

        if (this._repository.updateEntity) {
            this._repository.updateEntity(id, { folderPath: folderName, isStaged: newIsStaged });
        } else if (this._repository.updateFolderPath) {
            this._repository.updateFolderPath(id, folderName);
            if (this._repository.updateIsStaged) {
                this._repository.updateIsStaged(id, newIsStaged);
            }
        }

        if (!suppressEvent) {
            const updatedEntity = this._repository[this._getByIdMethod](id);
            if (updatedEntity) {
                this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
            }
        }
    }

    /**
     * Updates the folder path for an entity and explicitly sets is_staged to true.
     * Automatically extracts the basename and ensures absolute paths never leak into the database.
     * @method assignStagingFolder
     * @param {number} id - The entity ID.
     * @param {string} absolutePath - The absolute staging folder path.
     * @param {boolean} [suppressEvent=false] - If true, suppresses the RESOURCE_STATE_CHANGED event.
     * @responsibility Centralizes staging folder assignment for all CTI entities to ensure they start in UPLOADS_DIR.
     * @boundary_rules MUST NOT store absolute paths in the database. MUST set isStaged to true.
     */
    assignStagingFolder(id, absolutePath, suppressEvent = false) {
        const folderName = require('path').basename(absolutePath);
        const entity = this.getById(id);
        if (!entity) return;

        if (this._repository.updateEntity) {
            this._repository.updateEntity(id, { folderPath: folderName, isStaged: true });
        } else if (this._repository.updateFolderPath) {
            this._repository.updateFolderPath(id, folderName);
            if (this._repository.updateIsStaged) {
                this._repository.updateIsStaged(id, true);
            }
        }

        if (!suppressEvent) {
            const updatedEntity = this._repository[this._getByIdMethod](id);
            if (updatedEntity) {
                this._eventService.emit(require('../config/constants').APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
            }
        }
    }

    /**
     * Moves the entity's physical folder to a new absolute path and updates the database.
     * @method moveEntityFolder
     * @param {number} id - The entity ID.
     * @param {string} newAbsolutePath - The new absolute folder path.
     *
     * @responsibility
     * - Physically moves the folder using FileService.
     * - Updates the database record with the new path.
     *
     * @boundary_rules
     * - ✅ MUST call updateFolderPath to ensure basename extraction.
     */
    moveEntityFolder(id, newAbsolutePath) {
        const currentPath = this.getEntityFolderPath(id);
        if (!currentPath) {
            throw new Error(`Cannot move folder: entity ${id} has no folder path`);
        }

        this._fileService.moveDirectory(currentPath, newAbsolutePath);
        this.updateFolderPath(id, newAbsolutePath);
    }

    /**
     * Renames the entity's folder within the same parent directory.
     * @method renameEntityFolder
     * @param {number} id - The entity ID.
     * @param {string} newFolderName - The new folder name (not full path).
     *
     * @responsibility
     * - Calculates new absolute path within same parent directory.
     * - Calls moveEntityFolder to perform the move.
     *
     * @boundary_rules
     * - ✅ MUST maintain same parent directory.
     */
    renameEntityFolder(id, newFolderName) {
        const currentPath = this.getEntityFolderPath(id);
        if (!currentPath) {
            throw new Error(`Cannot rename folder: entity ${id} has no folder path`);
        }

        const parentDir = path.dirname(currentPath);
        const newAbsolutePath = path.join(parentDir, newFolderName);

        this.moveEntityFolder(id, newAbsolutePath);
    }

    /**
     * Safely moves the entity's folder to TRASHED_DIR with a timestamped name.
     * @method deleteEntityFolder
     * @param {number} id - The entity ID.
     *
     * @responsibility
     * - Resolves current absolute path.
     * - Moves folder to TRASHED_DIR with timestamp to prevent naming conflicts.
     *
     * @boundary_rules
     * - ✅ MUST use timestamped folder name to prevent overwrites.
     */
    deleteEntityFolder(id) {
        const currentPath = this.getEntityFolderPath(id);
        if (!currentPath) {
            return;
        }

        try {
            const folderName = path.basename(currentPath);
            const timestampedName = `${folderName}_${Date.now()}`;
            const trashPath = path.join(TRASHED_DIR, timestampedName);
            this._fileService.moveDirectory(currentPath, trashPath);
        } catch (err) {
            this._logService.logTerminal({
                status: 'WARN',
                symbolKey: 'WARNING',
                origin: this._resourceName + 'Service',
                message: `Failed to move folder to trash (may already be deleted): ${err.message}`,
                errorObj: err
            });
        }
    }

    /**
     * Updates the master_file column and emits state change.
     * @method updateMasterFile
     * @param {number} id - The entity ID.
     * @param {string} fileName - The master file name (e.g., 'master.md').
     * @param {boolean} [suppressEvent=false] - If true, suppresses the RESOURCE_STATE_CHANGED event.
     */
    updateMasterFile(id, fileName, suppressEvent = false) {
        this._repository.updateMasterFile(id, fileName);
        if (!suppressEvent) {
            const updatedEntity = this._repository[this._getByIdMethod](id);
            if (updatedEntity) {
                this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
            }
        }
    }

    /**
     * Centralized master document generation and persistence lifecycle.
     * Generates content via the passed generator function, saves to filesystem,
     * updates the database record, and logs the activity.
     *
     * @method generateAndSaveMasterDocument
     * @param {number} id - The entity ID.
     * @param {Function} contentGeneratorFn - Function that returns the content string to write.
     * @param {boolean} [suppressEvent=false] - If true, suppresses the RESOURCE_STATE_CHANGED event.
     * @returns {string} The file name of the saved master document.
     *
     * @responsibility
     * - Centralizes the file saving and DB update lifecycle for all entity types.
     * - Eliminates duplicated logic across EntityService, MatchService, and CriteriaManagerWorkflow.
     *
     * @boundary_rules
     * - ✅ Uses getEntityFolderPath to resolve absolute paths (Single Source of Truth).
     * - ✅ Uses FileService.saveTextFile for filesystem operations.
     * - ✅ Uses updateMasterFile for database persistence.
     * - ✅ Logs activity via logService.
     *
     * @socexplanation
     * - Workflows pass a content generator function, avoiding code duplication.
     * - The base method handles all the common lifecycle steps in one place.
     */
    async generateAndSaveMasterDocument(id, contentGeneratorFn, suppressEvent = false) {
        const absoluteFolderPath = this.getEntityFolderPath(id);
        if (!absoluteFolderPath) {
            throw new Error(`${this._resourceName} not found or has no folder path`);
        }

        const entity = this.getById(id);
        const finalFolderName = path.basename(absoluteFolderPath);
        const fileName = `${finalFolderName}.md`;

        const mdContent = contentGeneratorFn({ entity, folderName: finalFolderName, fileName });

        await this._fileService.saveTextFile(absoluteFolderPath, fileName, mdContent);

        this.updateMasterFile(id, fileName, suppressEvent);

        this.logActivity(id, {
            logType: LOG_LEVELS.INFO,
            message: `Master file generated: ${fileName}`
        });

        return fileName;
    }

    /**
     * Performs a partial update to the entity's metadata by merging new data with existing.
     * Automatically handles JSON merging, persistence via repository, and SSE notification.
     * @method updateMetadata
     * @memberof BaseEntityService
     * @param {number} id - The entity ID.
     * @param {Object} partialMetadata - Key-value pairs to merge into existing metadata.
     * @throws {Error} If the entity is not found.
     * @socexplanation
     * - Centralizes the fetch-merge-save pattern to ensure data integrity.
     * - Ensures every metadata change triggers a RESOURCE_STATE_CHANGED event for UI sync.
     */
    updateMetadata(id, partialMetadata) {
        const existing = this._repository[this._getByIdMethod](id);
        if (!existing) {
            const err = new Error(`${this._resourceName} not found. It may have been deleted.`);
            err.isFatalClientError = true;
            throw err;
        }

        const mergedMetadata = {
            ...(existing.metadata || {}),
            ...partialMetadata
        };

        this._repository.updateMetadata(id, mergedMetadata);

        const updated = this._repository[this._getByIdMethod](id);
        if (updated) {
            this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updated);
        }
    }

    registerDocumentRecord({ entityId, docType, fileName }) {
        this._repository.registerDocumentRecord({ entityId, docType, fileName });
    }

    /**
     * Logs an activity to the entity's dedicated activity.jsonl file.
     * Automatically resolves the absolute folder path to prevent path leakage bugs.
     * @method logActivity
     * @param {number} id - The entity ID.
     * @param {Object} logDto - The log data transfer object.
     * @param {string} logDto.logType - The log level (e.g., LOG_LEVELS.INFO, LOG_LEVELS.ERROR).
     * @param {string} logDto.message - The log message.
     * @param {Object|Error|null} [logDto.verboseDetails] - Optional debug details.
     * @returns {Object|null} The log entry object or null if it failed.
     * @socexplanation
     * Centralizes activity logging at the Base Entity level. This prevents Workflows from
     * having to manually resolve absolute paths, eliminating bugs where logs leak into the 
     * root directory because a relative basename was passed to the LogService.
     */
    logActivity(id, { logType, message, verboseDetails = null }) {
        const absoluteFolderPath = this.getEntityFolderPath(id);
        
        return this._logService.addActivityLog({
            entityType: this._resourceName,
            entityId: id,
            logType,
            message,
            folderPath: absoluteFolderPath,
            verboseDetails
        });
    }

    /**
     * Resets the processing timer in the entity's metadata.
     * Centralizes the ISO string generation to prevent boilerplate in workflows.
     * @method resetProcessingTimer
     * @param {number} id - The entity ID.
     */
    resetProcessingTimer(id) {
        this.updateMetadata(id, { processingStartedAt: new Date().toISOString() });
    }

    /**
     * Finalizes the entity workspace by moving it from staging to the vault.
     * Automatically constructs the necessary arguments (nicename) from the entity's database record.
     * @method finalizeEntityWorkspace
     * @param {number} id - The entity ID.
     * @param {boolean} [suppressEvent=false] - If true, suppresses the RESOURCE_STATE_CHANGED event.
     * @returns {string} The final folder path.
     */
    finalizeEntityWorkspace(id, suppressEvent = false) {
        const entity = this.getById(id);
        if (!entity) throw new Error(`Entity ${id} not found.`);
        
        const currentStagingPath = this.getEntityFolderPath(id);
        if (!currentStagingPath) throw new Error(`Entity ${id} has no folder path.`);

        const entityType = entity.entityType || entity.type || 'entity';
        const nicename = entity.nicename || entity.displayName || entity.name || 'Unknown';

        const finalFolderPath = this._fileService.finalizeWorkspace({
            entityType,
            nicename,
            currentStagingPath
        });

        this.updateFolderPath(id, finalFolderPath, suppressEvent);
        return finalFolderPath;
    }

    /**
     * Retrieves all entities that are stuck in a processing state.
     * @method getStuckEntities
     * @returns {Array<Object>}
     */
    getStuckEntities() {
        return this._repository.getStuckEntities();
    }

    /**
     * Retrieves all document records for an entity.
     * @method getDocuments
     * @param {number} id - The entity ID.
     * @returns {Array<Object>} Array of document objects.
     * @responsibility Retrieves all document records for an entity.
     * @socexplanation Delegates data access to this._repository.getDocuments(id).
     */
    getDocuments(id) {
        return this._repository.getDocuments(id);
    }

    /**
     * Opens the entity's vault/staging folder in the host OS.
     * @method openFolder
     * @param {number} id - The entity ID.
     * @responsibility Opens the entity's vault/staging folder in the host OS.
     * @socexplanation Calls getEntityFolderPath to resolve the absolute path, then uses
     * fileService.openFolderInOS to open the folder in the native OS file manager.
     */
    openFolder(id) {
        const folderPath = this.getEntityFolderPath(id);
        if (!folderPath) {
            this._logService.logTerminal({
                status: LOG_LEVELS.WARN,
                symbolKey: LOG_SYMBOLS.WARNING,
                origin: this._resourceName + 'Service',
                message: `Cannot open folder: ${this._resourceName} not found or has no folder path`
            });
            return;
        }
        this._fileService.openFolderInOS(folderPath);
    }

    /**
     * Resolves the clean name for Obsidian Wiki Links.
     * If the entity is in staging, it uses the nicename (since the final folder isn't determined yet).
     * If the entity is finalized, it uses the folder path (which includes collision suffixes like '(1)').
     * @method getCleanLinkName
     * @param {Object} entity - The entity object or raw database row.
     * @returns {string} The clean link name.
     */
    getCleanLinkName(entity) {
        if (!entity) return 'Unknown';

        const isStaged = entity.isStaged === true || entity.is_staged === 1 || entity.is_staged === true || entity.is_staged === '1' ||
            (entity.folderPath && entity.folderPath.startsWith('[Staging]')) ||
            (entity.folder_path && entity.folder_path.startsWith('[Staging]'));

        if (isStaged) {
            return entity.nicename || entity.displayName || entity.name || 'Unknown';
        }

        const folder = entity.folderPath || entity.folder_path;
        if (folder) {
            return path.basename(folder);
        }

        return entity.nicename || entity.displayName || entity.name || 'Unknown';
    }

    /**
     * Reads and returns the content of the master markdown file for an entity.
     * @method readMasterFileContent
     * @param {number} id - The entity ID.
     * @returns {string} The raw markdown content.
     * @responsibility
     * - Centralizes file system retrieval for master documents across all CTI entities.
     * - Protects against property casing mismatches (masterFile vs master_file).
     * @boundary_rules
     * - ✅ MUST validate file existence via FileService.
     * - ❌ MUST NOT handle HTTP objects.
     */
    async readMasterFileContent(id) {
        const AppError = require('../utils/AppError');
        const { HTTP_STATUS } = require('../config/constants');

        const entity = this.getById(id);
        if (!entity) {
            throw new AppError(`${this._resourceName} not found`, HTTP_STATUS.NOT_FOUND);
        }

        // Account for Domain Models (camelCase) vs Raw SQLite rows (snake_case)
        const fileName = entity.masterFile || entity.master_file || entity.masterFilePath;

        if (!fileName) {
            throw new AppError('Master file has not been generated yet', HTTP_STATUS.NOT_FOUND);
        }

        const absoluteFolderPath = this.getEntityFolderPath(id);
        if (!absoluteFolderPath) {
            throw new AppError('Could not resolve entity folder path', HTTP_STATUS.NOT_FOUND);
        }

        const filePath = path.join(absoluteFolderPath, fileName);

        if (!this._fileService || !this._fileService.validatePath(filePath)) {
            throw new AppError('Master file not found on disk', HTTP_STATUS.NOT_FOUND);
        }

        return await this._fileService.readTextFile(filePath);
    }
}

module.exports = BaseEntityService;