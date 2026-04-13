/**
 * @module BlueprintController
 * @description HTTP Controller responsible for handling HTTP requests related to blueprints.
 * 
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual business logic to Services (BlueprintService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ✅ All business logic MUST be delegated to Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 * 
 * @socexplanation
 * - Uses asyncHandler middleware to eliminate try/catch boilerplate.
 * - All methods are wrapped with asyncHandler for automatic error catching.
 * - Controllers focus purely on HTTP transport (parameter extraction, response formatting).
 * - Errors are automatically forwarded to global error middleware via next(error).
 */

const blueprintService = require('../services/BlueprintService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

class BlueprintController {
    /**
     * GET /api/blueprints
     * Retrieves all blueprints, optionally filtered by role query parameter.
     * @param {Object} req - Express request object (req.query.role)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getAll = asyncHandler(async (req, res) => {
        const role = req.query.role || null;
        const blueprints = blueprintService.getAllBlueprints(role);
        res.json({ blueprints });
    });

    /**
     * GET /api/blueprints/:id
     * Retrieves a single blueprint by ID with its fields and dimensions.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getById = asyncHandler(async (req, res) => {
        const blueprint = blueprintService.getBlueprintById(req.params.id);
        if (!blueprint) {
            throw new AppError('Blueprint not found', 404);
        }
        res.json({ blueprint });
    });

    /**
     * POST /api/blueprints
     * Creates a new blueprint with fields and dimension links.
     * @param {Object} req - Express request object (req.body.name, req.body.requirementLabelSingular, req.body.requirementLabelPlural, req.body.offeringLabelSingular, req.body.offeringLabelPlural, req.body.requirementDocTypeLabel, req.body.offeringDocTypeLabel, req.body.description, req.body.fields, req.body.dimensionIds)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static create = asyncHandler(async (req, res) => {
        const { name, requirementLabelSingular, requirementLabelPlural, offeringLabelSingular, offeringLabelPlural, requirementDocTypeLabel, offeringDocTypeLabel, description, fields, dimensionIds } = req.body;
        
        const blueprintId = blueprintService.createBlueprint(
            name,
            requirementLabelSingular,
            requirementLabelPlural,
            offeringLabelSingular,
            offeringLabelPlural,
            requirementDocTypeLabel,
            offeringDocTypeLabel,
            description,
            fields || [],
            dimensionIds || []
        );
        
        res.status(201).json({ success: true, blueprintId });
    });

    /**
     * PUT /api/blueprints/:id
     * Updates an existing blueprint with new fields and dimension links.
     * @param {Object} req - Express request object (req.params.id, req.body)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static update = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        const { name, requirementLabelSingular, requirementLabelPlural, offeringLabelSingular, offeringLabelPlural, requirementDocTypeLabel, offeringDocTypeLabel, description, isActive, fields, dimensionIds } = req.body;
        
        const existing = blueprintService.getBlueprintById(id);
        if (!existing) {
            throw new AppError('Blueprint not found', 404);
        }
        
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (requirementLabelSingular !== undefined) updates.requirementLabelSingular = requirementLabelSingular;
        if (requirementLabelPlural !== undefined) updates.requirementLabelPlural = requirementLabelPlural;
        if (offeringLabelSingular !== undefined) updates.offeringLabelSingular = offeringLabelSingular;
        if (offeringLabelPlural !== undefined) updates.offeringLabelPlural = offeringLabelPlural;
        if (requirementDocTypeLabel !== undefined) updates.requirementDocTypeLabel = requirementDocTypeLabel;
        if (offeringDocTypeLabel !== undefined) updates.offeringDocTypeLabel = offeringDocTypeLabel;
        if (description !== undefined) updates.description = description;
        if (isActive !== undefined) updates.isActive = isActive;
        
        blueprintService.updateBlueprint(id, updates, fields || [], dimensionIds || []);
        
        res.json({ success: true, message: 'Blueprint updated' });
    });

    /**
     * PATCH /api/blueprints/:id/set-active
     * Sets a blueprint as the active one (exclusive active blueprint).
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static setActive = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        
        const existing = blueprintService.getBlueprintById(id);
        if (!existing) {
            throw new AppError('Blueprint not found', 404);
        }
        
        blueprintService.setActiveBlueprint(id);
        
        res.json({ success: true, message: 'Blueprint set as active' });
    });

    /**
     * DELETE /api/blueprints/:id
     * Deletes a blueprint by ID.
     * @param {Object} req - Express request object (req.params.id)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static delete = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        
        const existing = blueprintService.getBlueprintById(id);
        if (!existing) {
            throw new AppError('Blueprint not found', 404);
        }
        
        if (existing.isActive) {
            throw new AppError('Cannot delete the active blueprint. Please set another blueprint as active first.', 400);
        }
        
        blueprintService.deleteBlueprint(id);
        
        res.json({ success: true, message: 'Blueprint deleted successfully' });
    });
}

module.exports = BlueprintController;