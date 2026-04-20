/**
 * @module DimensionController
 * @description HTTP Controller for handling dimension requests.
 * Extends BaseCrudController to inherit standard CRUD operations.
 * @responsibility
 * - Extract HTTP parameters from requests.
 * - Delegate business logic to DimensionService.
 * - Format and return HTTP responses.
 * - Provide custom methods for dimension-specific operations (getActive, toggleActive).
 * @boundary_rules
 * - ❌ MUST NOT contain business logic.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ✅ All business logic MUST be delegated to Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 *
 * @dependency_injection
 * Services are injected via the constructor using Constructor Injection pattern.
 */
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../config/constants');
const BaseCrudController = require('./BaseCrudController');

class DimensionController extends BaseCrudController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.dimensionService - The DimensionService instance
     * @dependency_injection Dependencies are injected via the constructor.
     */
    constructor({ dimensionService }) {
        super({
            service: dimensionService,
            entityName: 'Dimension',
            methodMap: {
                getAll: 'getAllDimensions',
                getById: 'getDimensionById',
                create: 'createDimension',
                update: 'updateDimension',
                delete: 'deleteDimension'
            }
        });
        this._dimensionService = dimensionService;
    }

    /**
     * GET /api/dimensions/active
     * Retrieves all active dimensions.
     */
    getActive = asyncHandler(async (req, res) => {
        const dimensions = this._dimensionService.getActiveDimensions();
        res.json({ dimensions });
    });

    /**
     * PATCH /api/dimensions/:id/toggle
     * Toggles the active status of a dimension.
     */
    toggleActive = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);

        const existing = this._dimensionService.getDimensionById(id);
        if (!existing) {
            throw new AppError('Dimension not found', HTTP_STATUS.NOT_FOUND);
        }

        const newStatus = !existing.isActive;
        this._dimensionService.setDimensionActive(id, newStatus);
        res.json({ success: true, isActive: newStatus });
    });
}

module.exports = DimensionController;