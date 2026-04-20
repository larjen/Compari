// backend/src/controllers/CriteriaController.js
/**
 * @module CriteriaController
 * @description HTTP Controller responsible for handling HTTP requests related to criteria.
 * * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual data access to Domain Services (CriteriaService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 * * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ❌ MUST NOT handle raw file system operations.
 * - ✅ All data access MUST go through Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 * * @dependency_injection
 * Services are injected via the constructor using Constructor Injection pattern.
 * This replaces the previous static/service-locator anti-pattern.
 */

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../config/constants');

class CriteriaController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.criteriaService - The CriteriaService instance
     */
    constructor({ criteriaService }) {
        this._criteriaService = criteriaService;
    }

    /**
     * GET /api/criteria
     * Retrieves all criteria with optional pagination and filtering.
     */
    getAll = asyncHandler(async (req, res) => {
        const { page, limit, search, dimension } = req.query;

        const parsedPage = page ? parseInt(page, 10) : 1;
        const parsedLimit = limit ? parseInt(limit, 10) : 200;

        const result = this._criteriaService.getPaginatedCriteria({
            page: parsedPage,
            limit: parsedLimit,
            search,
            dimension
        });

        res.json(result);
    });

    /**
     * GET /api/criteria/:id
     * Retrieves a single criterion by ID for deep-linking.
     */
    getById = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        const criterion = this._criteriaService.getCriterionByIdForApi(id);

        if (!criterion) {
            throw new AppError('Criterion not found', HTTP_STATUS.NOT_FOUND);
        }

        res.json(criterion);
    });

    /**
     * GET /api/criteria/:id/associations
     * Retrieves all requirement and offering entities associated with a specific criterion.
     */
    getAssociations = asyncHandler(async (req, res) => {
        const criterionId = parseInt(req.params.id);
        const associations = this._criteriaService.getCriterionAssociations(criterionId);
        res.json(associations);
    });

    /**
     * DELETE /api/criteria/:id
     * Deletes a specific criterion.
     */
    delete = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        this._criteriaService.deleteCriterion(id);
        res.json({ success: true, message: 'Criterion deleted successfully' });
    });

    /**
     * GET /api/criteria/:id/similar
     * Finds similar criteria using vector math.
     */
    getSimilar = asyncHandler(async (req, res) => {
        const similar = this._criteriaService.getSimilarCriteria(parseInt(req.params.id));
        res.json({ similar });
    });

    /**
     * POST /api/criteria/:id/merge
     * Merges a duplicate criterion into a master criterion.
     */
    merge = asyncHandler(async (req, res) => {
        const keepId = parseInt(req.params.id);
        const { removeId } = req.body;
        this._criteriaService.mergeCriteria(keepId, removeId);
        res.json({ success: true, message: 'Criteria merged successfully' });
    });

    /**
     * GET /api/criteria/:id/history
     * Retrieves the merge history for a specific criterion.
     */
    getHistory = asyncHandler(async (req, res) => {
        const criterionId = parseInt(req.params.id);
        const history = this._criteriaService.getMergeHistory(criterionId);
        res.json({ history });
    });
}

module.exports = CriteriaController;