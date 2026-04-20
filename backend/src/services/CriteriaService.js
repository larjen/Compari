/**
 * @module CriteriaService
 * @description Domain Service for criteria management - acts as the domain boundary between Controllers and Repositories.
 *
 * @responsibility
 * - Wraps CriteriaRepo to provide a clean API for criteria data access.
 * - Translates repository data into domain models suitable for Controllers.
 * - Encapsulates all criteria-related data access behind this service layer.
 *
 * @boundary_rules
 * - ✅ MAY call Repositories (CriteriaRepo).
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business logic or workflow orchestration.
 * - ❌ MUST NOT emit events directly (use EventService if needed).
 * - ❌ MUST NOT interact with file system or AI services (delegate to appropriate services).
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const { cosineSimilarity } = require('../utils/VectorMath');

class CriteriaService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.criteriaRepo - The CriteriaRepo instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ criteriaRepo }) {
        this._criteriaRepo = criteriaRepo;
    }

    /**
     * Retrieves paginated and filtered criteria from the database.
     * Implements server-side filtering, sorting, and pagination for scalable data access.
     *
     * @param {Object} options - Query options for pagination and filtering.
     * @param {number} [options.page=1] - The page number (1-indexed).
     * @param {number} [options.limit=300] - Number of items per page.
     * @param {string} [options.search] - Search term to match against displayName (case-insensitive).
     * @param {string} [options.dimension] - Optional dimension filter.
     * @returns {Object} Object containing criteria array, totalPages, and totalCount.
     *
     * @critical_sorting_rule
     * Results are sorted by dimension (alphabetically, nulls/uncategorized treated as last),
     * then by displayName (alphabetically). This sorting is applied BEFORE OFFSET/LIMIT
     * to ensure dimension grouping headers persist correctly across pages on the frontend.
     */
    getPaginatedCriteria({ page = 1, limit = 300, search, dimension } = {}) {
        return this._criteriaRepo.getPaginatedCriteria({ page, limit, search, dimension });
    }

    /**
     * Retrieves a criterion by its normalized name.
     * @param {string} normalizedName - The normalized criterion name to look up.
     * @returns {Object|null} Criterion object with id, normalizedName, displayName, and embedding (array), or null if not found.
     */
    getCriterionByName(normalizedName) {
        return this._criteriaRepo.getCriterionByName(normalizedName);
    }

    /**
     * Retrieves all criteria linked to a specific entity.
     * @method getCriteriaForEntity
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of criterion objects with normalizedName, displayName, isRequired flag, and embedding.
     */
    getCriteriaForEntity(entityId) {
        return this._criteriaRepo.getCriteriaForEntity(entityId);
    }

    /**
     * Retrieves all source and target entities associated with a specific criterion.
     * @param {number} criterionId - The criterion ID.
     * @returns {Object} Object containing sources and targets arrays.
     */
    getCriterionAssociations(criterionId) {
        return {
            sources: this._criteriaRepo.getAssociatedSources(criterionId),
            targets: this._criteriaRepo.getAssociatedTargets(criterionId)
        };
    }

    /**
     * Deletes a criterion and its associations.
     * @param {number} id - The criterion ID.
     * @returns {void}
     */
    deleteCriterion(id) {
        return this._criteriaRepo.deleteCriterion(id);
    }

    /**
     * Finds top similar criteria using vector embeddings.
     * @param {number} criterionId - The target criterion ID.
     * @param {number} limit - Max results to return.
     * @returns {Array<Object>} Array of objects containing { criterion, score }.
     */
    getSimilarCriteria(criterionId, limit = 10) {
        const target = this._criteriaRepo.getCriterionById(criterionId);
        if (!target) throw new Error('Criterion not found');

        const all = this._criteriaRepo._getAllCriteriaWithEmbeddings();
        const similarities = [];

        for (const c of all) {
            if (c.id === criterionId) continue;
            try {
                const sim = cosineSimilarity(target.embedding, c.embedding);
                similarities.push({ criterion: c, score: Number(Math.max(0, sim).toFixed(4)) });
            } catch (e) {
                console.error(`Failed to fetch similar criteria for ID ${criterionId}:`, e.stack || e);
                continue;
            }
        }

        return similarities.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    /**
     * Merges two criteria into one.
     * Records the merge history for audit purposes.
     *
     * @param {number} keepId - The ID to keep.
     * @param {number} removeId - The ID to remove.
     */
    mergeCriteria(keepId, removeId) {
        const removeCriterion = this._criteriaRepo.getCriterionById(removeId);
        if (!removeCriterion) {
            throw new Error('Criterion to remove not found');
        }
        this._criteriaRepo.mergeCriteria(keepId, removeId, removeCriterion.displayName);
    }

    /**
     * Retrieves the merge history for a specific criterion.
     * Returns all previously merged criteria names that were consolidated into this one.
     *
     * @method getMergeHistory
     * @param {number} id - The criterion ID to get history for.
     * @returns {Array<Object>} Array of history records.
     */
    getMergeHistory(id) {
        return this._criteriaRepo.getMergeHistory(id);
    }

    /**
     * Retrieves a single criterion by ID for deep-linking.
     * Delegates to CriteriaRepo to maintain strict data-access boundaries.
     * @method getCriterionByIdForApi
     * @param {number} id - The unique identifier of the criterion.
     * @returns {Object|null} The criterion object or null if not found.
     */
    getCriterionByIdForApi(id) {
        return this._criteriaRepo.getCriterionByIdForApi(id);
    }
}

module.exports = CriteriaService;