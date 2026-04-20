/**
 * @module BaseEntityRepo
 * @description Shared Data Access Layer for all entity types using Class Table Inheritance (CTI).
 * @responsibility
 * - Consolidates redundant CRUD operations from EntityRepo, MatchRepo, and CriteriaRepo.
 * - Provides unified methods for operating on entities_base and documents tables.
 * - Enforces DRY principle by eliminating repeated SQL patterns across entity repositories.
 * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT interact with the file system or AI.
 * - ❌ This layer ONLY handles database operations.
 */

const BaseRepository = require('./BaseRepository');

/**
 * @class BaseEntityRepo
 * @extends BaseRepository
 * @description Base repository for CTI entity operations.
 * Provides shared methods for status, error, folder path, metadata, and document management.
 */
class BaseEntityRepo extends BaseRepository {
    /**
     * Creates a new BaseEntityRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     */
    constructor({ db }) {
        super('entities_base', { db });
    }

    /**
     * Updates the status for an entity.
     * @method updateStatus
     * @param {number} id - The entity ID.
     * @param {string} status - The new status (sanitized to lowercase and trimmed).
     * @returns {boolean} True if the row was updated.
     * @responsibility Provides unified status update for all entity types.
     */
    updateStatus(id, status) {
        const sanitizedStatus = status ? String(status).toLowerCase().trim() : null;
        return super.update(id, { status: sanitizedStatus });
    }

    /**
     * Updates the error message for an entity.
     * @method updateError
     * @param {number} id - The entity ID.
     * @param {string|null} error - The error message.
     * @returns {boolean} True if the row was updated.
     * @responsibility Provides unified error update for all entity types.
     */
    updateError(id, error) {
        return super.update(id, { error });
    }

    /**
     * Updates the is_busy flag for an entity.
     * @method updateIsBusy
     * @param {number} id - The entity ID.
     * @param {boolean} isBusy - The busy status (cast to 1 or 0).
     * @returns {boolean} True if the row was updated.
     * @responsibility Provides unified is_busy update for all entity types.
     */
    updateIsBusy(id, isBusy) {
        const busyValue = isBusy ? 1 : 0;
        return super.update(id, { is_busy: busyValue });
    }

    /**
     * Updates the folder path for an entity.
     * @method updateFolderPath
     * @param {number} id - The entity ID.
     * @param {string} folderPath - The new folder path.
     * @returns {boolean} True if the row was updated.
     * @responsibility Provides unified folder path update for all entity types.
     */
    updateFolderPath(id, folderPath) {
        return super.update(id, { folder_path: folderPath });
    }

    /**
     * Updates the metadata for an entity.
     * @method updateMetadata
     * @param {number} id - The entity ID.
     * @param {Object} metadata - The metadata object (stringified before storage).
     * @returns {void}
     * @responsibility Provides unified metadata update for all entity types.
     */
    updateMetadata(id, metadata) {
        const metadataStr = JSON.stringify(metadata);
        const stmt = this.db.prepare(`
            UPDATE entities_base SET metadata = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(metadataStr, id);
    }

    /**
     * Registers a document record for an entity.
     * @method registerDocumentRecord
     * @param {Object} documentDto - The DTO containing document data.
     * @param {number} documentDto.entityId - The entity ID.
     * @param {string} documentDto.docType - The document type.
     * @param {string} documentDto.fileName - The file name.
     * @returns {void}
     * @responsibility Provides unified document registration for all entity types.
     */
    registerDocumentRecord({ entityId, docType, fileName }) {
        const stmt = this.db.prepare(`
            INSERT INTO documents (entity_id, doc_type, file_name)
            VALUES (?, ?, ?)
        `);
        stmt.run(entityId, docType, fileName);
    }

    /**
     * Retrieves all documents for an entity.
     * @method getDocuments
     * @param {number} entityId - The entity ID.
     * @returns {Array<Object>} Array of document objects.
     * @responsibility Provides unified document retrieval for all entity types.
     */
    getDocuments(entityId) {
        const stmt = this.db.prepare('SELECT * FROM documents WHERE entity_id = ?');
        const rows = stmt.all(entityId);
        return rows;
    }

    /**
     * Updates the master_file for an entity.
     * @method updateMasterFile
     * @param {number} id - The entity ID.
     * @param {string} fileName - The master file name (e.g., 'master.md').
     * @returns {void}
     * @responsibility Provides unified master file registration for all entity types.
     */
    updateMasterFile(id, fileName) {
        this.db.prepare('UPDATE entities_base SET master_file = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(fileName, id);
    }

    /**
     * Retrieves all entities across all types that are stuck in a processing state.
     * @method getStuckEntities
     * @returns {Array<Object>} Array of objects containing id, entity_type, and status.
     * @responsibility Provides a highly optimized, generic sweep for background workers without needing child-table JOINs.
     */
    getStuckEntities() {
        const stmt = this.db.prepare(`
            SELECT id, entity_type, status
            FROM entities_base
            WHERE status IN ('processing')
            ORDER BY updated_at ASC
        `);
        return stmt.all();
    }
}

/**
 * @dependency_injection
 * BaseEntityRepo exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * @param {Object} deps - Dependencies object.
 * @param {Object} deps.db - The database instance (injected).
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = BaseEntityRepo;