/**
 * @module AiModelRepo
 * @description Data Access Layer for the ai_models table.
 * @responsibility
 * - Executes all SQL CRUD queries related to AI models (providers, configurations).
 * - Maps raw SQLite rows into AI model objects.
 * - Provides role-based methods to get/set active models (one chat, one embedding).
 * - Extends BaseRepository for common CRUD operations.
 * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events.
 * - ❌ MUST NOT interact with the file system or AI.
 */

const BaseRepository = require('./BaseRepository');

class AiModelRepo extends BaseRepository {
    /**
     * Creates a new AiModelRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     */
    constructor({ db }) {
        super('ai_models', { db });
    }

    /**
     * Retrieves all AI models from the database.
     * @returns {Array<Object>} Array of AI model objects with all fields.
     */
    getAllModels() {
        const stmt = this.db.prepare('SELECT * FROM ai_models ORDER BY created_at DESC');
        const rows = stmt.all();
        return rows.map(row => this._mapRowToModel(row));
    }

    /**
     * Retrieves a single AI model by ID with custom mapping.
     * @param {number} id - The AI model ID.
     * @returns {Object|null} AI model object or null if not found.
     */
    getModelById(id) {
        const row = super.findById(id);
        return row ? this._mapRowToModel(row) : null;
    }

    /**
     * Deletes an AI model by ID.
     * @param {number} id - The AI model ID to delete.
     * @returns {boolean} True if deleted, false if not found.
     * @throws {Error} If attempting to delete a system model.
     */
    deleteModel(id) {
        const existing = this.getModelById(id);
        if (!existing) {
            return false;
        }

        if (existing.isSystem) {
            throw new Error('Cannot delete system model');
        }

        const result = super.deleteById(id);
        return result.changes > 0;
    }

    /**
     * Sets a model as the active model within its role.
     * Deactivates only other models with the same role, then activates the target model.
     * @param {number} id - The AI model ID to set as active.
     * @returns {boolean} True if successful, false if model not found.
     */
    setActiveModel(id) {
        const targetModel = this.getModelById(id);
        if (!targetModel) {
            return false;
        }

        const transaction = this.db.transaction(() => {
            this.db.prepare('UPDATE ai_models SET is_active = 0 WHERE role = ?').run(targetModel.role);
            this.db.prepare('UPDATE ai_models SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
        });

        transaction();
        return true;
    }

    /**
     * Retrieves the active AI model for a given role.
     * @param {string} role - The role ('chat' or 'embedding').
     * @returns {Object|null} The active AI model object or null if none found.
     */
    getActiveModelByRole(role) {
        const stmt = this.db.prepare('SELECT * FROM ai_models WHERE is_active = 1 AND role = ? LIMIT 1');
        const row = stmt.get(role);
        return row ? this._mapRowToModel(row) : null;
    }

    /**
     * Creates a new AI model.
     * @param {Object} data - The AI model data.
     * @returns {number} The ID of the newly inserted model.
     */
    createModel(data) {
        const stmt = this.db.prepare(`
            INSERT INTO ai_models (name, model_identifier, api_url, api_key, role, temperature, context_window, is_active, is_system)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
        `);
        const result = stmt.run(
            data.name,
            data.model_identifier,
            data.api_url,
            data.api_key,
            data.role,
            data.temperature,
            data.contextWindow
        );
        return result.lastInsertRowid;
    }

    /**
     * Updates an existing AI model.
     * @param {number} id - The ID of the model to update.
     * @param {Object} aiModelDto - The updated data.
     * @returns {boolean} True if successfully updated, false otherwise.
     * @throws {Error} If attempting to update a system model.
     */
    updateModel(id, aiModelDto) {
        const existing = this.getModelById(id);
        if (!existing) {
            return false;
        }

        if (existing.isSystem) {
            throw new Error('Cannot update system model');
        }

        const mappedDto = {
            name: aiModelDto.name,
            model_identifier: aiModelDto.model_identifier,
            api_url: aiModelDto.api_url,
            api_key: aiModelDto.api_key,
            role: aiModelDto.role,
            temperature: aiModelDto.temperature,
            context_window: aiModelDto.contextWindow
        };

        return super.update(id, mappedDto);
    }

    /**
     * Maps a database row to an AI model object.
     * @private
     * @param {Object} row - Raw database row.
     * @returns {Object} Mapped AI model object.
     */
    _mapRowToModel(row) {
        return {
            id: row.id,
            name: row.name,
            modelIdentifier: row.model_identifier,
            apiUrl: row.api_url,
            apiKey: row.api_key,
            role: row.role,
            isActive: row.is_active === 1,
            isSystem: row.is_system === 1,
            temperature: row.temperature,
            contextWindow: row.context_window,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

/**
 * @dependency_injection
 * AiModelRepo exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * @param {Object} deps - Dependencies object.
 * @param {Object} deps.db - The database instance (injected).
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = AiModelRepo;