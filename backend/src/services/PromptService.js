/**
 * @module PromptService
 * @description Domain Service that acts as the boundary between HTTP Controllers and the PromptRepo.
 *
 * @responsibility
 * - Wraps PromptRepo to provide a clean API for prompt data access.
 * - Translates repository data into domain models suitable for Controllers.
 * - Encapsulates all prompt-related data access behind this service layer.
 *
 * @boundary_rules
 * - ✅ MAY call Repositories (PromptRepo).
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

class PromptService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.promptRepo - The PromptRepo instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ promptRepo }) {
        this._promptRepo = promptRepo;
    }

    /**
     * Retrieves all prompts from the database.
     * @method getAllPrompts
     * @returns {Array<Object>} Array of prompt objects.
     */
    getAllPrompts() {
        return this._promptRepo.getAllPrompts();
    }

    /**
     * Retrieves a single prompt by ID.
     * @method getPromptById
     * @param {number} id - The prompt ID.
     * @returns {Object|null} Prompt object or null if not found.
     */
    getPromptById(id) {
        return this._promptRepo.getPromptById(id);
    }

    /**
     * Retrieves a prompt by its system name.
     * @method getPromptBySystemName
     * @param {string} systemName - The system name of the prompt.
     * @returns {Object|null} Prompt object or null if not found.
     */
    getPromptBySystemName(systemName) {
        return this._promptRepo.getPromptBySystemName(systemName);
    }

    /**
     * Updates a prompt's text content.
     * @method updatePrompt
     * @param {number} id - The prompt ID.
     * @param {string} promptText - The new prompt text.
     * @returns {boolean} True if successfully updated, false otherwise.
     */
    updatePrompt(id, promptText) {
        return this._promptRepo.updatePrompt(id, promptText);
    }
}

module.exports = PromptService;