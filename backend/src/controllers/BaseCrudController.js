/**
 * @module BaseCrudController
 * @description Abstract base controller providing standard CRUD operations for HTTP requests.
 * @responsibility
 * - Provides reusable getAll, getById, create, update, and delete methods.
 * - Handles async error wrapping, parameter parsing, and 404 checks.
 * - Delegates business logic to the injected service.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic (beyond parameter extraction).
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

/**
 * @class BaseCrudController
 * @abstract Base class for CRUD HTTP controllers.
 * @param {Object} config - Configuration object
 * @param {Object} config.service - The service instance for business logic delegation
 * @param {string} config.entityName - The entity name for error messages (e.g., 'Dimension', 'Blueprint')
 */
class BaseCrudController {
    /**
     * @constructor
     * @param {Object} config - Configuration object
     * @param {Object} config.service - The service instance
     * @param {string} config.entityName - Human-readable entity name for error messages
     * @param {Object} config.methodMap - Optional mapping of CRUD operation names to service method names
     */
    constructor({ service, entityName, methodMap = {} }) {
        this.service = service;
        this.entityName = entityName;

        this._methodMap = {
            getAll: methodMap.getAll || 'getAll',
            getById: methodMap.getById || 'getById',
            create: methodMap.create || 'create',
            update: methodMap.update || 'update',
            delete: methodMap.delete || 'delete'
        };
    }

    /**
     * GET /
     * Retrieves all entities.
     * @method getAll
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with all entities
     */
    getAll = asyncHandler(async (req, res) => {
        const entities = this.service[this._methodMap.getAll]();
        res.json({ [this.entityName.toLowerCase() + 's']: entities });
    });

    /**
     * GET /:id
     * Retrieves a single entity by ID.
     * @method getById
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with the entity or 404 error
     */
    getById = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new AppError('Invalid ID format', HTTP_STATUS.BAD_REQUEST);
        }

        const entity = this.service[this._methodMap.getById](id);

        if (!entity) {
            throw new AppError(`${this.entityName} not found`, HTTP_STATUS.NOT_FOUND);
        }

        res.json({ [this.entityName.toLowerCase()]: entity });
    });

    /**
     * POST /
     * Creates a new entity.
     * @method create
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with created entity ID and 201 status
     */
    create = asyncHandler(async (req, res) => {
        const newEntity = this.service[this._methodMap.create](req.body);
        res.status(HTTP_STATUS.CREATED).json({ [this.entityName.toLowerCase()]: newEntity });
    });

    /**
     * PUT /:id
     * Updates an existing entity.
     * @method update
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with updated entity or 404 error
     */
    update = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new AppError('Invalid ID format', HTTP_STATUS.BAD_REQUEST);
        }

        const existing = this.service[this._methodMap.getById](id);
        if (!existing) {
            throw new AppError(`${this.entityName} not found`, HTTP_STATUS.NOT_FOUND);
        }

        const updatedEntity = this.service[this._methodMap.update](id, req.body);
        res.json({ [this.entityName.toLowerCase()]: updatedEntity });
    });

    /**
     * DELETE /:id
     * Deletes an entity by ID.
     * @method delete
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>} JSON response with success message or 404 error
     */
    delete = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            throw new AppError('Invalid ID format', HTTP_STATUS.BAD_REQUEST);
        }

        const existing = this.service[this._methodMap.getById](id);
        if (!existing) {
            throw new AppError(`${this.entityName} not found`, HTTP_STATUS.NOT_FOUND);
        }

        this.service[this._methodMap.delete](id);
        res.json({ success: true, message: `${this.entityName} deleted successfully` });
    });
}

module.exports = BaseCrudController;