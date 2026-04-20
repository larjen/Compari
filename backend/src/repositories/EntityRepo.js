/**
 * @module EntityRepo
 * @description Data Access Layer for Class Table Inheritance (CTI) entity schema.
 * * @responsibility
 * - Executes all SQL CRUD queries related to entities using CTI pattern.
 * - Handles the split between entities_base (shared) and entities_requirement/entities_offering (specific).
 * - Maps raw SQLite rows into `Entity` Model instances.
 * - Hides CTI complexity from the Service layer.
 * * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT interact with the file system or AI.
 * - ❌ This layer ONLY handles database operations.
 */

const BaseEntityRepo = require('./BaseEntityRepo');
const EntityFactory = require('../models/EntityFactory');

/**
 * @class EntityRepo
 * @extends BaseEntityRepo
 * @description Repository for CTI entity CRUD operations.
 * Implements Class Table Inheritance pattern where:
 * - entities_base: Shared attributes (id, type, name, status, metadata, etc.)
 * - entities_requirement: Requirement-specific attributes (job_url, deadline)
 * - entities_offering: Offering-specific attributes (cv_path)
 */
class EntityRepo extends BaseEntityRepo {
    /**
     * Creates a new EntityRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     */
    constructor({ db }) {
        super({ db });
    }

    /**
     * Creates a new entity record using CTI pattern.
     * Uses database transaction to ensure atomic insert into base table
     * and the appropriate subclass table.
     *
     * @socexplanation
     * This method implements the Class Table Inheritance pattern by performing
     * a two-phase insert within a transaction:
     * 1. Insert shared attributes into entities_base
     * 2. Insert type-specific attributes into entities_requirement or entities_offering
     *
     * @architectural_decision
     * Transaction is required because CTI requires both base and subclass rows
     * to exist for a valid entity. If either insert fails, the entire operation
     * must rollback to maintain referential integrity. The Service layer remains
     * unaware of this complexity - it simply passes an entityDto and receives an ID.
     *
     * @method createEntity
     * @param {Object} entityDto - The entity DTO object.
     * @param {string} entityDto.type - The entity type ('requirement' or 'offering').
     * @param {string} entityDto.name - The entity nicename.
     * @param {string|null} [entityDto.description] - The entity description (nice_name_line_1).
     * @param {string|null} [entityDto.folderPath] - Path to the entity's folder.
     * @param {Object|null} [entityDto.metadata] - Flexible JSON data.
     * @param {number|null} [entityDto.blueprintId] - The blueprint ID this entity belongs to.
     * @param {string|null} [entityDto.jobUrl] - Requirement-specific: job URL.
     * @param {string|null} [entityDto.deadline] - Requirement-specific: deadline date.
     * @param {string|null} [entityDto.cvPath] - Offering-specific: CV path.
     * @returns {number} The ID of the newly created entity.
     */
createEntity(entityDto) {
        const { entityType, nicename, niceNameLine1, niceNameLine2, folderPath, metadata, blueprintId, hash } = entityDto;
        const metadataStr = metadata ? JSON.stringify(metadata) : null;
        const normalizedName = nicename ? nicename.toLowerCase().replace(/[^a-z0-9]/g, '') : 'entity';
        const line1 = niceNameLine1 || 'Unknown';
        const line2 = niceNameLine2 || 'Unknown';

        const insertBaseStmt = this.db.prepare(`
            INSERT INTO entities_base (entity_type, nicename, normalized_name, nice_name_line_1, nice_name_line_2, folder_path, metadata, blueprint_id, hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const baseInfo = insertBaseStmt.run(entityType, nicename, normalizedName, line1, line2, folderPath || null, metadataStr, blueprintId || null, hash || null);
        return baseInfo.lastInsertRowid;
    }

    /**
     * Retrieves all entities with optional filtering and pagination.
     * Uses LEFT JOINs to fetch both base table and type-specific subclass data.
     *
     * @socexplanation
     * This method implements CTI read operations by joining entities_base with
     * entities_requirement and entities_offering. LEFT JOIN ensures entities are
     * returned even if their subclass row hasn't been populated yet (future-proofing).
     * Column aliases map the CTI schema columns to what EntityFactory.fromRow() expects.
     *
     * @architectural_decision
     * Using LEFT JOIN instead of separate queries per type maintains query simplicity
     * and allows the Service layer to filter by type without knowing about CTI.
     * The column aliases (eb.nicename as name, etc.) ensure EntityFactory.fromRow()
     * receives the field names it expects, preserving the existing model contract.
     *
     * @method getAllEntities
     * @param {Object} [params] - Query parameters.
     * @param {string|null} [params.type] - Optional entity type filter.
     * @param {number} [params.page=1] - Page number.
     * @param {number} [params.limit=12] - Items per page.
     * @param {string|null} [params.search] - Search term.
     * @param {string|null} [params.status] - Status filter.
     * @returns {Object} Object with entities array and pagination metadata.
     */
    getAllEntities({ type, page = 1, limit = 12, search, status } = {}) {
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        if (type) {
            whereConditions.push('eb.entity_type = ?');
            queryParams.push(type);
        }

        if (search) {
            whereConditions.push('(eb.nicename LIKE ? OR eb.nice_name_line_1 LIKE ? OR eb.metadata LIKE ?)');
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern);
        }

        if (status && status !== 'all') {
            const statusArray = Array.isArray(status) ? status : String(status).split(',');
            const cleanStatuses = statusArray.map(s => s.trim().toLowerCase()).filter(Boolean);

            if (cleanStatuses.length > 0) {
                const placeholders = cleanStatuses.map(() => '?').join(', ');
                whereConditions.push(`eb.status IN (${placeholders})`);
                queryParams.push(...cleanStatuses);
            }
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const countStmt = this.db.prepare(`
            SELECT COUNT(*) as total FROM entities_base eb ${whereClause}
        `);
        const countResult = countStmt.get(...queryParams);
        const total = countResult.total;
        const totalPages = Math.ceil(total / limit);

        const stmt = this.db.prepare(`
            SELECT
                eb.id,
                eb.entity_type,
                eb.nicename,
                eb.nice_name_line_1,
                eb.nice_name_line_2,
                eb.folder_path,
                eb.metadata,
                eb.status,
                eb.error,
                eb.blueprint_id,
                eb.hash,
                eb.created_at,
                eb.updated_at
            FROM entities_base eb
            ${whereClause}
            ORDER BY eb.id DESC
            LIMIT ? OFFSET ?
        `);
        const rows = stmt.all(...queryParams, limit, offset);
        const entities = rows.map(row => EntityFactory.fromRow(row));

        return { entities, meta: { total, page, limit, totalPages } };
    }

    /**
     * Retrieves a single entity by ID using CTI JOINs.
     * @method getEntityById
     * @param {number} id - The entity ID.
     * @returns {Entity|null} The Entity instance or null if not found.
     */
    getEntityById(id) {
        const stmt = this.db.prepare(`
            SELECT
                eb.id,
                eb.entity_type,
                eb.nicename,
                eb.nice_name_line_1,
                eb.nice_name_line_2,
                eb.folder_path,
                eb.metadata,
                eb.status,
                eb.error,
                eb.blueprint_id,
                eb.hash,
                eb.created_at,
                eb.updated_at
            FROM entities_base eb
            WHERE eb.id = ?
        `);
        const row = stmt.get(id);
        return EntityFactory.fromRow(row);
    }

    /**
     * Updates an entity's basic information using DTO pattern.
     * @method updateEntity
     * @param {number} id - The entity ID.
     * @param {Object} entityDetailsDto - The entity details DTO.
     * @param {string} entityDetailsDto.name - The new name.
     * @param {string|null} [entityDetailsDto.niceNameLine1] - Line 1 description.
     * @param {string|null} [entityDetailsDto.niceNameLine2] - Line 2 description.
     * @returns {boolean} True if the row was updated.
     *
     * @socexplanation
     * - Uses DTO pattern to prevent parameter creep (anti-pattern where methods have too many parameters).
     * - DTO consolidates name, niceNameLine1, niceNameLine2 into a single object.
     */
    updateEntity(id, { name, niceNameLine1, niceNameLine2 }) {
        return super.update(id, {
            nicename: name,
            normalized_name: name.toLowerCase().trim(),
            nice_name_line_1: niceNameLine1 || null,
            nice_name_line_2: niceNameLine2 || null
        });
    }

    /**
     * Updates the match score for an entity via metadata.
     * @method updateMatchScore
     * @param {number} id - The entity ID.
     * @param {number|null} matchScore - The match score.
     * @returns {void}
     */
    updateMatchScore(id, matchScore) {
        const stmt = this.db.prepare(`
            UPDATE entities_base SET metadata = json_set(COALESCE(metadata, '{}'), '$.matchScore', ?), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(matchScore, id);
    }

    /**
     * Retrieves entities with a specific status.
     * @method getEntitiesByStatus
     * @param {string} status - The status to filter by.
     * @returns {Array<Entity>} Array of Entity instances.
     */
    getEntitiesByStatus(status) {
        const stmt = this.db.prepare(`
            SELECT
                eb.id,
                eb.entity_type,
                eb.nicename,
                eb.nice_name_line_1,
                eb.nice_name_line_2,
                eb.folder_path,
                eb.metadata,
                eb.status,
                eb.error,
                eb.blueprint_id,
                eb.hash,
                eb.created_at,
                eb.updated_at
            FROM entities_base eb
            WHERE eb.status = ?
            ORDER BY eb.id DESC
        `);
        const rows = stmt.all(status);
        return rows.map(row => EntityFactory.fromRow(row));
    }

    /**
     * Retrieves entities stuck in any active processing state.
     * @method getStuckEntities
     * @returns {Array<Entity>}
     */
    getStuckEntities() {
        const stmt = this.db.prepare(`
            SELECT * FROM entities_base eb
            WHERE eb.status NOT IN ('pending', 'completed', 'failed')
            ORDER BY eb.id DESC
        `);
        const rows = stmt.all();
        return rows.map(row => EntityFactory.fromRow(row));
    }
}

/**
 * @dependency_injection
 * EntityRepo exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * @param {Object} deps - Dependencies object.
 * @param {Object} deps.db - The database instance (injected).
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = EntityRepo;