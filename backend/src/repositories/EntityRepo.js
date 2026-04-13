/**
 * @module EntityRepo
 * @description Data Access Layer for `entities` table.
 * * @responsibility
 * - Executes all SQL CRUD queries related to unified entities.
 * - Maps raw SQLite rows into `Entity` Model instances.
 * - Handles metadata JSON serialization/deserialization.
 * * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT interact with the file system or AI.
 * - ❌ This layer ONLY handles database operations.
 */

const db = require('./Database');
const BaseRepository = require('./BaseRepository');
const Entity = require('../models/Entity');
const { ENTITY_STATUS } = require('../config/constants');

/**
 * @class EntityRepo
 * @extends BaseRepository
 * @description Repository for unified entity CRUD operations.
 */
class EntityRepo extends BaseRepository {
    /**
     * Creates a new EntityRepo instance.
     * @constructor
     */
    constructor() {
        super('entities');
    }
    /**
     * Creates a new entity record.
     * @method createEntity
     * @param {string} type - The entity type ('requirement' or 'offering').
     * @param {string} name - The entity name.
     * @param {string|null} [description] - The entity description.
     * @param {string|null} [folderPath] - Path to the entity's folder.
     * @param {Object|null} [metadata] - Flexible JSON data.
     * @param {number|null} [blueprintId] - The blueprint ID this entity belongs to.
     * @returns {number} The ID of the newly created entity.
     * @why_not_base - Requires custom column mapping (metadata JSON serialization, blueprint_id)
     *                 and returns lastInsertRowid which is table-specific behavior.
     */
    createEntity(type, name, description, folderPath, metadata, blueprintId) {
        const metadataStr = metadata ? JSON.stringify(metadata) : null;
        const stmt = db.prepare(`
            INSERT INTO entities (type, name, description, folder_path, metadata, blueprint_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(type, name, description || null, folderPath || null, metadataStr, blueprintId || null);
        return info.lastInsertRowid;
    }

    /**
     * Retrieves all entities, optionally filtered by type.
     * @method getAllEntities
     * @param {Object} [params] - Query parameters.
     * @param {string|null} [params.type] - Optional entity type filter.
     * @param {number} [params.page=1] - Page number.
     * @param {number} [params.limit=12] - Items per page.
     * @param {string|null} [params.search] - Search term.
     * @param {string|null} [params.status] - Status filter.
     * @returns {Object} Object with entities array and pagination metadata.
     * @why_not_base - Requires custom column selection, Entity model mapping, and pagination logic.
     */
    getAllEntities({ type, page = 1, limit = 12, search, status } = {}) {
        const offset = (page - 1) * limit;
        
        let whereConditions = [];
        let queryParams = [];

        if (type) {
            whereConditions.push('type = ?');
            queryParams.push(type);
        }

        if (search) {
            // Enables searching across dynamic blueprint fields like Job Titles or Candidate Names stored in the metadata JSON column.
            whereConditions.push('(name LIKE ? OR description LIKE ? OR metadata LIKE ?)');
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern);
        }

        if (status) {
            whereConditions.push('status = ?');
            queryParams.push(status.toLowerCase());
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // Get total count
        const countStmt = db.prepare(`SELECT COUNT(*) as total FROM entities ${whereClause}`);
        const countResult = countStmt.get(...queryParams);
        const total = countResult.total;
        const totalPages = Math.ceil(total / limit);

        // Get paginated entities
        const stmt = db.prepare(`
            SELECT id, type, name, description, folder_path, metadata, status, error, processing_file_name, blueprint_id, created_at, updated_at 
            FROM entities 
            ${whereClause} 
            ORDER BY id DESC 
            LIMIT ? OFFSET ?
        `);
        const rows = stmt.all(...queryParams, limit, offset);
        const entities = rows.map(row => Entity.fromRow(row));

        return { entities, meta: { total, page, limit, totalPages } };
    }

    /**
     * Retrieves a single entity by ID.
     * @method getEntityById
     * @param {number} id - The entity ID.
     * @returns {Entity|null} The Entity instance or null if not found.
     * @why_not_base - Requires custom column selection and Entity model mapping with
     *                 fromRow() transformation (not plain row return).
     */
    getEntityById(id) {
        const stmt = db.prepare('SELECT id, type, name, description, folder_path, metadata, status, error, processing_file_name, blueprint_id, created_at, updated_at FROM entities WHERE id = ?');
        const row = stmt.get(id);
        return Entity.fromRow(row);
    }

    /**
     * Updates an entity's basic information.
     * @method updateEntity
     * @param {number} id - The entity ID.
     * @param {string} name - The new name.
     * @param {string|null} [description] - The new description.
     * @returns {void}
     * @why_not_base - Custom UPDATE with timestamp and specific column targeting.
     */
    updateEntity(id, name, description) {
        const stmt = db.prepare(`
            UPDATE entities SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(name, description || null, id);
    }

    /**
     * Updates an entity's metadata.
     * @method updateEntityMetadata
     * @param {number} id - The entity ID.
     * @param {Object} metadata - The new metadata object (will be JSON stringified).
     * @returns {void}
     * @why_not_base - Requires JSON.stringify serialization of metadata object.
     */
    updateEntityMetadata(id, metadata) {
        const metadataStr = JSON.stringify(metadata);
        const stmt = db.prepare(`
            UPDATE entities SET metadata = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(metadataStr, id);
    }

    /**
     * Updates the status for an entity.
     * Enforces lowercase normalization using system constants to guarantee data integrity.
     * This is the single source of truth for entity processing state.
     * @method updateEntityStatus
     * @param {number} id - The entity ID.
     * @param {string} status - The new status (must be a valid ENTITY_STATUS).
     * @returns {void}
     */
    updateEntityStatus(id, status) {
        const safeStatus = status ? String(status).toLowerCase() : null;
        
        const stmt = db.prepare('UPDATE entities SET status = ? WHERE id = ?');
        stmt.run(safeStatus, id);
    }

/**
     * Updates an entity's error message.
     * @method updateEntityError
     * @param {number} id - The entity ID.
     * @param {string|null} error - The error message.
     * @returns {void}
     * @why_not_base - Custom UPDATE that sets error state alongside status.
     */
    updateEntityError(id, error) {
        const stmt = db.prepare(`
            UPDATE entities SET error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(error, id);
    }

    /**
     * Updates the match score for an entity.
     * @method updateMatchScore
     * @param {number} id - The entity ID.
     * @param {number|null} matchScore - The match score.
     * @returns {void}
     * @why_not_base - Uses SQLite json_set function for nested metadata update.
     */
    updateMatchScore(id, matchScore) {
        const stmt = db.prepare(`
            UPDATE entities SET metadata = json_set(COALESCE(metadata, '{}'), '$.matchScore', ?), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(matchScore, id);
    }

    /**
     * Retrieves entities with a specific status.
     * @method getEntitiesByStatus
     * @param {string} status - The status to filter by (must conform to ENTITY_STATUS).
     * @returns {Array<Entity>} Array of Entity instances.
     */
    getEntitiesByStatus(status) {
        const stmt = db.prepare('SELECT id, type, name, description, folder_path, metadata, status, error, processing_file_name, blueprint_id, created_at, updated_at FROM entities WHERE status = ? ORDER BY id DESC');
        const rows = stmt.all(status);
        return rows.map(row => Entity.fromRow(row));
    }

    /**
     * Registers a document record for an entity.
     * @method registerDocumentRecord
     * @param {number} entityId - The entity ID.
     * @param {string} docType - The document type.
     * @param {string} fileName - The file name.
     * @param {string} filePath - The file path.
     * @returns {void}
     * @why_not_base - Inserts into separate 'documents' table (not base table).
     */
    registerDocumentRecord(entityId, docType, fileName, filePath) {
        const stmt = db.prepare(`
            INSERT INTO documents (entity_id, doc_type, file_name, file_path) 
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(entityId, docType, fileName, filePath);
    }

    /**
     * Retrieves all documents for an entity.
     * @method getDocumentsForEntity
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of document objects.
     * @why_not_base - Queries separate 'documents' table with JOIN.
     */
    getDocumentsForEntity(entityId) {
        const stmt = db.prepare('SELECT * FROM documents WHERE entity_id = ?');
        const rows = stmt.all(entityId);
        return rows;
    }

    /**
     * Updates the root folder path for an entity after a directory move.
     * @method updateEntityFolderPath
     * @param {number} id - The entity ID.
     * @param {string} newFolderPath - The new absolute folder path.
     * @returns {void}
     * @why_not_base - Custom UPDATE targeting folder_path column specifically.
     */
    updateEntityFolderPath(id, newFolderPath) {
        const stmt = db.prepare(`
            UPDATE entities SET folder_path = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(newFolderPath, id);
    }

    /**
     * Gets or creates a criterion by normalized name.
     * @method getOrCreateCriterion
     * @param {string} normalizedName - The normalized criterion name.
     * @param {string} displayName - The display-friendly name.
     * @returns {number} The criterion ID.
     * @why_not_base - Upsert logic with SELECT and INSERT in same operation.
     */
    getOrCreateCriterion(normalizedName, displayName) {
        const existing = db.prepare('SELECT id FROM criteria WHERE normalized_name = ?').get(normalizedName);
        if (existing) return existing.id;

        const stmt = db.prepare('INSERT INTO criteria (normalized_name, display_name) VALUES (?, ?)');
        const info = stmt.run(normalizedName, displayName);
        return info.lastInsertRowid;
    }

    /**
     * Links a criterion to an entity.
     * @method addEntityCriterion
     * @param {number} entityId - The entity ID.
     * @param {number} criterionId - The criterion ID.
     * @param {boolean} [isRequired=true] - Whether the criterion is required.
     * @returns {void}
     * @why_not_base - Inserts into 'entity_criteria' junction table (not base table).
     */
    addEntityCriterion(entityId, criterionId, isRequired = true) {
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO entity_criteria (entity_id, criterion_id, is_required) 
            VALUES (?, ?, ?)
        `);
        stmt.run(entityId, criterionId, isRequired ? 1 : 0);
    }

    /**
     * Retrieves all criteria for an entity.
     * @method getEntityCriteria
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of criterion objects.
     * @why_not_base - Requires JOIN between entity_criteria and criteria tables.
     */
    getEntityCriteria(entityId) {
        const stmt = db.prepare(`
            SELECT c.id, c.normalized_name, c.display_name, c.dimension, ec.is_required, d.id as dimension_id
            FROM entity_criteria ec
            JOIN criteria c ON ec.criterion_id = c.id
            LEFT JOIN dimensions d ON c.dimension = d.name
            WHERE ec.entity_id = ?
        `);
        return stmt.all(entityId);
    }


}

module.exports = new EntityRepo();
