/**
 * CriterionEntity - Domain Model representing a Criterion in Class Table Inheritance (CTI) architecture.
 * Extends BaseEntity with criterion-specific attributes for embedding-based matching.
 * Maps to the criteria table in the database.
 *
 * @class CriterionEntity
 * @extends BaseEntity
 * @property {string|null} dimension - Dimension name or category for the criterion
 * @property {Array<number>|null} embedding - Vector embedding array for similarity matching
 */
class CriterionEntity extends require('./BaseEntity') {
    constructor(data = {}) {
        super(data);
        this.dimension = data.dimension || null;
        this.embedding = data.embedding || null;
    }

    /**
     * Safely parses the embedding field from JSON string
     * @param {string|Array<number>|null} embedding - The embedding data to parse
     * @returns {Array<number>|null} Parsed embedding array or null
     */
    static parseEmbedding(embedding) {
        if (!embedding) return null;
        if (Array.isArray(embedding)) return embedding;
        if (typeof embedding === 'string') {
            try {
                return JSON.parse(embedding);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /**
     * Converts the entity to a JSON-serializable object
     * @returns {object} JSON representation of the entity
     */
    toJSON() {
        return {
            ...super.toJSON(),
            dimension: this.dimension,
            embedding: this.embedding
        };
    }
}

module.exports = CriterionEntity;