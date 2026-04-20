/**
 * @module BaseEntityService
 * @description Abstract base class for entity services providing unified state transition orchestration.
 *
 * @responsibility
 * - Provides a single `updateState` method that handles status, error, and isBusy updates.
 * - Emits a unified SSE event (`RESOURCE_STATE_CHANGED`) after any state mutation.
 * - Eliminates code duplication across EntityService and MatchService.
 *
 * @boundary_rules
 * - ✅ MAY emit events via EventService.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business logic or workflow orchestration.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor.
 */
const { APP_EVENTS } = require('../config/constants');

class BaseEntityService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.repository - The repository instance (EntityRepo or MatchRepo)
     * @param {Object} deps.eventService - The EventService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {string} deps.resourceName - The resource name for logging ('Entity' or 'Match')
     * @param {string} deps.getByIdMethod - The method name to fetch the entity with full JOINed data
     */
    constructor({ repository, eventService, logService, resourceName, getByIdMethod }) {
        this._repository = repository;
        this._eventService = eventService;
        this._logService = logService;
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
     * Updates the folder path for an entity and broadcasts the state change.
     * @method updateFolderPath
     * @param {number} id - The entity ID.
     * @param {string} folderPath - The new folder path.
     * @socexplanation
     * - Centralizes the folder path update logic for all CTI entities.
     * - Ensures that moving an entity's folder triggers a UI sync via RESOURCE_STATE_CHANGED.
     * - Eliminates DRY violations across EntityService and MatchService.
     */
    updateFolderPath(id, folderPath) {
        this._repository.updateFolderPath(id, folderPath);
        const updatedEntity = this._repository[this._getByIdMethod](id);
        if (updatedEntity) {
            this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
        }
    }

    /**
     * Updates the master_file column and emits state change.
     * @method updateMasterFile
     * @param {number} id - The entity ID.
     * @param {string} fileName - The master file name (e.g., 'master.md').
     */
    updateMasterFile(id, fileName) {
        this._repository.updateMasterFile(id, fileName);
        const updatedEntity = this._repository[this._getByIdMethod](id);
        if (updatedEntity) {
            this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updatedEntity);
        }
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
            throw new Error(`${this._resourceName} not found`);
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
     * Retrieves all entities that are stuck in a processing state.
     * @method getStuckEntities
     * @returns {Array<Object>}
     */
    getStuckEntities() {
        return this._repository.getStuckEntities();
    }
}

module.exports = BaseEntityService;