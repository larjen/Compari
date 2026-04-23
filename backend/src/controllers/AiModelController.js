/**
 * @module AiModelController
 * @description HTTP Controller responsible for handling HTTP requests related to AI models.
 * Extends BaseCrudController to inherit standard CRUD operations while providing custom overrides.
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

const BaseCrudController = require('./BaseCrudController');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class AiModelController extends BaseCrudController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.aiModelService - The AiModelService instance
     * @param {Object} deps.aiService - The AiService instance
     * @param {Object} deps.logService - The LogService instance
     */
    constructor({ aiModelService, aiService, logService }) {
        super({
            service: aiModelService,
            entityName: 'AI model',
            methodMap: {
                getById: 'getById',
                getAll: 'getAll',
                create: 'create',
                update: 'update',
                delete: 'delete'
            }
        });
        this._aiModelService = aiModelService;
        this._aiService = aiService;
        this._logService = logService;
    }

    /**
     * GET /api/ai-models
     * Retrieves all AI models.
     * @override
     * @socexplanation
     * Override preserves custom response format { models: [] } instead of base { aiModels: [] }.
     * Delegates to AiModelService.getAll() for business logic.
     */
    getAll = asyncHandler(async (req, res) => {
        const models = this.service.getAll();
        res.json({ models });
    });

    /**
     * GET /api/ai-models/:id
     * Retrieves an AI model by ID.
     * @override
     * @socexplanation
     * Override customizes response format to { model: {} } and adds custom error message.
     * Uses this._extractId(req) to comply with boilerplate ban (Rule 8.B).
     */
    getById = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        const model = this.service.getById(id);

        if (!model) {
            throw new AppError(`AI model with ID ${id} not found`, HTTP_STATUS.NOT_FOUND);
        }

        res.json({ model });
    });

    /**
     * POST /api/ai-models
     * Creates a new AI model.
     * @override
     * @socexplanation
     * Override required to extract and map custom DTO from req.body.
     * BaseCrudController.create passes req.body directly which lacks the mapped fields.
     */
    create = asyncHandler(async (req, res) => {
        const { name, model_identifier, api_url, api_key, role, temperature, contextWindow } = req.body;

        const newModel = this.service.create({
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
     * @override
     * @socexplanation
     * Override required to extract and map custom DTO from req.body.
     * Uses this._extractId(req) to comply with boilerplate ban (Rule 8.B).
     */
    update = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        const { name, model_identifier, api_url, api_key, role, temperature, contextWindow } = req.body;

        const existing = this.service.getById(id);
        if (!existing) {
            throw new AppError(`AI model with ID ${id} not found`, HTTP_STATUS.NOT_FOUND);
        }

        const updatedModel = this.service.update(id, {
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
     * @override
     * @socexplanation
     * Override required to enforce isSystem protection business rule.
     * Uses this._extractId(req) to comply with boilerplate ban (Rule 8.B).
     * Delegates to service for actual deletion but controller enforces the business rule.
     */
    delete = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

        const existing = this.service.getById(id);
        if (!existing) {
            throw new AppError(`AI model with ID ${id} not found`, HTTP_STATUS.NOT_FOUND);
        }

        if (existing.isSystem) {
            throw new AppError('Cannot delete system model', HTTP_STATUS.FORBIDDEN);
        }

        const deleted = this.service.delete(id);

        if (!deleted) {
            throw new AppError('Failed to delete AI model', HTTP_STATUS.INTERNAL_SERVER_ERROR);
        }

        res.json({ success: true, message: 'AI model deleted successfully' });
    });

    /**
     * GET /api/ai-models/active
     * Retrieves the currently active AI model for a specific role.
     */
    getActive = asyncHandler(async (req, res) => {
        const role = req.query.role || 'chat';
        const model = this._aiModelService.getActive(role);
        res.json({ success: true, model });
    });

    /**
     * GET /api/ai-models/active/all
     * Retrieves all active AI models (one per role).
     */
    getAllActive = asyncHandler(async (req, res) => {
        const models = this._aiModelService.getAllActive();
        res.json({
            success: true,
            models
        });
    });

    /**
     * POST /api/ai-models/:id/set-active
     * Sets a model as the active model.
     * @socexplanation
     * Custom endpoint not in BaseCrudController - requires custom response format.
     * Uses this._extractId(req) to comply with boilerplate ban (Rule 8.B).
     */
    setActive = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

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
     * @socexplanation
     * Custom endpoint not in BaseCrudController - requires complex async orchestration.
     * Preserves custom error handling with logTerminal for stack trace preservation.
     */
    testConnection = asyncHandler(async (req, res) => {
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
                message: `End-to-End connection test failed for model: ${model_identifier}`,
                errorObj: error
            });
            throw error;
        }
    });
}

module.exports = AiModelController;