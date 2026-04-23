const { ENTITY_TYPES } = require('../config/constants');

/**
 * EntityFactory - Factory class for creating Domain Model instances in Class Table Inheritance (CTI) architecture.
 * Inspects the entity_type field from database rows to determine and instantiate the correct subclass.
 *
 * @class EntityFactory
 *
 * @socexplanation
 * Error handling was refactored to explicitly catch and log data corruption/math failures
 * via injected LogService, eliminating silent failures while maintaining graceful degradation.
 *
 * @note
 * Path resolution is handled by EntityService.getEntityFolderPath() - this factory
 * returns raw data without hydration to preserve Single Source of Truth.
 */
class EntityFactory {
    /**
     * Creates the appropriate entity instance based on the entity_type field in the row.
     * Handles safe JSON parsing for metadata and embedding fields.
     * Returns raw folder_path without hydration - use EntityService.getEntityFolderPath() for resolved paths.
     *
     * @static
     * @param {object} row - Database row containing entity data
     * @param {object} [logService=null] - Optional LogService instance for logging parsing failures
     * @returns {BaseEntity|RequirementEntity|OfferingEntity|MatchEntity|CriterionEntity|null} Instance of the appropriate entity subclass, or null if row is falsy
     */
    static fromRow(row, logService = null) {
        if (!row) return null;

        const entityType = row.entity_type || row.entityType || row.type;

        let parsedMetadata = null;
        if (row.metadata) {
            try {
                parsedMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            } catch (err) {
                parsedMetadata = null;
                if (logService) {
                    logService.logSystemFault({ origin: 'EntityFactory', message: `Failed to parse metadata JSON for entity ID ${row.id}`, errorObj: err });
                }
            }
        }

        let parsedEmbedding = null;
        if (row.embedding) {
            try {
                parsedEmbedding = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
            } catch (err) {
                parsedEmbedding = null;
                if (logService) {
                    logService.logSystemFault({ origin: 'EntityFactory', message: `Failed to parse embedding JSON for entity ID ${row.id}`, errorObj: err });
                }
            }
        }

        const data = {
            ...row,
            metadata: parsedMetadata,
            embedding: parsedEmbedding,
            // Resilient casting for SQLite truthy values
            isStaged: row.is_staged == 1 || row.is_staged === true || row.is_staged === '1'
        };

        switch (entityType) {
            case ENTITY_TYPES.REQUIREMENT:
                return new (require('./RequirementEntity'))(data);
            case ENTITY_TYPES.OFFERING:
                return new (require('./OfferingEntity'))(data);
            case ENTITY_TYPES.MATCH:
                return new (require('./MatchEntity'))(data);
            case ENTITY_TYPES.CRITERION:
                return new (require('./CriterionEntity'))(data);
            default:
                return new (require('./BaseEntity'))(data);
        }
    }
}

module.exports = EntityFactory;