/**
 * @module AiModelController
 * @description HTTP Controller responsible for handling HTTP requests related to AI models.
 * 
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual data access to the Repository layer (AiModelRepo).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching via asyncHandler pattern.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories (uses Repository directly per current pattern).
 * - ❌ MUST NOT handle raw file system operations.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 * - ✅ Uses asyncHandler to eliminate try/catch boilerplate.
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const aiModelRepo = require('../repositories/AiModelRepo');

class AiModelController {
    /**
     * GET /api/ai-models
     * Retrieves all AI models.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getAll = asyncHandler(async (req, res, next) => {
        const models = aiModelRepo.getAllModels();
        res.json({ success: true, models });
    });

    /**
     * GET /api/ai-models/:id
     * Retrieves a single AI model by ID.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getById = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const model = aiModelRepo.getModelById(id);
        
        if (!model) {
            throw new AppError(`AI model with ID ${id} not found`, 404);
        }
        
        res.json({ success: true, model });
    });

    /**
     * GET /api/ai-models/active
     * Retrieves the currently active AI model for a specific role.
     * @param {Object} req - Express request object (query: role, defaults to 'chat')
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getActive = asyncHandler(async (req, res, next) => {
        const role = req.query.role || 'chat';
        const model = aiModelRepo.getActiveModelByRole(role);
        res.json({ success: true, model });
    });

    /**
     * GET /api/ai-models/active/all
     * Retrieves all active AI models (one per role).
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getAllActive = asyncHandler(async (req, res, next) => {
        const chatModel = aiModelRepo.getActiveModelByRole('chat');
        const embeddingModel = aiModelRepo.getActiveModelByRole('embedding');
        res.json({ 
            success: true, 
            models: {
                chat: chatModel,
                embedding: embeddingModel
            }
        });
    });

    /**
     * POST /api/ai-models
     * Creates a new AI model.
     * @param {Object} req - Express request object (body: name, model_identifier, api_url, api_key, role)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static create = asyncHandler(async (req, res, next) => {
        const { name, model_identifier, api_url, api_key, role, temperature, contextWindow } = req.body;
        
        const modelData = {
            name,
            model_identifier,
            api_url,
            api_key,
            role: role || 'chat',
            temperature,
            contextWindow
        };

        const id = aiModelRepo.createModel(modelData);
        const createdModel = aiModelRepo.getModelById(id);
        
        res.status(201).json({ success: true, model: createdModel });
    });

    /**
     * PUT /api/ai-models/:id
     * Updates an existing AI model.
     * @param {Object} req - Express request object (req.params.id, body: name, model_identifier, api_url, api_key, role)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static update = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const { name, model_identifier, api_url, api_key, role, temperature, contextWindow } = req.body;
        
        const existing = aiModelRepo.getModelById(id);
        if (!existing) {
            throw new AppError(`AI model with ID ${id} not found`, 404);
        }

        const modelData = {
            name: name || existing.name,
            model_identifier: model_identifier || existing.modelIdentifier,
            api_url: api_url !== undefined ? api_url : existing.apiUrl,
            api_key: api_key !== undefined ? api_key : existing.apiKey,
            role: role || existing.role,
            temperature: temperature !== undefined ? temperature : existing.temperature,
            contextWindow: contextWindow !== undefined ? contextWindow : existing.contextWindow
        };

        try {
            const updated = aiModelRepo.updateModel(id, modelData);
            
            if (!updated) {
                throw new AppError('Failed to update AI model', 500);
            }

            const updatedModel = aiModelRepo.getModelById(id);
            res.json({ success: true, model: updatedModel });
        } catch (err) {
            if (err.message === 'Cannot update system model') {
                err.status = 403;
            }
            next(err);
        }
    });

    /**
     * DELETE /api/ai-models/:id
     * Deletes an AI model by ID.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static delete = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);
        
        const existing = aiModelRepo.getModelById(id);
        if (!existing) {
            throw new AppError(`AI model with ID ${id} not found`, 404);
        }

        if (existing.isSystem) {
            throw new AppError('Cannot delete system model', 403);
        }

        try {
            const deleted = aiModelRepo.deleteModel(id);
            
            if (!deleted) {
                throw new AppError('Failed to delete AI model', 500);
            }

            res.json({ success: true, message: 'AI model deleted successfully' });
        } catch (err) {
            if (err.message === 'Cannot delete system model') {
                err.status = 403;
            }
            next(err);
        }
    });

    /**
     * POST /api/ai-models/:id/set-active
     * Sets a model as the active model.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static setActive = asyncHandler(async (req, res, next) => {
        const id = parseInt(req.params.id);
        
        const success = aiModelRepo.setActiveModel(id);
        
        if (!success) {
            throw new AppError(`AI model with ID ${id} not found`, 404);
        }

        const updatedModel = aiModelRepo.getModelById(id);
        res.json({ success: true, model: updatedModel, message: 'AI model activated successfully' });
    });
}

module.exports = AiModelController;