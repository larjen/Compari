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
 * @socexplanation
 * - This service provides a high-level API for entity management, coordinating between the repository and file infrastructure.
 * - It extends BaseEntityService to inherit unified state transition logic and resource broadcast capabilities.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */
const path = require('path');
const { ENTITY_STATUS, APP_EVENTS, LOG_LEVELS } = require('../config/constants');
const BaseEntityService = require('./BaseEntityService');
const NameGenerator = require('../utils/NameGenerator');
const MarkdownGenerator = require('../utils/MarkdownGenerator');

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
        super({ repository: entityRepo, eventService, logService, fileService, resourceName: 'Entity', getByIdMethod: 'getEntityById' });
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
     *
     * @socexplanation
     * Delegates staging lifecycle to the base class createStagedEntity method to eliminate
     * duplicated boilerplate for folder preparation, hash generation, event emission, and activity logging.
     */
    async createEntity(entityDto) {
        const finalType = entityDto.entityType || entityDto.type;
        const finalName = entityDto.nicename || entityDto.name || 'Entity';

        let finalMetadata = {};
        if (entityDto.metadata) {
            try {
                finalMetadata = typeof entityDto.metadata === 'string' ? JSON.parse(entityDto.metadata) : { ...entityDto.metadata };
            } catch (_error) {
                finalMetadata = {};
            }
        }

        const baseDto = {
            ...entityDto,
            entityType: finalType,
            nicename: finalName,
            blueprintId: entityDto.blueprintId,
            metadata: finalMetadata
        };

        return this.createStagedEntity(baseDto, {
            execute: (dto) => this._entityRepo.createEntity(dto)
        });
    }

    /**
     * Deletes an entity by moving its folder to trash and removing the database record.
     * @method deleteEntity
     * @param {number} id - The entity ID to delete.
     * @socexplanation
     * - Delegates folder lifecycle to base class method.
     * - File operations are wrapped in try/catch to ensure DB deletion succeeds 
     * even if the physical files are already missing.
     */
    deleteEntity(id) {
        this.deleteEntityFolder(id);
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
    async uploadEntityFiles(entityId, files) {
        const destinationPath = this.getEntityFolderPath(entityId);
        if (!destinationPath) {
            throw new Error('Could not resolve absolute folder path for entity');
        }

        const movedPaths = [];

        for (const file of files) {
            const safeFileName = path.basename(file.originalname);
            const movedPath = await this._fileService.moveFile(file.path, destinationPath, safeFileName);
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
    async uploadEntityFile(entityId, file) {
        const destinationPath = this.getEntityFolderPath(entityId);
        if (!destinationPath) {
            throw new Error('Could not resolve absolute folder path for entity');
        }

        const safeFileName = path.basename(file.originalname);
        const movedPath = await this._fileService.moveFile(file.path, destinationPath, safeFileName);

        if (!movedPath) {
            throw new Error('Failed to move uploaded file to entity folder');
        }
        
        return movedPath;
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

        const entityFiles = this.listPhysicalFiles(entityId);
        if (!entityFiles.includes(fileName)) {
            throw new Error('File not found in entity folder');
        }

        this.logActivity(entityId, {
                logType: LOG_LEVELS.INFO,
                message: `AI criteria extraction manually queued for file: ${fileName}`
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
     * Retries a failed entity processing by resetting error state and status.
     * @method retryProcessing
     * @param {number} entityId - The entity ID to retry.
     * @returns {Object} The entity object.
     */
    retryProcessing(entityId) {
        const entity = this.getEntityById(entityId);
        if (!entity) {
            throw new Error('Entity not found');
        }

        this.updateState(entityId, { status: ENTITY_STATUS.PENDING, error: null });

        this.logActivity(entityId, {
            logType: LOG_LEVELS.INFO,
            message: 'Retrying AI extraction process.'
        });

        return entity;
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
        const folderPath = this.getEntityFolderPath(entityId);

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
            const err = new Error('Entity not found. It may have been deleted.');
            err.isFatalClientError = true;
            throw err;
        }

        const rawName = name || existing.nicename;
        const finalName = NameGenerator.sanitizeForFileSystem(rawName);
        const finalLine1 = niceNameLine1 || existing.niceNameLine1 || 'Unknown';
        const finalLine2 = niceNameLine2 || existing.niceNameLine2 || 'Unknown';

        this._entityRepo.updateEntity(id, { name: finalName, niceNameLine1: finalLine1, niceNameLine2: finalLine2 });

        const updatedEntity = this.getEntityById(id);
        this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
    }

    /**
     * Updates the match score for an entity and broadcasts the change.
     * @method updateMatchScore
     * @param {number} id - The entity ID.
     * @param {number} matchScore - The new match score.
     */
    updateMatchScore(id, matchScore) {
        this._entityRepo.updateMatchScore(id, matchScore);
        const updated = this.getEntityById(id);
        if (updated) {
            this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updated);
        }
    }

    getEntityName(id) {
        const entity = this.getById(id);
        return entity ? (entity.nicename || entity.name || 'Unknown') : 'Unknown';
    }

    getEntityRole(id) {
        const entity = this.getById(id);
        return entity ? (entity.entityType || entity.type || 'offering') : 'offering';
    }

    getEntityBlueprintId(id) {
        const entity = this.getById(id);
        return entity ? entity.blueprintId : null;
    }

    getEntityMetadata(id) {
        const entity = this.getById(id);
        return entity ? (entity.metadata || {}) : {};
    }

/**
     * Generates and writes the master markdown file for an entity in its folder.
     * This is intended as a debug/utility function.
     * @method writeMasterFile
     * @param {number} entityId - The ID of the entity.
     * @param {Array<string>} [criteriaFolderNames=[]] - Optional array of criteria folder names for Wiki Links.
     * @returns {Promise<void>}
     * @responsibility 
     * - Manually regenerates the master markdown file for debugging or utility purposes.
     * - Merges entity metadata and verbatim extraction into a single markdown string.
     * @boundary_rules
     * - ❌ MUST NOT handle HTTP requests or responses.
     * - ✅ MUST delegate markdown generation to the pure utility `MarkdownGenerator`.
     * - ✅ MUST delegate file system operations and database updates to the base class `generateAndSaveMasterDocument` method.
     * @socexplanation
     * This method orchestrates the retrieval of entity data but delegates string formatting 
     * to a pure utility (`MarkdownGenerator`). It relies on the base class lifecycle method 
     * `generateAndSaveMasterDocument` to handle file I/O and database persistence, adhering to DRY principles.
     */
    async writeMasterFile(entityId, criteriaFolderNames = []) {
        const finalFolderPath = this.getEntityFolderPath(entityId);
        const folderName = path.basename(finalFolderPath);
        const masterFileName = `${folderName}.md`;
        const allFiles = this._fileService.listFilesInFolder(finalFolderPath) || [];
        const associatedFiles = allFiles.filter(f => f !== masterFileName);

        let verbatimContent = "";
        if (allFiles.includes('verbatim_extraction.md')) {
            const verbatimPath = path.join(finalFolderPath, 'verbatim_extraction.md');
            verbatimContent = await this._fileService.readTextFile(verbatimPath) || "";
        }

        const entity = this.getById(entityId);

        await this.generateAndSaveMasterDocument(entityId, ({ entity: callbackEntity, folderName: entityFolderName }) => {
            const targetEntity = callbackEntity.nicename !== undefined ? callbackEntity : entity;

            let parsedMetadata = {};
            if (typeof targetEntity.metadata === 'string') {
                try { 
                    parsedMetadata = JSON.parse(targetEntity.metadata); 
                } catch (_e) { 
                    // Fallback to the initial {} value if parsing fails
                }
            } else {
                parsedMetadata = targetEntity.metadata || {};
            }

            return MarkdownGenerator.generateEntityMaster({
                entityId: targetEntity.id,
                entityFolderName,
                entityType: targetEntity.entityType || targetEntity.type,
                metadata: parsedMetadata,
                verbatimContent,
                criteriaFolderNames,
                associatedFiles
            });
        });
    }

/**
      * Generates and saves the verbatim profile markdown file for an entity.
      * @method generateAndSaveVerbatimProfile
      * @param {number} entityId - The entity ID.
      * @param {string} rawText - The raw extracted text.
      * @param {string} verbatimPosting - The AI-generated verbatim profile.
      * @socexplanation Refactored to enforce "Tell, Don't Ask" (ID-First Resolution). Stripped entity data-fetching from the macro-orchestrator to prevent parameter creep and maintain strict boundary encapsulation.
      */
     async generateAndSaveVerbatimProfile(entityId, rawText, verbatimPosting) {
         const entity = this.getById(entityId);
         if (!entity) throw new Error(`Entity not found: ${entityId}`);

         const folderPath = this.getEntityFolderPath(entityId);
         if (!folderPath) throw new Error(`Entity ${entityId} has no folder path.`);

         const entityTitle = entity.nicename || 'Unknown Title';
         const entityDescription = entity.description || 'Unknown Organization';

         const mdContent = MarkdownGenerator.generateEntityProfile(entityTitle, entityDescription, {
             rawText,
             verbatimPosting
         });

         await this._fileService.saveTextFile(folderPath, 'verbatim_extraction.md', mdContent);
     }
}

module.exports = EntityService;