// backend/src/controllers/CriteriaController.js
/**
 * @module CriteriaController
 * @description HTTP Controller responsible for handling HTTP requests related to criteria.
 * Extends BaseCrudController to inherit standard CRUD operations while providing custom overrides.
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
 * @dependency_injection
 * Services are injected via the constructor using Constructor Injection pattern.
 * This replaces the previous static/service-locator anti-pattern.
 */

const BaseCrudController = require('./BaseCrudController');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../config/constants');

class CriteriaController extends BaseCrudController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.criteriaService - The CriteriaService instance
     * @param {Object} deps.criteriaManagerWorkflow - The CriteriaManagerWorkflow instance
     * @param {Object} deps.fileService - The FileService instance
     */
    constructor({ criteriaService, criteriaManagerWorkflow, fileService }) {
        super({
            service: criteriaService,
            entityName: 'Criterion',
            methodMap: {
                delete: 'deleteCriterion'
            }
        });
        this._criteriaService = criteriaService;
        this._criteriaManagerWorkflow = criteriaManagerWorkflow;
        this._fileService = fileService;
    }

    /**
     * POST /api/criteria
     * Creates a new criterion with AI-generated embedding.
     * Delegates to the Orchestrator Workflow for AI coordination and persistence.
     */
    create = asyncHandler(async (req, res) => {
        const { displayName, dimension, requirementId, offeringId } = req.body;
        const criterionDto = { displayName, dimension, requirementId, offeringId };

        const id = await this._criteriaManagerWorkflow.createManualCriterion(criterionDto);
        const criterion = this._criteriaService.getCriterionById(id);

        res.status(HTTP_STATUS.CREATED).json({ criterion });
    });

    /**
     * GET /api/criteria
     * Retrieves all criteria with optional pagination and filtering.
     * Custom override: Uses custom pagination and search parameters.
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
     * Custom override: Returns flat JSON instead of wrapped { criterion: {} } format.
     */
    getById = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        // Standardized to getCriterionById to match BaseEntityService expectations
        const criterion = this._criteriaService.getCriterionById(id);

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
        const criterionId = this._extractId(req);
        const associations = this._criteriaService.getCriterionAssociations(criterionId);
        res.json(associations);
    });

    /**
     * POST /api/criteria/:id/link
     * Links a criterion to an entity.
     */
    linkEntity = asyncHandler(async (req, res) => {
        const criterionId = this._extractId(req);
        const { entityId, isRequired } = req.body;

        if (!entityId) {
            throw new AppError('entityId is required', HTTP_STATUS.BAD_REQUEST);
        }

        await this._criteriaService.linkToEntity(criterionId, entityId, isRequired);
        res.json({ success: true, message: 'Criterion successfully linked and master files updated' });
    });

    /**
     * POST /api/criteria/:id/unlink
     * Removes the link between a criterion and an entity.
     */
    unlinkEntity = asyncHandler(async (req, res) => {
        const criterionId = this._extractId(req);
        const { entityId } = req.body;

        if (!entityId) {
            throw new AppError('entityId is required', HTTP_STATUS.BAD_REQUEST);
        }

        await this._criteriaService.unlinkFromEntity(criterionId, entityId);

        res.json({ success: true, message: 'Criterion successfully unlinked and master files updated' });
    });

    /**
     * GET /api/criteria/:id/similar
     * Finds similar criteria using vector math.
     */
    getSimilar = asyncHandler(async (req, res) => {
        const similar = this._criteriaService.getSimilarCriteria(this._extractId(req));
        res.json({ similar });
    });

    /**
     * POST /api/criteria/:id/merge
     * Merges a duplicate criterion into a master criterion.
     */
    merge = asyncHandler(async (req, res) => {
        const keepId = this._extractId(req);
        const { removeId } = req.body;
        this._criteriaService.mergeCriteria(keepId, removeId);
        res.json({ success: true, message: 'Criteria merged successfully' });
    });

    /**
     * GET /api/criteria/:id/history
     * Retrieves the merge history for a specific criterion.
     */
    getHistory = asyncHandler(async (req, res) => {
        const criterionId = this._extractId(req);
        const history = this._criteriaService.getMergeHistory(criterionId);
        res.json({ history });
    });

    /**
     * POST /api/criteria/:id/master-file
     * Manually regenerates the criterion master markdown file.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     *
     * @socexplanation
     * - Custom endpoint not in BaseCrudController.
     * - Delegates file regeneration logic to CriteriaManagerWorkflow.writeMasterFileForCriterion.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    writeMasterFile = asyncHandler(async (req, res) => {
        const id = this._extractId(req);
        await this._criteriaManagerWorkflow.writeMasterFileForCriterion(id);
        res.json({ success: true });
    });
}

module.exports = CriteriaController;