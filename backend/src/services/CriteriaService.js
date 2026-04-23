/**
 * @module CriteriaService
 * @description Domain Service for criteria management - acts as the domain boundary between Controllers and Repositories.
 * Extends BaseEntityService to inherit CTI state machine capabilities while providing custom data access methods.
 *
 * @responsibility
 * - Wraps CriteriaRepo to provide a clean API for criteria data access.
 * - Translates repository data into domain models suitable for Controllers.
 * - Encapsulates all criteria-related data access behind this service layer.
 *
 * @boundary_rules
 * - ✅ MAY call Repositories (CriteriaRepo).
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business logic or workflow orchestration.
 * - ❌ MUST NOT emit events directly (use EventService if needed).
 * - ❌ MUST NOT interact with file system or AI services (delegate to appropriate services).
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const path = require('path');
const BaseEntityService = require('./BaseEntityService');
const { ENTITY_TYPES } = require('../config/constants');

class CriteriaService extends BaseEntityService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.criteriaRepo - The CriteriaRepo instance
     * @param {Object} deps.entityService - The EntityService instance
     * @param {Object} deps.eventService - The EventService instance for CTI state machine
     * @param {Object} deps.logService - The LogService instance for CTI state machine
     * @param {Object} deps.fileService - The FileService instance for file validation
     * @param {Object} deps.vectorMath - The VectorMath utility (injected)
     * @param {Object} deps.markdownGenerator - The MarkdownGenerator instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ criteriaRepo, entityService, eventService, logService, fileService, vectorMath, markdownGenerator }) {
        super({
            repository: criteriaRepo,
            eventService,
            logService,
            fileService,
            resourceName: 'Criterion',
            getByIdMethod: 'getCriterionById'
        });
        this._criteriaRepo = criteriaRepo;
        this._entityService = entityService;
        this._fileService = fileService;
        this._vectorMath = vectorMath;
        this._markdownGenerator = markdownGenerator;
    }

    /**
     * Creates a new criterion with a dedicated staging folder inside UPLOADS_DIR.
     * Uses the unified createStagedEntity base method to centralize staging lifecycle.
     *
     * @method createStagedCriterion
     * @param {Object} dto - The criterion data transfer object.
     * @param {string} dto.normalizedName - The normalized name for the criterion.
     * @param {string} dto.displayName - The display name for the criterion.
     * @param {string} dto.dimension - The dimension/category for the criterion.
     * @param {string} dto.dimensionDisplayName - The display name for the dimension.
     * @param {Array<number>} dto.embeddingArray - The AI-generated vector embedding.
     * @returns {number} The ID of the newly created criterion.
     *
     * @responsibility
     * - Creates a staging folder inside UPLOADS_DIR.
     * - Ensures the criterion is saved to the database with the staging folderPath.
     * - Generates unique hash for the criterion.
     * - Emits RESOURCE_STATE_CHANGED event for SSE updates.
     * - Logs the successful creation in staging.
     *
     * @boundary_rules
     * - ✅ Creates staging folder in UPLOADS_DIR by default.
     * - ✅ Uses base class createStagedEntity for unified staging lifecycle.
     * - ❌ MUST NOT create permanent vault folders at this stage.
     *
     * @socexplanation
     * Delegates staging lifecycle to the base class createStagedEntity method to eliminate
     * duplicated boilerplate for folder preparation, hash generation, event emission, and activity logging.
     * The embedding is passed through the dto and stored by the repository.
     */
    createStagedCriterion(dto, suppressEvent = false) {
        return this.createStagedEntity({
            entityType: require('../config/constants').ENTITY_TYPES.CRITERION,
            nicename: dto.displayName,
            normalizedName: dto.normalizedName,
            niceNameLine2: dto.dimensionDisplayName || dto.dimension
        }, {
            execute: (mergedDto) => {
                return this._criteriaRepo.insertSingleCriterion(mergedDto, dto.dimension, dto.embeddingArray);
            }
        }, suppressEvent);
    }

    /**
     * Retrieves paginated and filtered criteria from the database.
     * Implements server-side filtering, sorting, and pagination for scalable data access.
     *
     * @param {Object} options - Query options for pagination and filtering.
     * @param {number} [options.page=1] - The page number (1-indexed).
     * @param {number} [options.limit=300] - Number of items per page.
     * @param {string} [options.search] - Search term to match against displayName (case-insensitive).
     * @param {string} [options.dimension] - Optional dimension filter.
     * @returns {Object} Object containing criteria array, totalPages, and totalCount.
     *
     * @critical_sorting_rule
     * Results are sorted by dimension (alphabetically, nulls/uncategorized treated as last),
     * then by displayName (alphabetically). This sorting is applied BEFORE OFFSET/LIMIT
     * to ensure dimension grouping headers persist correctly across pages on the frontend.
     */
    getPaginatedCriteria({ page = 1, limit = 300, search, dimension } = {}) {
        return this._criteriaRepo.getPaginatedCriteria({ page, limit, search, dimension });
    }

    /**
     * Retrieves a criterion by its normalized name.
     * @param {string} normalizedName - The normalized criterion name to look up.
     * @returns {Object|null} Criterion object with id, normalizedName, displayName, and embedding (array), or null if not found.
     */
    getCriterionByName(normalizedName) {
        return this._criteriaRepo.getCriterionByName(normalizedName);
    }

    /**
     * Retrieves all criteria linked to a specific entity.
     * @method getCriteriaForEntity
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of criterion objects with normalizedName, displayName, isRequired flag, and embedding.
     */
    getCriteriaForEntity(entityId) {
        return this._criteriaRepo.getCriteriaForEntity(entityId);
    }

    /**
     * Retrieves all source and target entities associated with a specific criterion.
     * @param {number} criterionId - The criterion ID.
     * @returns {Object} Object containing sources and targets arrays.
     */
    getCriterionAssociations(criterionId) {
        return {
            sources: this._criteriaRepo.getAssociatedEntities(criterionId, ENTITY_TYPES.REQUIREMENT),
            targets: this._criteriaRepo.getAssociatedEntities(criterionId, ENTITY_TYPES.OFFERING)
        };
    }

    /**
     * Manually links a criterion to a requirement or offering entity.
     * @param {number} criterionId - The criterion ID.
     * @param {number} entityId - The entity ID.
     * @param {boolean} isRequired - True for requirements, false for offerings.
     * @socexplanation Prioritizes DB mutation and SSE emission. Wraps volatile File System operations 
     * in a try/catch to ensure the UI and DB remain in sync even if markdown generation fails.
     */
    async linkToEntity(criterionId, entityId, isRequired) {
        const wasAdded = this._criteriaRepo.linkCriterionToEntity(entityId, criterionId, isRequired);
        if (!wasAdded) return; // PERFORMANCE GUARD: Skip disk I/O and SSE if link already exists

        try {
            const linkedCriteria = this.getCriteriaForEntity(entityId);
            const criteriaFolderNames = linkedCriteria.map(c => this._entityService.getCleanLinkName(c));

            await this._entityService.writeMasterFile(entityId, criteriaFolderNames);
            await this.writeMasterFile(criterionId);
        } catch (err) {
            this._logService.logSystemFault({
                origin: 'CriteriaService',
                message: `Failed to update master files after linking criterion ${criterionId} to entity ${entityId}`,
                errorObj: err
            });
        }

        const updatedCriterion = this.getCriterionById(criterionId);
        if (updatedCriterion) {
            this._eventService.emit(require('../config/constants').APP_EVENTS.RESOURCE_STATE_CHANGED, updatedCriterion);
        }

        const updatedEntity = this._entityService.getById(entityId);
        if (updatedEntity) {
            this._eventService.emit(require('../config/constants').APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
        }
    }

    /**
     * Manually unlinks a criterion from a requirement or offering entity.
     * @param {number} criterionId - The criterion ID.
     * @param {number} entityId - The entity ID.
     * @socexplanation Prioritizes DB mutation and SSE emission. Wraps volatile File System operations 
     * in a try/catch to ensure the UI and DB remain in sync even if markdown generation fails.
     */
    async unlinkFromEntity(criterionId, entityId) {
        const wasRemoved = this._criteriaRepo.unlinkCriterionFromEntity(entityId, criterionId);
        if (!wasRemoved) return; // PERFORMANCE GUARD: Skip disk I/O and SSE if link did not exist

        try {
            const linkedCriteria = this.getCriteriaForEntity(entityId);
            const criteriaFolderNames = linkedCriteria.map(c => this._entityService.getCleanLinkName(c));

            await this._entityService.writeMasterFile(entityId, criteriaFolderNames);
            await this.writeMasterFile(criterionId);
        } catch (err) {
            this._logService.logSystemFault({
                origin: 'CriteriaService',
                message: `Failed to update master files after unlinking criterion ${criterionId} from entity ${entityId}`,
                errorObj: err
            });
        }

        const updatedCriterion = this.getCriterionById(criterionId);
        if (updatedCriterion) {
            this._eventService.emit(require('../config/constants').APP_EVENTS.RESOURCE_STATE_CHANGED, updatedCriterion);
        }

        const updatedEntity = this._entityService.getById(entityId);
        if (updatedEntity) {
            this._eventService.emit(require('../config/constants').APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
        }
    }

    /**
     * Deletes a criterion and its associations, cleaning up physical files.
     * @method deleteCriterion
     * @param {number} id - The criterion ID.
     * @returns {void}
     * @socexplanation Enforces full cleanup by deleting the physical staging/vault folder 
     * before deleting the database record, preventing permanent storage leaks. Emits a state change.
     */
    deleteCriterion(id) {
        this.deleteEntityFolder(id);
        this._criteriaRepo.deleteCriterion(id);
        this._eventService.emit(require('../config/constants').APP_EVENTS.RESOURCE_STATE_CHANGED);
    }

    /**
     * Finds top similar criteria using vector embeddings.
     * @param {number} criterionId - The target criterion ID.
     * @param {number} limit - Max results to return.
     * @returns {Array<Object>} Array of objects containing { criterion, score }.
     */
    getSimilarCriteria(criterionId, limit = 10) {
        const target = this._criteriaRepo.getCriterionById(criterionId);
        if (!target) throw new Error('Criterion not found');

        const all = this._criteriaRepo.getAllCriteriaWithEmbeddings();
        const similarities = [];

        for (const c of all) {
            if (c.id === criterionId) continue;
            try {
                const sim = this._vectorMath.cosineSimilarity(target.embedding, c.embedding);
                similarities.push({ criterion: c, score: Number(Math.max(0, sim).toFixed(4)) });
            } catch (e) {
                /** * @socexplanation 
                 * Replaced raw console.error with logSystemFault to ensure vector math 
                 * or data corruption failures are captured in the persistent audit trail. 
                 * Graceful degradation is maintained via the 'continue' statement.
                 */
                this._logService.logSystemFault({ 
                    origin: 'CriteriaService', 
                    message: `Failed to fetch similar criteria for ID ${criterionId}`, 
                    errorObj: e 
                });
                continue;
            }
        }

        return similarities.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    /**
     * Merges two criteria into one.
     * Records the merge history for audit purposes.
     *
     * @param {number} keepId - The ID to keep.
     * @param {number} removeId - The ID to remove.
     */
    mergeCriteria(keepId, removeId) {
        const removeCriterion = this._criteriaRepo.getCriterionById(removeId);
        if (!removeCriterion) {
            throw new Error('Criterion to remove not found');
        }
        
        this.deleteEntityFolder(removeId); 
        
        this._criteriaRepo.mergeCriteria(keepId, removeId, removeCriterion.displayName);
    }

    /**
     * Retrieves the merge history for a specific criterion.
     * Returns all previously merged criteria names that were consolidated into this one.
     *
     * @method getMergeHistory
     * @param {number} id - The criterion ID to get history for.
     * @returns {Array<Object>} Array of history records.
     */
    getMergeHistory(id) {
        return this._criteriaRepo.getMergeHistory(id);
    }

    /**
     * Retrieves a single criterion by ID for deep-linking.
     * Standardized name to match Repository and Controller expectations.
     * @method getCriterionById
     * @param {number} id - The unique identifier of the criterion.
     * @returns {Object|null} The criterion object or null if not found.
     */
    getCriterionById(id) {
        return this.getById(id);
    }

    /**
     * Resolves the master file path for a criterion at runtime.
     * Dynamically constructs the path using the folder_path and validates physical existence.
     * This enforces CTI pattern by deriving file locations at runtime rather than storing redundant paths.
     *
     * @method resolveMasterFilePath
     * @param {number} criterionId - The criterion ID.
     * @returns {string|null} The full path to the master file, or null if not found/not existing.
     *
     * @responsibility
     * - Dynamically resolves the master file path at runtime using folder_path.
     * - Validates physical existence of the file before returning.
     * - Eliminates redundant master_file column storage.
     *
     * @boundary_rules
     * - ❌ MUST NOT use master_file column from database.
     * - ❌ MUST NOT handle HTTP request/response objects.
     * - ❌ MUST NOT contain workflow orchestration.
     * - ✅ MUST validate file existence using FileService.
     *
     * @socexplanation
     * - Hydrates relative folder_path to absolute path using FileService.
     * - Applies naming convention: ${path.basename(folderPath)}.md
     * - Validates physical file existence to ensure data integrity.
     * - Returns null if folder path doesn't exist or file doesn't exist.
     */
    resolveMasterFilePath(criterionId) {
        const storedFolderPath = this._entityService.getEntityFolderPath(criterionId);
        if (!storedFolderPath) {
            return null;
        }

        const folderPath = this._fileService.resolveAbsoluteVaultPath(ENTITY_TYPES.CRITERION, storedFolderPath);
        if (!folderPath) {
            return null;
        }

        const fileName = `${path.basename(folderPath)}.md`;
        const fullPath = path.join(folderPath, fileName);

        if (!this._fileService.validatePath(fullPath)) {
            return null;
        }

        return fullPath;
    }

    /**
     * Ensures a criterion has a folder, creating it in the staging area if it doesn't exist.
     * @method ensureCriterionFolder
     * @param {number} criterionId - The criterion ID.
     * @param {boolean} [suppressEvent=false] - If true, suppresses the RESOURCE_STATE_CHANGED event.
     * @returns {string} The absolute path to the criterion's staging folder.
     * @responsibility Encapsulates physical path generation, ensuring criteria start in staging.
     * @socexplanation Refactored to follow "Tell, Don't Ask" principle. Service now encapsulates internal entity fetching, taking only an ID.
     */
    ensureCriterionFolder(criterionId, suppressEvent = false) {
        let folderPath = this.getEntityFolderPath(criterionId);
        if (!folderPath) {
            const criterion = this.getById(criterionId);
            const safeName = criterion ? (criterion.displayName || criterion.nicename || 'Unknown') : 'Unknown';
            folderPath = this._fileService.prepareStagingDirectory(
                ENTITY_TYPES.CRITERION,
                safeName
            );
            this.assignStagingFolder(criterionId, folderPath, suppressEvent);
        }
        return folderPath;
    }

    /**
     * Writes the master markdown file for a criterion.
     * @method writeMasterFile
     * @param {number} criterionId - The criterion ID.
     * @param {boolean} [suppressEvent=false] - If true, suppresses the RESOURCE_STATE_CHANGED event.
     * @returns {Promise<void>}
     */
    async writeMasterFile(criterionId, suppressEvent = false) {
        const criterion = this.getById(criterionId);
        if (!criterion) throw new Error(`Criterion not found: ${criterionId}`);

        this.ensureCriterionFolder(criterionId, suppressEvent);
        this.finalizeEntityWorkspace(criterionId, suppressEvent);

        const associations = this.getCriterionAssociations(criterionId);
        const similarCriteria = this.getSimilarCriteria(criterionId, 0);
        const mergeHistory = this.getMergeHistory(criterionId);

        const generateContent = ({ folderName }) => {
            const reqFolderNames = (associations.sources || []).map(req => this._entityService.getCleanLinkName(req));
            const offFolderNames = (associations.targets || []).map(off => this._entityService.getCleanLinkName(off));
            const similarCriterionNames = similarCriteria.map(sim => sim.criterion.displayName);
            const mergedNames = (mergeHistory || []).map(h => h.merged_display_name);

            return this._markdownGenerator.generateCriterionMaster({
                criterionId: criterion.id,
                criterionFolderName: folderName,
                dimension: criterion.dimension,
                dimensionDisplayName: criterion.dimensionDisplayName || criterion.dimension,
                reqFolderNames,
                offFolderNames,
                similarCriterionNames,
                mergedNames
            });
        };

        await this.generateAndSaveMasterDocument(criterionId, generateContent, suppressEvent);
    }
}

module.exports = CriteriaService;