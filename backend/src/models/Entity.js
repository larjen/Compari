/**
 * @class Entity
 * @description Domain Model representing a unified entity record.
 * * @responsibility
 * - Encapsulates the data structure for entities (both sources and targets).
 * - Provides static factory methods to map database rows to objects.
 * - Provides serialization methods (`toJSON`) for API responses.
 * * @boundary_rules
 * - ❌ MUST NOT contain Active Record logic (e.g., no `this.save()` that calls the DB).
 * - ❌ MUST NOT require or import Repositories, Services, or the Database.
 * - ✅ Pure data object; strictly for structure and transformation.
 * 
 * @property {string} status - The unified status of the entity. Must be one of ENTITY_STATUS constants.
 * (Note: queue_status has been deprecated and removed to respect DRY principles).
 */
class Entity {
    /**
     * Creates a new Entity instance.
     * @constructor
     * @param {Object} data - The entity data.
     * @param {number|null} [data.id] - The entity ID.
     * @param {string} [data.type] - The entity type ('requirement' or 'offering').
     * @param {string} [data.name] - The entity name (replaces position/first_name).
     * @param {string|null} [data.description] - The entity description (replaces company/last_name).
     * @param {string|null} [data.folder_path] - Path to the entity's folder.
     * @param {Object|null} [data.metadata] - Flexible JSON data (url, deadline, posted_date, email, phone, etc.).
     * @param {string} [data.status] - The unified entity status (must conform to ENTITY_STATUS).
     * @param {string|null} [data.error] - Error message if processing failed.
     * @param {number|null} [data.blueprintId] - The blueprint ID this entity belongs to.
     * @param {string|null} [data.created_at] - Creation timestamp.
     * @param {string|null} [data.updated_at] - Last update timestamp.
     */
    constructor(data = {}) {
        this.id = data.id || null;
        this.type = data.type || null;
        this.name = data.name || null;
        this.description = data.description || null;
        this.folderPath = data.folder_path || null;
        this.metadata = data.metadata || null;
        this.status = data.status || 'pending';
        this.error = data.error || null;
        this.blueprintId = data.blueprintId || null;
        this.createdAt = data.created_at || null;
        this.updatedAt = data.updated_at || null;
    }

    /**
     * Creates an Entity instance from a database row.
     * Safely parses the metadata JSON string into a JavaScript object.
     * @static
     * @param {Object} row - The SQLite row object.
     * @returns {Entity}
     */
    static fromRow(row) {
        if (!row) return null;
        
        let parsedMetadata = null;
        if (row.metadata) {
            try {
                parsedMetadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            } catch (e) {
                parsedMetadata = null;
            }
        }

        return new Entity({
            id: row.id,
            type: row.type,
            name: row.name,
            description: row.description,
            folder_path: row.folder_path,
            metadata: parsedMetadata,
            status: row.status,
            error: row.error,
            blueprintId: row.blueprint_id,
            created_at: row.created_at,
            updated_at: row.updated_at
        });
    }

    /**
     * Gets the display-friendly name for the entity.
     * This is a derived presentation-layer property that prioritizes the
     * AI-generated nice name from metadata over the raw entity name.
     * @returns {string} The nice name if available, otherwise the raw entity name.
     * @readonly
     */
    get niceName() {
        return this.metadata?.nice_name || this.name;
    }

    /**
     * Converts the model to a JSON-ready object for API responses.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            description: this.description,
            folder_path: this.folderPath,
            metadata: this.metadata,
            status: this.status,
            error: this.error,
            blueprint_id: this.blueprintId,
            created_at: this.createdAt,
            updated_at: this.updatedAt
        };
    }
}

module.exports = Entity;
