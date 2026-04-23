/**
 * @module EntityRepo
 * @description Data Access Layer for entity persistence using Single Table Inheritance (STI) pattern.
 * * @responsibility
 * - Executes all SQL CRUD queries related to entities using STI pattern.
 * - Stores type-specific data in the metadata JSON column of entities_base.
 * - Maps raw SQLite rows into `Entity` Model instances.
 * - Hides STI complexity from the Service layer.
 * * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT interact with the file system or AI.
 * - ❌ This layer ONLY handles database operations.
 */

const path = require('path');
const BaseEntityRepo = require('./BaseEntityRepo');
const EntityFactory = require('../models/EntityFactory');
const { ENTITY_STATUS } = require('../config/constants');

/**
 * @class EntityRepo
 * @extends BaseEntityRepo
 * @description Repository for entity CRUD operations using Single Table Inheritance (STI) pattern.
 * Implements STI where:
 * - entities_base: Shared attributes (id, type, name, status, metadata, etc.)
 * - Type-specific data stored in metadata JSON column (job_url, deadline for requirements; cv_path for offerings)
 *
 * @socexplanation
 * Error handling was refactored to explicitly catch and log data corruption/math failures
 * via injected LogService, eliminating silent failures while maintaining graceful degradation.
 */
class EntityRepo extends BaseEntityRepo {
    /**
     * Creates a new EntityRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     * @param {Object} deps.logService - Optional LogService instance.
     */
    constructor({ db, logService }) {
        super({ db, logService });
    }

    /**
     * Creates a new entity record using Single Table Inheritance (STI) pattern.
     * Inserts only into entities_base table; type-specific data stored in metadata JSON column.
     *
     * @socexplanation
     * This method implements the Single Table Inheritance pattern by inserting
     * shared attributes into entities_base and type-specific attributes into the
     * metadata JSON column. Requirement-specific fields (jobUrl, deadline) and
     * offering-specific fields (cvPath) are stored in metadata.
     *
     * @architectural_decision
     * STI was chosen for Requirements and Offerings to simplify schema and reduce
     * JOIN overhead. Only Match and Criterion use true CTI via separate tables.
     * The Service layer remains unaware of this complexity - it simply passes
     * an entityDto and receives an ID.
     *
     * @method createEntity
     * @param {Object} entityDto - The entity DTO object.
     * @param {string} entityDto.type - The entity type ('requirement' or 'offering').
     * @param {string} entityDto.name - The entity nicename.
     * @param {string|null} [entityDto.description] - The entity description (nice_name_line_1).
     * @param {string|null} [entityDto.folderPath] - Path to the entity's folder.
     * @param {Object|null} [entityDto.metadata] - Flexible JSON data including type-specific fields.
     * @param {number|null} [entityDto.blueprintId] - The blueprint ID this entity belongs to.
     * @returns {number} The ID of the newly created entity.
     */
    createEntity(entityDto) {
        const { entityType, nicename, niceNameLine1, niceNameLine2, folderPath, folderName, metadata, blueprintId, hash, isStaged } = entityDto;
        const metadataStr = metadata ? JSON.stringify(metadata) : null;
        const normalizedName = nicename ? nicename.toLowerCase().replace(/[^a-z0-9]/g, '') : 'entity';
        const line1 = niceNameLine1 || 'Unknown';
        const line2 = niceNameLine2 || 'Unknown';

        const storedFolderPath = folderName || path.basename(folderPath);
        const storedIsStaged = isStaged !== undefined ? (isStaged ? 1 : 0) : 1;

        const insertBaseStmt = this.db.prepare(`
            INSERT INTO entities_base (entity_type, nicename, normalized_name, nice_name_line_1, nice_name_line_2, folder_path, metadata, blueprint_id, hash, is_staged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const baseInfo = insertBaseStmt.run(entityType, nicename, normalizedName, line1, line2, storedFolderPath || null, metadataStr, blueprintId || null, hash || null, storedIsStaged);
        return baseInfo.lastInsertRowid;
    }

    /**
     * Retrieves all entities with optional filtering and pagination.
     * Queries entities_base table directly; type-specific data is in metadata JSON column.
     *
     * @socexplanation
     * This method implements STI read operations by querying entities_base directly.
     * Type-specific fields (jobUrl, deadline for requirements; cvPath for offerings)
     * are stored in the metadata JSON column and retrieved as-is.
     *
     * @architectural_decision
     * Single table query simplifies data access and maintains performance.
     * The Service layer filters by type without knowing about STI implementation.
     * Column aliases ensure EntityFactory.fromRow() receives the field names it expects.
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
                eb.master_file,
                eb.metadata,
                eb.status,
                eb.error,
                eb.blueprint_id,
                eb.hash,
                eb.is_staged,
                eb.created_at,
                eb.updated_at
            FROM entities_base eb
            ${whereClause}
            ORDER BY eb.id DESC
            LIMIT ? OFFSET ?
        `);
        const rows = stmt.all(...queryParams, limit, offset);
        const entities = rows.map(row => EntityFactory.fromRow(row, this._logService));

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
                eb.master_file,
                eb.metadata,
                eb.status,
                eb.error,
                eb.blueprint_id,
                eb.hash,
                eb.is_staged,
                eb.created_at,
                eb.updated_at
            FROM entities_base eb
            WHERE eb.id = ?
        `);
        const row = stmt.get(id);
        return EntityFactory.fromRow(row, this._logService);
    }

    /**
     * Updates an entity's basic information using DTO pattern.
     * @method updateEntity
     * @param {number} id - The entity ID.
     * @param {Object} entityDetailsDto - The entity details DTO.
     * @param {string} [entityDetailsDto.name] - The new name.
     * @param {string|null} [entityDetailsDto.niceNameLine1] - Line 1 description.
     * @param {string|null} [entityDetailsDto.niceNameLine2] - Line 2 description.
     * @param {string|null} [entityDetailsDto.folderPath] - The folder path (relative name).
     * @param {Object|null} [entityDetailsDto.metadata] - The metadata object.
     * @returns {boolean} True if the row was updated.
     *
     * @socexplanation
     * - Uses DTO pattern to prevent parameter creep (anti-pattern where methods have too many parameters).
     * - DTO consolidates name, niceNameLine1, niceNameLine2, folderPath, metadata into a single object.
     */
    updateEntity(id, { name, niceNameLine1, niceNameLine2, folderPath, metadata, isStaged, is_staged }) {
        const updates = {};
        if (name !== undefined) {
            updates.nicename = name;
            updates.normalized_name = name.toLowerCase().trim();
        }
        if (niceNameLine1 !== undefined) {
            updates.nice_name_line_1 = niceNameLine1 || null;
        }
        if (niceNameLine2 !== undefined) {
            updates.nice_name_line_2 = niceNameLine2 || null;
        }
        if (folderPath !== undefined) {
            updates.folder_path = folderPath;
        }
        if (metadata !== undefined) {
            updates.metadata = typeof metadata === 'string' ? metadata : (metadata ? JSON.stringify(metadata) : null);
        }
        if (isStaged !== undefined) {
            updates.is_staged = isStaged ? 1 : 0;
        }
        if (is_staged !== undefined) {
            updates.is_staged = is_staged;
        }

        return super.update(id, updates);
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
     * Retrieves entities stuck in any active processing state.
     * @method getStuckEntities
     * @returns {Array<Entity>}
     */
    getStuckEntities() {
        const stmt = this.db.prepare(`
            SELECT * FROM entities_base eb
            WHERE eb.status NOT IN (?, ?, ?)
            ORDER BY eb.id DESC
        `);
        const rows = stmt.all(ENTITY_STATUS.PENDING, ENTITY_STATUS.COMPLETED, ENTITY_STATUS.FAILED);
        return rows.map(row => EntityFactory.fromRow(row));
    }
}

module.exports = EntityRepo;