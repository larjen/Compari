/**
 * @module DimensionController
 * @description HTTP Controller for handling dimension requests.
 * @responsibility
 * - Extract HTTP parameters from requests.
 * - Delegate business logic to DimensionService.
 * - Format and return HTTP responses.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ✅ All business logic MUST be delegated to Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 */
const dimensionService = require('../services/DimensionService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

class DimensionController {
    /**
     * GET /api/dimensions/active
     * Retrieves all active dimensions.
     */
    static getActive = asyncHandler(async (req, res) => {
        const dimensions = dimensionService.getActiveDimensions();
        res.json({ dimensions });
    });

    /**
     * GET /api/dimensions
     * Retrieves all dimensions.
     */
    static getAll = asyncHandler(async (req, res) => {
        const dimensions = dimensionService.getAllDimensions();
        res.json({ dimensions });
    });

    /**
     * GET /api/dimensions/:id
     * Retrieves a single dimension by ID.
     */
    static getById = asyncHandler(async (req, res) => {
        const dimension = dimensionService.getDimensionById(parseInt(req.params.id));
        if (!dimension) {
            throw new AppError('Dimension not found', 404);
        }
        res.json({ dimension });
    });

    /**
     * POST /api/dimensions
     * Creates a new dimension.
     */
    static create = asyncHandler(async (req, res) => {
        const { name, displayName, requirementInstruction, offeringInstruction, isActive, weight } = req.body;
        const dimensionId = dimensionService.createDimension(name, displayName, requirementInstruction, offeringInstruction, isActive, weight);
        res.status(201).json({ success: true, dimensionId });
    });

    /**
     * PUT /api/dimensions/:id
     * Updates an existing dimension.
     */
    static update = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        const { displayName, requirementInstruction, offeringInstruction, isActive, weight } = req.body;
        
        const existing = dimensionService.getDimensionById(id);
        if (!existing) {
            throw new AppError('Dimension not found', 404);
        }

        const updates = {};
        if (displayName !== undefined) updates.displayName = displayName;
        if (requirementInstruction !== undefined) updates.requirementInstruction = requirementInstruction;
        if (offeringInstruction !== undefined) updates.offeringInstruction = offeringInstruction;
        if (isActive !== undefined) updates.isActive = isActive;
        if (weight !== undefined) updates.weight = weight;

        dimensionService.updateDimension(id, updates);
        res.json({ success: true, message: 'Dimension updated' });
    });

    /**
     * DELETE /api/dimensions/:id
     * Deletes a dimension by ID.
     */
    static delete = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        
        const existing = dimensionService.getDimensionById(id);
        if (!existing) {
            throw new AppError('Dimension not found', 404);
        }

        dimensionService.deleteDimension(id);
        res.json({ success: true, message: 'Dimension deleted successfully' });
    });

    /**
     * PATCH /api/dimensions/:id/toggle
     * Toggles the active status of a dimension.
     */
    static toggleActive = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        
        const existing = dimensionService.getDimensionById(id);
        if (!existing) {
            throw new AppError('Dimension not found', 404);
        }

        const newStatus = !existing.isActive;
        dimensionService.setDimensionActive(id, newStatus);
        res.json({ success: true, isActive: newStatus });
    });
}

module.exports = DimensionController;