/**
 * @module CriteriaController
 * @description HTTP Controller responsible for handling HTTP requests related to criteria.
 * 
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual data access to Domain Services (CriteriaService).
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
 * @socexplanation
 * - Standardizes error handling by delegating ALL errors to the global error middleware.
 * - This ensures consistent error responses and centralized error logging.
 * - Previously handled errors locally with res.status(500), now properly propagates via next().
 */

const criteriaService = require('../services/CriteriaService');
const asyncHandler = require('../utils/asyncHandler');

class CriteriaController {
    /**
     * GET /api/criteria
     * Retrieves all criteria with optional pagination and filtering.
     * 
     * @query {number} [page=1] - Page number (1-indexed).
     * @query {number} [limit=200] - Number of items per page.
     * @query {string} [search] - Search term to match against displayName (case-insensitive).
     * @query {string} [dimension] - Optional dimension filter.
     * 
     * @returns {Object} JSON with criteria array, totalPages, and totalCount.
     * 
     * @critical_sorting_rule
     * Results are sorted by dimension (alphabetically, nulls/uncategorized as last),
     * then by displayName (alphabetically) BEFORE applying OFFSET/LIMIT.
     * This ensures dimension grouping headers persist across pages.
     */
    static getAll = asyncHandler(async (req, res) => {
        const { page, limit, search, dimension } = req.query;

        const parsedPage = page ? parseInt(page, 10) : 1;
        const parsedLimit = limit ? parseInt(limit, 10) : 200;

        const result = criteriaService.getPaginatedCriteria({
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
    static getById = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        const criterion = criteriaService.getCriterionByIdForApi(id);
        
        if (!criterion) {
            return res.status(404).json({ error: 'Criterion not found' });
        }
        
        res.json(criterion);
    });

    /**
     * GET /api/criteria/:id/associations
     * Retrieves all job listings and users associated with a specific criterion.
     */
    static getAssociations = asyncHandler(async (req, res) => {
        const criterionId = parseInt(req.params.id);
        const associations = criteriaService.getCriterionAssociations(criterionId);
        res.json(associations);
    });

    /**
     * DELETE /api/criteria/:id
     * Deletes a specific criterion.
     */
    static delete = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        criteriaService.deleteCriterion(id);
        res.json({ success: true, message: 'Criterion deleted successfully' });
    });

    static getSimilar = asyncHandler(async (req, res) => {
        const similar = criteriaService.getSimilarCriteria(parseInt(req.params.id));
        res.json({ similar });
    });

    static merge = asyncHandler(async (req, res) => {
        const keepId = parseInt(req.params.id);
        const { removeId } = req.body;
        criteriaService.mergeCriteria(keepId, removeId);
        res.json({ success: true, message: 'Criteria merged successfully' });
    });

    /**
     * GET /api/criteria/:id/history
     * Retrieves the merge history for a specific criterion.
     */
    static getHistory = asyncHandler(async (req, res) => {
        const criterionId = parseInt(req.params.id);
        const history = criteriaService.getMergeHistory(criterionId);
        res.json({ history });
    });
}

module.exports = CriteriaController;