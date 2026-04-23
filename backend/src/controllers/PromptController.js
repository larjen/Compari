/**
 * @module PromptController
 * @description HTTP Controller responsible for handling HTTP requests related to prompts.
 * Extends BaseCrudController to inherit standard CRUD operations while providing custom overrides.
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

const BaseCrudController = require('./BaseCrudController');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../config/constants');

class PromptController extends BaseCrudController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.promptService - The PromptService instance
     */
    constructor({ promptService }) {
        super({
            service: promptService,
            entityName: 'Prompt',
            methodMap: {
                getAll: 'getAllPrompts'
            }
        });
        this._promptService = promptService;
    }

    /**
     * GET /api/prompts
     * Retrieves all prompts.
     * @override
     * @socexplanation
     * Override maps to service.getAllPrompts() instead of default getAll().
     * Uses custom response format { prompts: [] } from service.
     */
    getAll = asyncHandler(async (req, res) => {
        const prompts = this.service.getAllPrompts();
        res.json({ prompts });
    });

    /**
     * PUT /api/prompts/:id
     * Updates a prompt's text content.
     * @socexplanation
     * Custom endpoint not in BaseCrudController - implements partial update logic.
     * Uses this._extractId(req) to comply with boilerplate ban (Rule 8.B).
     * Validates prompt content is provided before delegating to service.
     */
    updatePrompt = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        const { prompt } = req.body;

        if (!prompt) {
            throw new AppError('Prompt content is required', HTTP_STATUS.BAD_REQUEST);
        }

        const success = this._promptService.updatePrompt(id, prompt);
        if (!success) {
            throw new AppError('Prompt not found', HTTP_STATUS.NOT_FOUND);
        }

        const updatedPrompt = this._promptService.getPromptById(id);
        res.json({ prompt: updatedPrompt });
    });
}

module.exports = PromptController;