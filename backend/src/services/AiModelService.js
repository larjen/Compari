/**
 * @module AiModelService
 * @description Domain Service that acts as the boundary between HTTP Controllers and the AiModelRepo.
 *
 * @responsibility
 * - Wraps AiModelRepo to provide a clean API for AI model data access.
 * - Translates repository data into domain models suitable for Controllers.
 * - Encapsulates all AI model-related data access behind this service layer.
 *
 * @boundary_rules
 * - ✅ MAY call Repositories (AiModelRepo).
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business logic or workflow orchestration.
 * - ❌ MUST NOT emit events directly.
 *
 * @socexplanation
 * - This service maintains the strict boundary between the HTTP controller layer and the database layer.
 * - Controllers should never directly import or interact with Repositories.
 * - All data access flows through this service to enforce separation of concerns.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

class AiModelService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.aiModelRepo - The AiModelRepo instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ aiModelRepo }) {
        this._aiModelRepo = aiModelRepo;
    }

    /**
     * Retrieves all AI models from the database.
     * @method getAll
     * @returns {Array<Object>} Array of AI model objects.
     */
    getAll() {
        return this._aiModelRepo.getAllModels();
    }

    /**
     * Retrieves a single AI model by ID.
     * @method getById
     * @param {number} id - The AI model ID.
     * @returns {Object|null} AI model object or null if not found.
     */
    getById(id) {
        return this._aiModelRepo.getModelById(id);
    }

    /**
     * Retrieves the active AI model for a given role.
     * @method getActive
     * @param {string} role - The role ('chat' or 'embedding').
     * @returns {Object|null} The active AI model object or null if none found.
     */
    getActive(role) {
        return this._aiModelRepo.getActiveModelByRole(role);
    }

    /**
     * Retrieves all active AI models (one per role).
     * @method getAllActive
     * @returns {Object} Object containing chat and embedding models.
     */
    getAllActive() {
        const chatModel = this.getActive('chat');
        const embeddingModel = this.getActive('embedding');
        return {
            chat: chatModel,
            embedding: embeddingModel
        };
    }

    /**
     * Creates a new AI model.
     * @method create
     * @param {Object} data - The AI model data.
     * @returns {number} The ID of the newly inserted model.
     */
    create(data) {
        return this._aiModelRepo.createModel(data);
    }

    /**
     * Updates an existing AI model.
     * @method update
     * @param {number} id - The ID of the model to update.
     * @param {Object} data - The updated data.
     * @returns {boolean} True if successfully updated, false otherwise.
     */
    update(id, data) {
        return this._aiModelRepo.updateModel(id, data);
    }

    /**
     * Deletes an AI model by ID.
     * @method delete
     * @param {number} id - The AI model ID to delete.
     * @returns {boolean} True if deleted, false if not found.
     * @throws {Error} If attempting to delete a system model.
     */
    delete(id) {
        return this._aiModelRepo.deleteModel(id);
    }

    /**
     * Sets a model as the active model within its role.
     * @method setActive
     * @param {number} id - The AI model ID to set as active.
     * @returns {boolean} True if successful, false if model not found.
     */
    setActive(id) {
        return this._aiModelRepo.setActiveModel(id);
    }
}

module.exports = AiModelService;