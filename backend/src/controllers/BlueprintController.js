/**
 * @module BlueprintController
 * @description HTTP Controller responsible for handling HTTP requests related to blueprints.
 * Extends BaseCrudController to inherit standard CRUD operations (getAll, getById, delete).
 * Overrides create and update to handle custom field and dimension extraction.
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual business logic to Services (BlueprintService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ✅ All business logic MUST be delegated to Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 * @dependency_injection
 * Services are injected via the constructor using Constructor Injection pattern.
 * This replaces the previous static/service-locator anti-pattern.
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../config/constants');
const BaseCrudController = require('./BaseCrudController');

class BlueprintController extends BaseCrudController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.blueprintService - The BlueprintService instance
     */
    constructor({ blueprintService }) {
        super({
            service: blueprintService,
            entityName: 'Blueprint',
            methodMap: {
                getAll: 'getAllBlueprints',
                getById: 'getBlueprintById',
                delete: 'deleteBlueprint'
            }
        });
        this._blueprintService = blueprintService;
    }

    /**
     * GET /api/blueprints
     * Retrieves all blueprints, optionally filtered by role query parameter.
     * @override
     */
    getAll = asyncHandler(async (req, res) => {
        const role = req.query.role || null;
        const blueprints = this._blueprintService.getAllBlueprints(role);
        res.json({ blueprints });
    });

    /**
     * POST /api/blueprints
     * Creates a new blueprint with fields and dimension links.
     * @override create - Requires extracting fields and dimensionIds from req.body
     */
    create = asyncHandler(async (req, res) => {
        const { fields, dimensionIds, ...blueprintDto } = req.body;
        const blueprintId = this._blueprintService.createBlueprint({
            blueprintDto,
            fields: fields || [],
            dimensionIds: dimensionIds || []
        });
        res.status(HTTP_STATUS.CREATED).json({ success: true, blueprintId });
    });

    /**
     * PUT /api/blueprints/:id
     * Updates an existing blueprint with new fields and dimension links.
     * @override update - Requires extracting fields and dimensionIds from req.body
     */
    update = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        const { fields, dimensionIds, ...blueprintDto } = req.body;

        const existing = this._blueprintService.getBlueprintById(id);
        if (!existing) {
            throw new AppError('Blueprint not found', HTTP_STATUS.NOT_FOUND);
        }

        this._blueprintService.updateBlueprint({
            id,
            blueprintDto,
            fields: fields || [],
            dimensionIds: dimensionIds || []
        });

        res.json({ success: true, message: 'Blueprint updated' });
    });

    /**
     * PATCH /api/blueprints/:id/set-active
     * Sets a blueprint as the active one (exclusive active blueprint).
     */
    setActive = asyncHandler(async (req, res) => {
        const id = this._extractId(req);

        const existing = this._blueprintService.getBlueprintById(id);
        if (!existing) {
            throw new AppError('Blueprint not found', HTTP_STATUS.NOT_FOUND);
        }

        this._blueprintService.setActiveBlueprint(id);

        res.json({ success: true, message: 'Blueprint set as active' });
    });
}

module.exports = BlueprintController;