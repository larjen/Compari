/**
 * BaseEntity - Domain Model representing the base class in Class Table Inheritance (CTI) architecture.
 * This class contains shared attributes common to all entity types in the system.
 * All subclasses inherit from this base class to represent specific entity types.
 *
 * @class BaseEntity
 * @property {number|null} id - Unique identifier from the entities table
 * @property {string|null} entityType - Type discriminator for CTI (e.g., 'requirement', 'offering', 'match', 'criterion')
 * @property {string|null} folderPath - Path to the folder containing entity-related files
 * @property {string|null} masterFile - Path to the master file for this entity
 * @property {string} status - Current status of the entity (default: 'pending')
 * @property {boolean} isBusy - Indicates if the entity is currently being processed
 * @property {string|null} error - Error message if entity processing failed
 * @property {object|null} metadata - Additional JSON metadata stored with the entity
 * @property {Date|null} createdAt - Timestamp when the entity was created
 * @property {Date|null} updatedAt - Timestamp when the entity was last updated
 * @property {Array} attachedFiles - Array representing the 1-to-many relationship with documents table
 */
class BaseEntity {
    constructor(data = {}) {
        this.id = data.id || null;
        this.entityType = data.entityType || data.entity_type || data.type || null;
        this.nicename = data.nicename || data.name || null;
        this.normalizedName = data.normalizedName || data.normalized_name || null;
        this.folderPath = data.folderPath || data.folder_path || null;
        this.masterFile = data.masterFile || data.master_file || null;
        this.status = data.status || 'pending';
        this.isBusy = data.isBusy !== undefined ? data.isBusy : (data.is_busy === 1);
        this.error = data.error || null;
        this.metadata = data.metadata || null;
        this.blueprintId = data.blueprintId || data.blueprint_id || null;
        this.hash = data.hash || null;
        this.createdAt = data.createdAt || data.created_at || null;
        this.updatedAt = data.updatedAt || data.updated_at || null;
        this.attachedFiles = data.attachedFiles || data.attached_files || [];
        this.niceNameLine1 = data.niceNameLine1 || data.nice_name_line_1 || 'Unknown';
        this.niceNameLine2 = data.niceNameLine2 || data.nice_name_line_2 || 'Unknown';
        this.isStaged = data.isStaged !== undefined ? data.isStaged : (data.is_staged === 1 || data.is_staged === '1' || data.is_staged === true);
    }

    /**
     * Converts the entity to a JSON-serializable object
     * @returns {object} JSON representation of the entity
     */
    toJSON() {
        return {
            id: this.id,
            entityType: this.entityType,
            type: this.entityType,
            nicename: this.nicename,
            normalizedName: this.normalizedName,
            folderPath: this.folderPath,
            masterFile: this.masterFile,
            status: this.status,
            isBusy: this.isBusy,
            error: this.error,
            metadata: this.metadata,
            blueprintId: this.blueprintId,
            hash: this.hash,
            attachedFiles: this.attachedFiles,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            niceNameLine1: this.niceNameLine1,
            niceNameLine2: this.niceNameLine2,
            isStaged: this.isStaged
        };
    }
}

module.exports = BaseEntity;