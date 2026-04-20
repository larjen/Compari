/**
 * @module AiModelController
 * @description HTTP Controller responsible for handling HTTP requests related to AI models.
 *
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual data access to the Service layer (AiModelService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching via asyncHandler pattern.
 *
 * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ❌ MUST NOT handle raw file system operations.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 * - ✅ Uses asyncHandler to eliminate try/catch boilerplate.
 *
 * @dependency_injection
 * Services are injected via the constructor using Constructor Injection pattern.
 * This replaces the previous static/service-locator anti-pattern.
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class AiModelController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.aiModelService - The AiModelService instance
     * @param {Object} deps.aiService - The AiService instance
     * @param {Object} deps.logService - The LogService instance
     */
    constructor({ aiModelService, aiService, logService }) {
        this._aiModelService = aiModelService;
        this._aiService = aiService;
        this._logService = logService;
    }

    /**
     * GET /api/ai-models
     * Retrieves all AI models.
     */
    getAll = asyncHandler(async (req, res, next) => {
        const models = this._aiModelService.getAll();
        res.json({ models });
    });

    /**
     * GET /api/ai-models/:id
     * Retrieves an AI model by ID.
     */
    getById = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const model = this._aiModelService.getById(id);

        if (!model) {
            throw new AppError(`AI model with ID ${id} not found`, HTTP_STATUS.NOT_FOUND);
        }

        res.json({ model });
    });

    /**
     * POST /api/ai-models
     * Creates a new AI model.
     */
    create = asyncHandler(async (req, res, next) => {
        const { name, model_identifier, api_url, api_key, role, temperature, contextWindow } = req.body;

        const newModel = this._aiModelService.create({
            name,
            model_identifier,
            api_url,
            api_key,
            role,
            temperature,
            contextWindow
        });

        res.status(HTTP_STATUS.CREATED).json({ model: newModel });
    });

    /**
     * PUT /api/ai-models/:id
     * Updates an AI model.
     */
    update = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const { name, model_identifier, api_url, api_key, role, temperature, contextWindow } = req.body;

        const existing = this._aiModelService.getById(id);
        if (!existing) {
            throw new AppError(`AI model with ID ${id} not found`, HTTP_STATUS.NOT_FOUND);
        }

        const updatedModel = this._aiModelService.update(id, {
            name,
            model_identifier,
            api_url,
            api_key,
            role,
            temperature,
            contextWindow
        });

        res.json({ model: updatedModel });
    });

    /**
     * DELETE /api/ai-models/:id
     * Deletes an AI model by ID.
     */
    delete = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);

        const existing = this._aiModelService.getById(id);
        if (!existing) {
            throw new AppError(`AI model with ID ${id} not found`, HTTP_STATUS.NOT_FOUND);
        }

        if (existing.isSystem) {
            throw new AppError('Cannot delete system model', HTTP_STATUS.FORBIDDEN);
        }

        try {
            const deleted = this._aiModelService.delete(id);

            if (!deleted) {
                throw new AppError('Failed to delete AI model', HTTP_STATUS.INTERNAL_SERVER_ERROR);
            }

            res.json({ success: true, message: 'AI model deleted successfully' });
        } catch (err) {
            if (err.message === 'Cannot delete system model') {
                err.status = HTTP_STATUS.FORBIDDEN;
            }
            next(err);
        }
    });

    /**
     * GET /api/ai-models/active
     * Retrieves the currently active AI model for a specific role.
     */
    getActive = asyncHandler(async (req, res, next) => {
        const role = req.query.role || 'chat';
        const model = this._aiModelService.getActive(role);
        res.json({ success: true, model });
    });

    /**
     * GET /api/ai-models/active/all
     * Retrieves all active AI models (one per role).
     */
    getAllActive = asyncHandler(async (req, res, next) => {
        const models = this._aiModelService.getAllActive();
        res.json({
            success: true,
            models
        });
    });

    /**
     * POST /api/ai-models/:id/set-active
     * Sets a model as the active model.
     */
    setActive = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);

        const success = this._aiModelService.setActive(id);

        if (!success) {
            throw new AppError(`AI model with ID ${id} not found`, HTTP_STATUS.NOT_FOUND);
        }

        const updatedModel = this._aiModelService.getById(id);
        res.json({ success: true, model: updatedModel, message: 'AI model activated successfully' });
    });

    /**
     * POST /api/ai-models/test
     * Tests AI model connectivity using transient/unsaved credentials via end-to-end test.
     */
    testConnection = asyncHandler(async (req, res, next) => {
        const { model_identifier, api_url, api_key, role } = req.body;

        const overrideConfig = {
            modelIdentifier: model_identifier,
            apiUrl: api_url,
            apiKey: api_key,
            role: role || 'chat'
        };

        try {
            await this._aiService.testEndToEnd(role || 'chat', overrideConfig);

            this._logService.logTerminal({
                status: LOG_LEVELS.INFO,
                symbolKey: LOG_SYMBOLS.CHECKMARK,
                origin: 'AiModelController',
                message: `End-to-End connection test successful for model: ${model_identifier} (${role || 'chat'})`
            });

            res.json({ success: true, message: 'Connection successful' });
        } catch (error) {
            this._logService.logTerminal({
                status: LOG_LEVELS.ERROR,
                symbolKey: LOG_SYMBOLS.ERROR,
                origin: 'AiModelController',
                message: `End-to-End connection test failed for model: ${model_identifier} - ${error.message}`
            });
            throw error;
        }
    });
}

module.exports = AiModelController;