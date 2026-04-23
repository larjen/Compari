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
const EntityFactory = require('../models/EntityFactory');
const HashGenerator = require('../utils/HashGenerator');
const { ENTITY_STATUS } = require('../config/constants');

/**
 * @class BaseEntityRepo
 * @extends BaseRepository
 * @description Base repository for CTI entity operations.
 * Provides shared methods for status, error, folder path, metadata, and document management.
 *
 * @socexplanation
 * Error handling was refactored to explicitly catch and log data corruption/math failures
 * via injected LogService, eliminating silent failures while maintaining graceful degradation.
 */
class BaseEntityRepo extends BaseRepository {
    /**
     * Creates a new BaseEntityRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     * @param {Object} deps.logService - Optional LogService instance.
     */
    constructor({ db, logService }) {
        super('entities_base', { db });
        this._logService = logService;
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
     * Updates the is_staged flag for an entity.
     * @method updateIsStaged
     * @param {number} id - The entity ID.
     * @param {boolean} isStaged - The staged status.
     * @returns {boolean} True if the row was updated.
     */
    updateIsStaged(id, isStaged) {
        const stagedValue = isStaged ? 1 : 0;
        return super.update(id, { is_staged: stagedValue });
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
     * Unified method to update both folder path and staging status.
     * Enforces Liskov Substitution Principle by providing a standard interface for all child repos.
     * @method updatePathAndStaging
     * @param {number} id - The entity ID.
     * @param {string} folderPath - The folder path.
     * @param {boolean|number} isStaged - The staging status.
     * @returns {boolean} True if the row was updated.
     */
    updatePathAndStaging(id, folderPath, isStaged) {
        const stagedValue = isStaged ? 1 : 0;
        return super.update(id, { folder_path: folderPath, is_staged: stagedValue });
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
            WHERE status NOT IN (?, ?, ?)
            ORDER BY updated_at ASC
        `);
        return stmt.all(ENTITY_STATUS.PENDING, ENTITY_STATUS.COMPLETED, ENTITY_STATUS.FAILED);
    }

    /**
     * Sanitizes a base entity DTO by setting default values for missing fields.
     * Ensures consistent data across all entity types by populating normalized_name,
     * nice_name_line_1, nice_name_line_2, and hash if not provided.
     *
     * @method _sanitizeBaseDto
     * @param {Object} dto - The data transfer object to sanitize.
     * @returns {Object} The sanitized DTO with default values set.
     * @private
     *
     * @responsibility
     * - Centralizes default value logic for base entity fields.
     * - Eliminates code duplication across child repositories.
     *
     * @socexplanation
     * - Called by child repositories before INSERT operations.
     * - Uses HashGenerator for deterministic hash creation.
     */
    _sanitizeBaseDto(dto) {
        const sanitized = { ...dto };

        if (!sanitized.normalizedName && !sanitized.normalized_name) {
            const nameForNormalization = sanitized.nicename || sanitized.name || 'entity';
            sanitized.normalized_name = nameForNormalization.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        }

        if (!sanitized.niceNameLine1 && !sanitized.nice_name_line_1) {
            sanitized.nice_name_line_1 = sanitized.nicename || sanitized.name || 'Unnamed';
        }

        if (!sanitized.niceNameLine2 && !sanitized.nice_name_line_2) {
            sanitized.nice_name_line_2 = sanitized.dimension || 'General';
        }

        if (!sanitized.hash) {
            const hashSource = `${sanitized.entityType || 'entity'}:${sanitized.normalized_name || sanitized.nicename || 'unknown'}`;
            sanitized.hash = HashGenerator.generateDeterministicHash(hashSource);
        }

        return sanitized;
    }

    /**
     * Retrieves all entities with a specific status.
     * @method getEntitiesByStatus
     * @param {string} status - The status to filter by.
     * @returns {Array<Object>} Array of entity instances.
     * @responsibility Provides unified status query for all entity types targeting entities_base.
     * @socexplanation Queries the shared entities_base table to find entities by status,
     * then maps results using EntityFactory for consistent domain model instantiation.
     */
    getEntitiesByStatus(status) {
        const stmt = this.db.prepare(`
            SELECT
                id,
                entity_type,
                nicename,
                nice_name_line_1,
                nice_name_line_2,
                folder_path,
                master_file,
                metadata,
                status,
                error,
                blueprint_id,
                hash,
                is_staged,
                created_at,
                updated_at
            FROM entities_base
            WHERE status = ?
            ORDER BY id DESC
        `);
        const rows = stmt.all(status);
        return rows.map(row => EntityFactory.fromRow(row, this._logService));
    }
}

module.exports = BaseEntityRepo;