/**
 * EntityFactory - Factory class for creating Domain Model instances in Class Table Inheritance (CTI) architecture.
 * Inspects the entity_type field from database rows to determine and instantiate the correct subclass.
 *
 * @class EntityFactory
 */
class EntityFactory {
    /**
     * Creates the appropriate entity instance based on the entity_type field in the row.
     * Handles safe JSON parsing for metadata and embedding fields.
     *
     * @static
     * @param {object} row - Database row containing entity data
     * @returns {BaseEntity|RequirementEntity|OfferingEntity|MatchEntity|CriterionEntity|null} Instance of the appropriate entity subclass, or null if row is falsy
     */
    static fromRow(row) {
        if (!row) return null;

        const entityType = row.entity_type || row.entityType || row.type;

        let parsedMetadata = null;
        if (row.metadata) {
            try {
                parsedMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            } catch (e) {
                parsedMetadata = null;
            }
        }

        let parsedEmbedding = null;
        if (row.embedding) {
            try {
                parsedEmbedding = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
            } catch (e) {
                parsedEmbedding = null;
            }
        }

        const data = {
            ...row,
            metadata: parsedMetadata,
            embedding: parsedEmbedding
        };

        switch (entityType) {
            case 'requirement':
                return new (require('./RequirementEntity'))(data);
            case 'offering':
                return new (require('./OfferingEntity'))(data);
            case 'match':
                return new (require('./MatchEntity'))(data);
            case 'criterion':
                return new (require('./CriterionEntity'))(data);
            default:
                return new (require('./BaseEntity'))(data);
        }
    }
}

module.exports = EntityFactory;