/**
 * @module PromptController
 * @description HTTP Controller responsible for handling HTTP requests related to prompts.
 *
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual data access to the Service layer (PromptService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 *
 * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ❌ MUST NOT handle raw file system operations.
 * - ✅ All data access MUST go through Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 *
 * @dependency_injection
 * Services are injected via the constructor using Constructor Injection pattern.
 * This replaces the previous static/service-locator anti-pattern.
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../config/constants');

class PromptController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.promptService - The PromptService instance
     */
    constructor({ promptService }) {
        this._promptService = promptService;
    }

    /**
     * GET /api/prompts
     * Retrieves all prompts.
     */
    getPrompts = asyncHandler(async (req, res, next) => {
        const prompts = this._promptService.getAllPrompts();
        res.json({ prompts });
    });

    /**
     * PUT /api/prompts/:id
     * Updates a prompt's text content.
     */
    updatePrompt = asyncHandler(async (req, res, next) => {
        const { id } = req.params;
        const { prompt } = req.body;

        if (!prompt) {
            throw new AppError('Prompt content is required', HTTP_STATUS.BAD_REQUEST);
        }

        const success = this._promptService.updatePrompt(Number(id), prompt);
        if (!success) {
            throw new AppError('Prompt not found', HTTP_STATUS.NOT_FOUND);
        }

        const updatedPrompt = this._promptService.getPromptById(Number(id));
        res.json({ prompt: updatedPrompt });
    });
}

module.exports = PromptController;