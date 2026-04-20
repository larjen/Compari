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

const BaseEntityRepo = require('./BaseEntityRepo');
const EntityFactory = require('../models/EntityFactory');
const HashGenerator = require('../utils/HashGenerator');

/**
 * @class CriteriaRepo
 * @extends BaseEntityRepo
 * @description Repository for criteria and entity-criteria relationship CRUD operations.
 * Implements Class Table Inheritance (CTI) pattern where:
 * - Base data (id, normalized_name, nicename) lives in entities_base
 * - Specific data (dimension, embedding) lives in entities_criterion
 */
class CriteriaRepo extends BaseEntityRepo {

    /**
     * Creates a new CriteriaRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     */
    constructor({ db }) {
        super({ db });
    }
    /**
     * Retrieves a criterion by its ID for deep-linking.
     * @param {number} id - The criterion ID.
     * @returns {Object|null} Criterion object with all fields.
     */
    getCriterionByIdForApi(id) {
        const stmt = this.db.prepare(`
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, ec.embedding
            FROM entities_base c
            JOIN entities_criterion ec ON c.id = ec.entity_id
            WHERE c.id = ? AND c.entity_type = 'criterion'
        `);
        const row = stmt.get(id);
        if (!row) return null;
        return {
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            hash: row.hash,
            dimension: row.dimension,
            embedding: JSON.parse(row.embedding)
        };
    }
    /**
     * Inserts a new criterion with its vector embedding and dimension.
     * Uses INSERT OR IGNORE to handle duplicate normalized names gracefully.
     * @method insertCriterion
     * @param {Object} criterionDto - The criterion data transfer object.
     * @param {string} criterionDto.normalizedName - The normalized criterion name for deduplication (e.g., "react", "python").
     * @param {string} criterionDto.displayName - The display-friendly criterion name for UI (e.g., "React", "Python").
     * @param {string} criterionDto.dimension - The dimension/category (e.g., "core_competencies", "soft_skills", "experience", "domain_knowledge", "cultural_fit").
     * @param {number[]} criterionDto.embeddingArray - Array of floats representing the criterion's embedding. Can be null for atomized extraction pipeline.
     * @returns {number} The criterion ID (existing or newly created).
     * @socexplanation
     * - Embedding is now optional (nullable) to support the atomized extraction pipeline
     *   where criteria may be created before vectorization occurs.
     * - Passing null ensures valid SQL NULL instead of undefined, preventing constraint violations.
     * @why_not_base - Custom INSERT OR IGNORE with SELECT to return ID; requires JSON.stringify for embedding.
     */
    insertCriterion({ normalizedName, displayName, dimension, embeddingArray, dimensionDisplayName }) {
        const embeddingStr = embeddingArray ? JSON.stringify(embeddingArray) : null;
        const hash = HashGenerator.generateDeterministicHash(`criterion:${normalizedName}`);

        const transaction = this.db.transaction(() => {
            const insertBaseStmt = this.db.prepare(`
                INSERT OR IGNORE INTO entities_base (entity_type, normalized_name, nicename, nice_name_line_1, nice_name_line_2, hash)
                VALUES ('criterion', ?, ?, ?, ?, ?)
            `);
            const line2 = dimensionDisplayName || dimension;
            insertBaseStmt.run(normalizedName, displayName, displayName, line2, hash);

            const getIdStmt = this.db.prepare(`
                SELECT id FROM entities_base WHERE normalized_name = ? AND entity_type = 'criterion'
            `);
            const existing = getIdStmt.get(normalizedName);
            if (!existing) return null;

            const insertChildStmt = this.db.prepare(`
                INSERT OR IGNORE INTO entities_criterion (entity_id, dimension, embedding)
                VALUES (?, ?, ?)
            `);
            insertChildStmt.run(existing.id, dimension, embeddingStr);

            return existing.id;
        });

        return transaction();
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
        const stmt = this.db.prepare(`
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, ec.embedding
            FROM entities_base c
            JOIN entities_criterion ec ON c.id = ec.entity_id
            WHERE c.normalized_name = ? AND c.entity_type = 'criterion'
        `);
        const row = stmt.get(normalizedName);
        if (!row) return null;

        return {
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            hash: row.hash,
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
        const stmt = this.db.prepare(`
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, ec.embedding
            FROM entities_base c
            JOIN entities_criterion ec ON c.id = ec.entity_id
            WHERE c.entity_type = 'criterion'
        `);
        const rows = stmt.all();

        return rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            hash: row.hash,
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
     * @param {number} [options.limit=200] - Items per page.
     * @param {string} [options.search] - Search term for displayName matching (case-insensitive).
     * @param {string} [options.dimension] - Optional dimension filter.
     * @returns {Object} Object with criteria array, totalPages, and totalCount.
     * 
     * @critical_sorting_rule
     * Results are sorted by dimension (alphabetically, nulls treated as empty string for sorting purposes),
     * then by displayName (alphabetically). Sorting is applied BEFORE OFFSET/LIMIT
     * to ensure dimension grouping headers persist across pages.
     */
    getPaginatedCriteria({ page = 1, limit = 200, search, dimension } = {}) {
        const params = [];
        let whereClauses = [];
        whereClauses.push("c.entity_type = 'criterion'");

        if (search && search.trim()) {
            whereClauses.push('LOWER(c.nicename) LIKE ?');
            params.push(`%${search.toLowerCase().trim()}%`);
        }

        if (dimension && dimension.trim()) {
            whereClauses.push('ec.dimension = ?');
            params.push(dimension.trim());
        }

        const whereClause = whereClauses.length > 0
            ? `WHERE ${whereClauses.join(' AND ')}`
            : '';

        const countSql = `
            SELECT COUNT(*) as total
            FROM entities_base c
            LEFT JOIN entities_criterion ec ON c.id = ec.entity_id
            ${whereClause}
        `;
        const countStmt = this.db.prepare(countSql);
        const countResult = countStmt.get(...params);
        const totalCount = countResult.total;

        const totalPages = Math.ceil(totalCount / limit) || 1;
        const safePage = Math.max(1, Math.min(page, totalPages));
        const offset = (safePage - 1) * limit;

        const sql = `
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, d.id as dimension_id
            FROM entities_base c
            LEFT JOIN entities_criterion ec ON c.id = ec.entity_id
            LEFT JOIN dimensions d ON ec.dimension = d.name
            ${whereClause}
            ORDER BY
                /* 1. Push Uncategorized (NULL IDs) to the bottom */
                CASE WHEN d.id IS NULL THEN 1 ELSE 0 END,
                /* 2. Sort chunks numerically by their Database ID */
                d.id ASC,
                /* 3. Sort pills alphabetically within each chunk */
                c.nicename ASC
            LIMIT ? OFFSET ?
        `;

        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params, limit, offset);

        const criteria = rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            hash: row.hash,
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
        const stmt = this.db.prepare(`
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
     * @socexplanation
     * - This method implements CTI by joining entities_base (as the base table) with entities_criterion (as the child table).
     * - The CTI pattern is completely abstracted away from the Service layer - the Service sees only the familiar criterion object structure.
     * - The JOIN maps nicename->displayName to maintain backward compatibility with existing service expectations.
     * @why_not_base - Requires JOIN between entity_criteria, entities_base, and entities_criterion tables; no embedding.
     */
    getCriteriaForEntity(entityId) {
        const stmt = this.db.prepare(`
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, link.is_required, d.id as dimension_id
            FROM entity_criteria link
            JOIN entities_base c ON link.criterion_id = c.id
            JOIN entities_criterion ec ON c.id = ec.entity_id
            LEFT JOIN dimensions d ON ec.dimension = d.name
            WHERE link.entity_id = ?
        `);
        const rows = stmt.all(entityId);

        return rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            hash: row.hash,
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
        const stmt = this.db.prepare(`
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, ec.embedding, link.is_required, d.id as dimension_id
            FROM entity_criteria link
            JOIN entities_base c ON link.criterion_id = c.id
            JOIN entities_criterion ec ON c.id = ec.entity_id
            LEFT JOIN dimensions d ON ec.dimension = d.name
            WHERE link.entity_id = ?
        `);
        const rows = stmt.all(entityId);

        return rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            hash: row.hash,
            dimension: row.dimension,
            dimensionId: row.dimension_id,
            embedding: JSON.parse(row.embedding),
            isRequired: row.is_required === 1
        }));
    }

    /**
     * Retrieves criteria with embeddings for multiple entities in a single query.
     * Optimizes N+1 query patterns by fetching all criteria for all entity IDs at once.
     * @method getCriteriaWithEmbeddingsForEntities
     * @param {number[]} entityIds - Array of entity IDs.
     * @returns {Object} Object with entity_id keys mapping to arrays of criterion objects.
     * @socexplanation
     * - Uses IN clause to fetch criteria for all entities in one SQL query.
     * - Groups results by entity_id in memory for O(1) lookup.
     * - Eliminates N+1 queries when evaluating matches against multiple opposite entities.
     */
    getCriteriaWithEmbeddingsForEntities(entityIds) {
        if (!entityIds || entityIds.length === 0) {
            return {};
        }

        const placeholders = entityIds.map(() => '?').join(', ');
        const stmt = this.db.prepare(`
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, ec.embedding, link.is_required, d.id as dimension_id, link.entity_id
            FROM entity_criteria link
            JOIN entities_base c ON link.criterion_id = c.id
            JOIN entities_criterion ec ON c.id = ec.entity_id
            LEFT JOIN dimensions d ON ec.dimension = d.name
            WHERE link.entity_id IN (${placeholders})
        `);
        const rows = stmt.all(...entityIds);

        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.entity_id]) {
                grouped[row.entity_id] = [];
            }
            grouped[row.entity_id].push({
                id: row.id,
                normalizedName: row.normalized_name,
                displayName: row.display_name,
                hash: row.hash,
                dimension: row.dimension,
                dimensionId: row.dimension_id,
                embedding: JSON.parse(row.embedding),
                isRequired: row.is_required === 1
            });
        }

        return grouped;
    }

    /**
     * Retrieves criteria linked to an entity that don't have embeddings yet.
     * Used for the vectorize criteria step in the atomized workflow.
     * @method getCriteriaWithoutEmbeddingsForEntity
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of criterion objects without embeddings.
     */
    getCriteriaWithoutEmbeddingsForEntity(entityId) {
        const stmt = this.db.prepare(`
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, ec.embedding, link.is_required, d.id as dimension_id
            FROM entity_criteria link
            JOIN entities_base c ON link.criterion_id = c.id
            JOIN entities_criterion ec ON c.id = ec.entity_id
            LEFT JOIN dimensions d ON ec.dimension = d.name
            WHERE link.entity_id = ? AND (ec.embedding IS NULL OR ec.embedding = '')
        `);
        const rows = stmt.all(entityId);

        return rows.map(row => ({
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            hash: row.hash,
            dimension: row.dimension,
            dimensionId: row.dimension_id,
            isRequired: row.is_required === 1
        }));
    }

    /**
     * Updates a criterion's embedding in the database.
     * @method updateCriterionEmbedding
     * @param {number} criterionId - The criterion ID.
     * @param {number[]} embedding - The embedding array to store.
     */
    updateCriterionEmbedding(criterionId, embedding) {
        const embeddingStr = JSON.stringify(embedding);
        const stmt = this.db.prepare('UPDATE entities_criterion SET embedding = ? WHERE entity_id = ?');
        stmt.run(embeddingStr, criterionId);
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
     *   - {number[]|null} embedding - Array of floats representing the embedding, or null if not yet vectorized.
     *   - {boolean} [isRequired] - Whether the criterion is required (for sources).
     * @returns {number} The number of criteria inserted/linked.
     * 
     * @socexplanation
     * - This method implements CTI by inserting into both entities_base and entities_criterion within a single transaction.
     * - The CTI pattern is completely abstracted away from the Service layer - the Service passes familiar criterion objects and receives back criterion IDs without knowing about the underlying base/child table split.
     * - Embedding is now optional (nullable) to support the atomized extraction pipeline where criteria may be created before vectorization occurs.
     * - Passing null ensures valid SQL NULL instead of undefined, preventing constraint violations.
     * 
     * @performance_benefits
     * - Uses `this.db.transaction()` to batch all inserts into a single atomic operation.
     * - Reduces disk I/O by executing multiple INSERT statements in one transaction.
     * - If any insert fails, the entire batch rolls back, ensuring data consistency.
     * - Eliminates the overhead of multiple database round-trips when processing dozens of criteria.
     * - better-sqlite3's transaction provides implicit prepared statement caching within the transaction.
     */
    _processCriteriaBatch(entityId, criteriaArray) {
        const insertBaseStmt = this.db.prepare(`
            INSERT OR IGNORE INTO entities_base (entity_type, normalized_name, nicename, nice_name_line_1, nice_name_line_2, hash)
            VALUES ('criterion', ?, ?, ?, ?, ?)
        `);

        const getCriterionIdStmt = this.db.prepare(`
            SELECT id FROM entities_base WHERE normalized_name = ? AND entity_type = 'criterion'
        `);

        const insertChildStmt = this.db.prepare(`
            INSERT OR IGNORE INTO entities_criterion (entity_id, dimension, embedding)
            VALUES (?, ?, ?)
        `);

        const linkEntityStmt = this.db.prepare(`
            INSERT OR IGNORE INTO entity_criteria (entity_id, criterion_id, is_required)
            VALUES (?, ?, ?)
        `);

        const transaction = this.db.transaction(() => {
            let count = 0;
            for (const criteria of criteriaArray) {
                const embeddingStr = criteria.embedding ? JSON.stringify(criteria.embedding) : null;
                const hash = HashGenerator.generateDeterministicHash(`criterion:${criteria.normalizedName}`);
                const line2 = criteria.dimensionDisplayName || criteria.dimension;
                insertBaseStmt.run(criteria.normalizedName, criteria.displayName, criteria.displayName, line2, hash);

                const existing = getCriterionIdStmt.get(criteria.normalizedName);
                if (existing) {
                    insertChildStmt.run(existing.id, criteria.dimension, embeddingStr);

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
     * - Uses `this.db.transaction()` to batch all inserts into a single atomic operation.
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
        const stmt = this.db.prepare(`
            SELECT e.* FROM entities_base e
            JOIN entity_criteria ec ON e.id = ec.entity_id
            WHERE ec.criterion_id = ? AND e.entity_type = 'requirement'
            ORDER BY e.id DESC
        `);
        const rows = stmt.all(criterionId);
        return rows.map(row => EntityFactory.fromRow(row));
    }

    /**
     * Retrieves all target entities associated with a specific criterion.
     * @method getAssociatedTargets
     * @param {number} criterionId - The criterion ID.
     * @returns {Array<Entity>} Array of Entity objects of type 'target'.
     * @why_not_base - Requires JOIN between entities and entity_criteria tables; custom Entity model mapping.
     */
    getAssociatedTargets(criterionId) {
        const stmt = this.db.prepare(`
            SELECT e.* FROM entities_base e
            JOIN entity_criteria ec ON e.id = ec.entity_id
            WHERE ec.criterion_id = ? AND e.entity_type = 'offering'
            ORDER BY e.id DESC
        `);
        const rows = stmt.all(criterionId);
        return rows.map(row => EntityFactory.fromRow(row));
    }

    /**
     * Retrieves a criterion by its ID.
     * @method getCriterionById
     * @param {number} id - The criterion ID.
     * @returns {Object|null} Criterion object or null.
     * @why_not_base - Custom return format with JSON.parse for embedding array.
     */
    getCriterionById(id) {
        const stmt = this.db.prepare(`
            SELECT c.id, c.normalized_name, c.nicename as display_name, c.hash, ec.dimension, ec.embedding
            FROM entities_base c
            JOIN entities_criterion ec ON c.id = ec.entity_id
            WHERE c.id = ? AND c.entity_type = 'criterion'
        `);
        const row = stmt.get(id);
        if (!row) return null;
        return {
            id: row.id,
            normalizedName: row.normalized_name,
            displayName: row.display_name,
            hash: row.hash,
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
        const transaction = this.db.transaction(() => {
            const insertMergeHistoryStmt = this.db.prepare(`
                INSERT INTO criterion_merge_history (keep_id, merged_display_name)
                VALUES (?, ?)
            `);
            insertMergeHistoryStmt.run(keepId, removeDisplayName);

            this.db.prepare(`
                INSERT OR IGNORE INTO entity_criteria (entity_id, criterion_id, is_required)
                SELECT entity_id, ?, is_required FROM entity_criteria WHERE criterion_id = ?
            `).run(keepId, removeId);

            this.db.prepare('DELETE FROM entity_criteria WHERE criterion_id = ?').run(removeId);
            this.db.prepare('DELETE FROM entities_criterion WHERE entity_id = ?').run(removeId);
            this.db.prepare('DELETE FROM entities_base WHERE id = ?').run(removeId);
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
        const stmt = this.db.prepare(`
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
        const stmt = this.db.prepare('DELETE FROM entities_base WHERE id = ? AND entity_type = ?');
        return stmt.run(id, 'criterion');
    }
}

/**
 * @dependency_injection
 * CriteriaRepo exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * @param {Object} deps - Dependencies object.
 * @param {Object} deps.db - The database instance (injected).
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = CriteriaRepo;