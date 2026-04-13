/**
 * @module CriteriaRepo
 * @description Data Access Layer for criteria and entity_criteria tables.
 * @responsibility
 * - Executes all SQL CRUD queries related to criteria (skills, knowledge, experience) and embeddings.
 * - Maps raw SQLite rows into criterion objects with parsed embeddings.
 * - Unifies job_listing_criteria and user_criteria into entity_criteria.
 * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events.
 * - ❌ MUST NOT interact with the file system or AI (except through passed data).
 */

const db = require('./Database');
const BaseRepository = require('./BaseRepository');
const Entity = require('../models/Entity');

/**
 * @class CriteriaRepo
 * @extends BaseRepository
 * @description Repository for criteria and entity-criteria relationship CRUD operations.
 */
class CriteriaRepo extends BaseRepository {
    /**
     * Creates a new CriteriaRepo instance.
     * @constructor
     */
    constructor() {
        super('criteria');
    }
    /**
     * Inserts a new criterion with its vector embedding and dimension.
     * Uses INSERT OR IGNORE to handle duplicate normalized names gracefully.
     * @method insertCriterion
     * @param {string} normalizedName - The normalized criterion name for deduplication (e.g., "react", "python").
     * @param {string} displayName - The display-friendly criterion name for UI (e.g., "React", "Python").
     * @param {string} dimension - The dimension/category (e.g., "core_competencies", "soft_skills", "experience", "domain_knowledge", "cultural_fit").
     * @param {number[]} embeddingArray - Array of floats representing the criterion's embedding.
     * @returns {number} The criterion ID (existing or newly created).
     * @why_not_base - Custom INSERT OR IGNORE with SELECT to return ID; requires JSON.stringify for embedding.
     */
    insertCriterion(normalizedName, displayName, dimension, embeddingArray) {
        const embeddingStr = JSON.stringify(embeddingArray);
        const stmt = db.prepare('INSERT OR IGNORE INTO criteria (normalized_name, display_name, dimension, embedding) VALUES (?, ?, ?, ?)');
        stmt.run(normalizedName, displayName, dimension, embeddingStr);

        const existing = db.prepare('SELECT id FROM criteria WHERE normalized_name = ?').get(normalizedName);
        return existing ? existing.id : null;
    }

    /**
     * Retrieves a criterion by its normalized name.
     * Parses the embedding JSON string back into an array of numbers.
     * @method getCriterionByName
     * @param {string} normalizedName - The normalized criterion name to look up.
     * @returns {Object|null} Criterion object with id, normalized_name, display_name, dimension, and embedding (array), or null if not found.
     * @why_not_base - Custom return format with JSON.parse for embedding array.
     */
    getCriterionByName(normalizedName) {
        const stmt = db.prepare('SELECT * FROM criteria WHERE normalized_name = ?');
        const row = stmt.get(normalizedName);
        if (!row) return null;

        return {
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            dimension: row.dimension,
            embedding: JSON.parse(row.embedding)
        };
    }

    /**
     * Internal method for retrieving all criteria WITH embeddings.
     * Used by CriteriaService for vector math operations.
     * @method _getAllCriteriaWithEmbeddings
     * @private
     * @returns {Array<Object>} Array of criterion objects with id, normalized_name, display_name, dimension, and embedding (array).
     */
    _getAllCriteriaWithEmbeddings() {
        const stmt = db.prepare('SELECT * FROM criteria');
        const rows = stmt.all();

        return rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            dimension: row.dimension,
            embedding: JSON.parse(row.embedding)
        }));
    }

    /**
     * Retrieves paginated and filtered criteria from the database.
     * Implements server-side filtering, sorting, and pagination.
     * 
     * @method getPaginatedCriteria
     * @param {Object} options - Query options.
     * @param {number} [options.page=1] - Page number (1-indexed).
     * @param {number} [options.limit=300] - Items per page.
     * @param {string} [options.search] - Search term for displayName matching (case-insensitive).
     * @param {string} [options.dimension] - Optional dimension filter.
     * @returns {Object} Object with criteria array, totalPages, and totalCount.
     * 
     * @critical_sorting_rule
     * Results are sorted by dimension (alphabetically, nulls treated as empty string for sorting purposes),
     * then by displayName (alphabetically). Sorting is applied BEFORE OFFSET/LIMIT
     * to ensure dimension grouping headers persist across pages.
     */
    getPaginatedCriteria({ page = 1, limit = 300, search, dimension } = {}) {
        const params = [];
        let whereClauses = [];

        if (search && search.trim()) {
            whereClauses.push('LOWER(c.display_name) LIKE ?');
            params.push(`%${search.toLowerCase().trim()}%`);
        }

        if (dimension && dimension.trim()) {
            whereClauses.push('c.dimension = ?');
            params.push(dimension.trim());
        }

        const whereClause = whereClauses.length > 0
            ? `WHERE ${whereClauses.join(' AND ')}`
            : '';

        const countSql = `SELECT COUNT(*) as total FROM criteria c ${whereClause}`;
        const countStmt = db.prepare(countSql);
        const countResult = countStmt.get(...params);
        const totalCount = countResult.total;

        const totalPages = Math.ceil(totalCount / limit) || 1;
        const safePage = Math.max(1, Math.min(page, totalPages));
        const offset = (safePage - 1) * limit;

        const sql = `
            SELECT c.id, c.normalized_name, c.display_name, c.dimension, d.id as dimension_id
            FROM criteria c
            LEFT JOIN dimensions d ON c.dimension = d.name
            ${whereClause}
            ORDER BY 
                /* 1. Push Uncategorized (NULL IDs) to the bottom */
                CASE WHEN d.id IS NULL THEN 1 ELSE 0 END,
                /* 2. Sort chunks numerically by their Database ID */
                d.id ASC,
                /* 3. Sort pills alphabetically within each chunk */
                c.display_name ASC
            LIMIT ? OFFSET ?
        `;

        const stmt = db.prepare(sql);
        const rows = stmt.all(...params, limit, offset);

        const criteria = rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            dimension: row.dimension,
            dimensionId: row.dimension_id
        }));

        return {
            criteria,
            totalPages,
            totalCount
        };
    }

    /**
     * Links a criterion to an entity.
     * Uses INSERT OR IGNORE to prevent duplicate links.
     * @method linkCriterionToEntity
     * @param {number} entityId - The entity ID.
     * @param {number} criterionId - The criterion ID to link.
     * @param {boolean} [isRequired=true] - Whether the criterion is required (true) or preferred (false).
     * @why_not_base - Inserts into 'entity_criteria' junction table (not base table).
     */
    linkCriterionToEntity(entityId, criterionId, isRequired = true) {
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO entity_criteria (entity_id, criterion_id, is_required) 
            VALUES (?, ?, ?)
        `);
        stmt.run(entityId, criterionId, isRequired ? 1 : 0);
    }

    /**
     * Retrieves all criteria linked to a specific entity.
     * Excludes embeddings for lightweight API responses.
     * @method getCriteriaForEntity
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of criterion objects with normalized_name, display_name, dimension, and is_required flag.
     * @why_not_base - Requires JOIN between entity_criteria and criteria tables; no embedding.
     */
    getCriteriaForEntity(entityId) {
        const stmt = db.prepare(`
            SELECT c.id, c.normalized_name, c.display_name, c.dimension, ec.is_required, d.id as dimension_id
            FROM entity_criteria ec
            JOIN criteria c ON ec.criterion_id = c.id
            LEFT JOIN dimensions d ON c.dimension = d.name
            WHERE ec.entity_id = ?
        `);
        const rows = stmt.all(entityId);

        return rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            dimension: row.dimension,
            dimensionId: row.dimension_id,
            isRequired: row.is_required === 1
        }));
    }

    /**
     * Retrieves all criteria linked to a specific entity, INCLUDING their heavy vector embeddings.
     * @method getCriteriaWithEmbeddingsForEntity
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of criterion objects with normalizedName, displayName, dimension, isRequired flag, AND parsed embedding array.
     * @socexplanation
     * - Unlike getCriteriaForEntity(), this method returns the heavy embedding payload.
     * - It is strictly reserved for internal backend processes (like the MatchingEngine) to prevent memory/bandwidth bloat on standard HTTP API responses.
     */
    getCriteriaWithEmbeddingsForEntity(entityId) {
        const stmt = db.prepare(`
            SELECT c.id, c.normalized_name, c.display_name, c.dimension, c.embedding, ec.is_required, d.id as dimension_id
            FROM entity_criteria ec
            JOIN criteria c ON ec.criterion_id = c.id
            LEFT JOIN dimensions d ON c.dimension = d.name
            WHERE ec.entity_id = ?
        `);
        const rows = stmt.all(entityId);

        return rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            dimension: row.dimension,
            dimensionId: row.dimension_id,
            embedding: JSON.parse(row.embedding),
            isRequired: row.is_required === 1
        }));
    }

    /**
     * Centralized batch insertion logic for criteria and entity linking.
     * This helper prevents code duplication between source and target criteria batch operations.
     * @method _processCriteriaBatch
     * @private
     * @param {number} entityId - The entity ID to associate criteria with.
     * @param {Array<Object>} criteriaArray - Array of criteria objects with properties:
     *   - {string} normalizedName - The normalized criterion name.
     *   - {string} displayName - The display-friendly criterion name.
     *   - {string} dimension - The dimension/category.
     *   - {number[]} embedding - Array of floats representing the embedding.
     *   - {boolean} [isRequired] - Whether the criterion is required (for sources).
     * @returns {number} The number of criteria inserted/linked.
     * 
     * @performance_benefits
     * - Uses `db.transaction()` to batch all inserts into a single atomic operation.
     * - Reduces disk I/O by executing multiple INSERT statements in one transaction.
     * - If any insert fails, the entire batch rolls back, ensuring data consistency.
     * - Eliminates the overhead of multiple database round-trips when processing dozens of criteria.
     * - better-sqlite3's transaction provides implicit prepared statement caching within the transaction.
     */
    _processCriteriaBatch(entityId, criteriaArray) {
        const insertCriterionStmt = db.prepare(`
            INSERT OR IGNORE INTO criteria (normalized_name, display_name, dimension, embedding)
            VALUES (?, ?, ?, ?)
        `);

        const getCriterionIdStmt = db.prepare('SELECT id FROM criteria WHERE normalized_name = ?');

        const linkEntityStmt = db.prepare(`
            INSERT OR IGNORE INTO entity_criteria (entity_id, criterion_id, is_required)
            VALUES (?, ?, ?)
        `);

        const transaction = db.transaction(() => {
            let count = 0;
            for (const criteria of criteriaArray) {
                const embeddingStr = JSON.stringify(criteria.embedding);
                insertCriterionStmt.run(criteria.normalizedName, criteria.displayName, criteria.dimension, embeddingStr);

                const existing = getCriterionIdStmt.get(criteria.normalizedName);
                if (existing) {
                    const isRequired = criteria.isRequired !== undefined ? criteria.isRequired : true;
                    linkEntityStmt.run(entityId, existing.id, isRequired ? 1 : 0);
                    count++;
                }
            }
            return count;
        });

        return transaction();
    }

    /**
     * Batch inserts criteria for an entity using a database transaction for optimal performance.
     * Combines the old insertJobCriteriaBatch and insertUserCriteriaBatch into a single method.
     * 
     * @method insertEntityCriteriaBatch
     * @param {number} entityId - The entity ID to associate criteria with.
     * @param {Array<Object>} criteriaArray - Array of criteria objects with properties:
     *   - {string} normalizedName - The normalized criterion name.
     *   - {string} displayName - The display-friendly criterion name.
     *   - {string} dimension - The dimension/category.
     *   - {number[]} embedding - Array of floats representing the embedding.
     *   - {boolean} [isRequired] - Whether the criterion is required (for sources).
     * @returns {number} The number of criteria inserted/linked.
     * 
     * @performance_benefits
     * - Uses `db.transaction()` to batch all inserts into a single atomic operation.
     * - Reduces disk I/O by executing multiple INSERT statements in one transaction.
     * - If any insert fails, the entire batch rolls back, ensuring data consistency.
     * - Eliminates the overhead of multiple database round-trips when processing dozens of criteria.
     * - better-sqlite3's transaction provides implicit prepared statement caching within the transaction.
     */
    insertEntityCriteriaBatch(entityId, criteriaArray) {
        if (!criteriaArray || criteriaArray.length === 0) {
            return 0;
        }

        return this._processCriteriaBatch(entityId, criteriaArray);
    }

    /**
     * Retrieves all source entities associated with a specific criterion.
     * @method getAssociatedSources
     * @param {number} criterionId - The criterion ID.
     * @returns {Array<Entity>} Array of Entity objects of type 'source'.
     * @why_not_base - Requires JOIN between entities and entity_criteria tables; custom Entity model mapping.
     */
    getAssociatedSources(criterionId) {
        const stmt = db.prepare(`
            SELECT e.* FROM entities e
            JOIN entity_criteria ec ON e.id = ec.entity_id
            WHERE ec.criterion_id = ? AND e.type = 'requirement'
            ORDER BY e.id DESC
        `);
        const rows = stmt.all(criterionId);
        return rows.map(row => Entity.fromRow(row));
    }

    /**
     * Retrieves all target entities associated with a specific criterion.
     * @method getAssociatedTargets
     * @param {number} criterionId - The criterion ID.
     * @returns {Array<Entity>} Array of Entity objects of type 'target'.
     * @why_not_base - Requires JOIN between entities and entity_criteria tables; custom Entity model mapping.
     */
    getAssociatedTargets(criterionId) {
        const stmt = db.prepare(`
            SELECT e.* FROM entities e
            JOIN entity_criteria ec ON e.id = ec.entity_id
            WHERE ec.criterion_id = ? AND e.type = 'offering'
            ORDER BY e.id DESC
        `);
        const rows = stmt.all(criterionId);
        return rows.map(row => Entity.fromRow(row));
    }

    /**
     * Retrieves a criterion by its ID.
     * @method getCriterionById
     * @param {number} id - The criterion ID.
     * @returns {Object|null} Criterion object or null.
     * @why_not_base - Custom return format with JSON.parse for embedding array.
     */
    getCriterionById(id) {
        const stmt = db.prepare('SELECT * FROM criteria WHERE id = ?');
        const row = stmt.get(id);
        if (!row) return null;
        return {
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            dimension: row.dimension,
            embedding: JSON.parse(row.embedding)
        };
    }

    /**
     * Merges removeId into keepId, transferring all entity links and deleting the old criterion.
     * Records the merge in the criterion_merge_history table for audit purposes.
     * 
     * @method mergeCriteria
     * @param {number} keepId - The ID to keep.
     * @param {number} removeId - The ID to remove.
     * @param {string} removeDisplayName - The display name of the criterion being removed (for history).
     * @returns {void}
     * @why_not_base - Complex transaction with INSERT to history, UPDATE of links, and DELETE across multiple tables.
     * @auto_merge_threshold - Criteria with >= 0.95 cosine similarity are auto-merged.
     * @historical_audit_trail - All merges are recorded in criterion_merge_history for traceability.
     */
    mergeCriteria(keepId, removeId, removeDisplayName) {
        const transaction = db.transaction(() => {
            const insertMergeHistoryStmt = db.prepare(`
                INSERT INTO criterion_merge_history (keep_id, merged_display_name)
                VALUES (?, ?)
            `);
            insertMergeHistoryStmt.run(keepId, removeDisplayName);

            db.prepare(`
                INSERT OR IGNORE INTO entity_criteria (entity_id, criterion_id, is_required)
                SELECT entity_id, ?, is_required FROM entity_criteria WHERE criterion_id = ?
            `).run(keepId, removeId);

            db.prepare('DELETE FROM entity_criteria WHERE criterion_id = ?').run(removeId);
            db.prepare('DELETE FROM criteria WHERE id = ?').run(removeId);
        });
        transaction();
    }

    /**
     * Retrieves the merge history for a specific criterion.
     * Returns all merged display names that were consolidated into this criterion.
     * 
     * @method getMergeHistory
     * @param {number} keepId - The criterion ID to get history for.
     * @returns {Array<Object>} Array of history records with id, keep_id, merged_display_name, and merged_at.
     * @why_not_base - Queries separate 'criterion_merge_history' table (not base table).
     */
    getMergeHistory(keepId) {
        const stmt = db.prepare(`
            SELECT id, keep_id, merged_display_name, merged_at
            FROM criterion_merge_history
            WHERE keep_id = ?
            ORDER BY merged_at DESC
        `);
        return stmt.all(keepId);
    }

    /**
     * Deletes a criterion by ID.
     * @method deleteCriterion
     * @param {number} id - The criterion ID.
     * @returns {Object} SQLite run result.
     * @why_not_base - Custom DELETE (kept for explicit control over cascade behavior).
     */
    deleteCriterion(id) {
        const stmt = db.prepare('DELETE FROM criteria WHERE id = ?');
        return stmt.run(id);
    }
}

module.exports = new CriteriaRepo();
