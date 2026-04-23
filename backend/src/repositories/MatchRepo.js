/**
 * @module MatchRepo
 * @description Data Access Layer for Match entity using Class Table Inheritance (CTI).
 * * @responsibility
 * - Executes all SQL CRUD queries related to entity matches.
 * - Maps raw SQLite rows into match objects.
 * * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT interact with the file system or AI.
 * - ❌ This layer ONLY handles database operations.
 */

const path = require('path');
const BaseEntityRepo = require('./BaseEntityRepo');
const { ENTITY_TYPES } = require('../config/constants');

/**
 * @class MatchRepo
 * @extends BaseEntityRepo
 * @description Repository for entity match CRUD operations.
 *
 * @socexplanation
 * Error handling was refactored to explicitly catch and log data corruption/math failures
 * via injected LogService, eliminating silent failures while maintaining graceful degradation.
 */
class MatchRepo extends BaseEntityRepo {
    /**
     * Creates a new MatchRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     * @param {Object} deps.logService - Optional LogService instance.
     */
    constructor({ db, logService }) {
        super({ db, logService });
    }

    /**
     * @private
     * Generates the base SQL SELECT query for match retrieval.
     * Centralizes the massive CTI JOIN structure to enforce DRY principles.
     * @param {string} [whereClause=''] - Optional WHERE conditions.
     * @param {string} [orderBy='ORDER BY em_base.created_at DESC'] - Optional ORDER BY clause.
     * @returns {string} The constructed SQL query.
     */
    _getBaseSelectQuery(whereClause = '', orderBy = 'ORDER BY em_base.created_at DESC') {
        return `
            SELECT
                em_base.id,
                em_base.entity_type,
                em_base.entity_type as type,
                em_base.nicename,
                em_base.normalized_name,
                em_base.nice_name_line_1,
                em_base.nice_name_line_2,
                em_base.is_busy,
                em_base.master_file,
                em_child.requirement_id,
                em_child.offering_id,
                em_child.match_score,
                (SELECT file_name FROM documents WHERE entity_id = em_base.id AND doc_type = 'Match Report' LIMIT 1) as report_path,
                em_base.folder_path,
                em_base.status,
                em_base.error,
                em_base.hash,
                em_base.is_staged,
                em_base.created_at,
                em_base.updated_at,
                em_base.metadata,
                re.nicename as requirement_name,
                re.nice_name_line_1 as requirement_nice_name_line_1,
                re.nice_name_line_2 as requirement_nice_name_line_2,
                re.entity_type as requirement_type,
                re.metadata as requirement_metadata,
                re.blueprint_id as requirement_blueprint_id,
                oe.nicename as offering_name,
                oe.nice_name_line_1 as offering_nice_name_line_1,
                oe.nice_name_line_2 as offering_nice_name_line_2,
                oe.entity_type as offering_type,
                oe.metadata as offering_metadata,
                oe.blueprint_id as offering_blueprint_id
            FROM entities_base em_base
            JOIN entities_match em_child ON em_base.id = em_child.entity_id
            JOIN entities_base re ON em_child.requirement_id = re.id
            JOIN entities_base oe ON em_child.offering_id = oe.id
            ${whereClause ? `WHERE ${whereClause}` : ''}
            ${orderBy}
        `;
    }

    /**
     * Retrieves all matches with requirement and offering entity details.
     * @method getAllMatches
     * @returns {Array<Object>} Array of match objects with requirement and offering details.
     * @why_not_base - Requires INNER JOIN with entities table twice (requirement and offering)
     *                 to fetch related entity data in single query.
     * @socexplanation
     * - This method uses Class Table Inheritance (CTI) pattern.
     * - Lifecycle data (id, status, folder_path, error, metadata, timestamps) lives in entities_base.
     * - Match-specific data (requirement_id, offering_id, match_score) lives in entities_match.
     * - The CTI complexity is abstracted here so MatchService receives the same object shape as before.
     */
    getAllMatches() {
        const stmt = this.db.prepare(this._getBaseSelectQuery());
        return stmt.all();
    }

    /**
     * Retrieves matches with pagination, search, and status filtering.
     * @method getPaginatedMatches
     * @param {Object} matchQueryDto - The DTO containing query parameters
     * @param {number} matchQueryDto.limit - Max number of records to return
     * @param {number} matchQueryDto.offset - Number of records to skip
     * @param {string} matchQueryDto.search - Search term for entity names
     * @param {string} matchQueryDto.status - Status filter
     * @returns {Object} Object containing matches array and total count.
     */
    getPaginatedMatches({ limit, offset, search, status }) {
        let baseQuery = `
            FROM entities_base em_base
            JOIN entities_match em_child ON em_base.id = em_child.entity_id
            JOIN entities_base re ON em_child.requirement_id = re.id
            JOIN entities_base oe ON em_child.offering_id = oe.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            baseQuery += ` AND (re.nicename LIKE ? OR oe.nicename LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (status && status !== 'all') {
            const statusArray = Array.isArray(status) ? status : String(status).split(',');
            const cleanStatuses = statusArray.map(s => s.trim().toLowerCase()).filter(Boolean);

            if (cleanStatuses.length > 0) {
                const placeholders = cleanStatuses.map(() => '?').join(', ');
                baseQuery += ` AND em_base.status IN (${placeholders})`;
                params.push(...cleanStatuses);
            }
        }

        const countStmt = this.db.prepare(`SELECT COUNT(*) as count ${baseQuery}`);
        const total = countStmt.get(...params).count;

        const dataQuery = `
            SELECT
                em_base.id,
                em_base.entity_type,
                em_base.entity_type as type,
                em_base.nicename,
                em_base.normalized_name,
                em_base.nice_name_line_1,
                em_base.nice_name_line_2,
                em_base.is_busy,
                em_base.master_file,
                em_child.requirement_id,
                em_child.offering_id,
                em_child.match_score,
                (SELECT file_name FROM documents WHERE entity_id = em_base.id AND doc_type = 'Match Report' LIMIT 1) as report_path,
                em_base.folder_path,
                em_base.status,
                em_base.error,
                em_base.hash,
                em_base.created_at,
                em_base.updated_at,
                em_base.metadata,
                re.nicename as requirement_name,
                re.nice_name_line_1 as requirement_nice_name_line_1,
                re.nice_name_line_2 as requirement_nice_name_line_2,
                re.entity_type as requirement_type,
                re.metadata as requirement_metadata,
                re.blueprint_id as requirement_blueprint_id,
                oe.nicename as offering_name,
                oe.nice_name_line_1 as offering_nice_name_line_1,
                oe.nice_name_line_2 as offering_nice_name_line_2,
                oe.entity_type as offering_type,
                oe.metadata as offering_metadata,
                oe.blueprint_id as offering_blueprint_id
            ${baseQuery}
            ORDER BY em_base.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limit, offset];
        const stmt = this.db.prepare(dataQuery);
        const matches = stmt.all(...dataParams);

        return { matches, total };
    }

    /**
     * Creates a new entity match record.
     * @method createMatch
     * @param {Object} matchDto - The match DTO object.
     * @param {number} matchDto.requirementId - The requirement entity ID.
     * @param {number} matchDto.offeringId - The offering entity ID.
     * @param {number|null} [matchDto.matchScore] - The computed match score.
     * @param {string|null} [matchDto.folderPath] - Absolute path to the match folder (for file operations).
     * @param {string|null} [matchDto.folderName] - Relative folder name for database storage.
     * @param {string} [matchDto.status='pending'] - The match status.
     * @returns {number} The ID of the newly created match record.
     * @socexplanation
     * - Uses CTI pattern: inserts into entities_base for lifecycle data, then entities_match for specific data.
     * - Transaction ensures atomicity - both inserts succeed or fail together.
     * - Returns the same ID that MatchService expects, hiding the CTI structure from the Service layer.
     */
    createMatch(matchDto) {
        const { requirementId, offeringId, matchScore, folderPath, folderName, status = 'pending', hash, nicename = 'Match', niceNameLine1 = 'Unknown', niceNameLine2 = 'Unknown', isStaged } = matchDto;

        const storedFolderPath = folderName || (folderPath ? path.basename(folderPath) : null);

        const executeTransaction = this.db.transaction(() => {
            const baseStmt = this.db.prepare(`
                INSERT INTO entities_base (entity_type, nicename, normalized_name, nice_name_line_1, nice_name_line_2, folder_path, status, hash, is_staged)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const baseInfo = baseStmt.run(ENTITY_TYPES.MATCH, nicename, ENTITY_TYPES.MATCH, niceNameLine1, niceNameLine2, storedFolderPath || null, status, hash || null, isStaged !== undefined ? (isStaged ? 1 : 0) : 1);
            const entityId = baseInfo.lastInsertRowid;

            const childStmt = this.db.prepare(`
                INSERT INTO entities_match (entity_id, requirement_id, offering_id, match_score)
                VALUES (?, ?, ?, ?)
            `);
            childStmt.run(entityId, requirementId, offeringId, matchScore || null);

            return entityId;
        });

        return executeTransaction();
    }

    /**
     * Retrieves all matches for a specific requirement entity.
     * @method getMatchesForRequirement
     * @param {number} requirementId - The requirement entity ID.
     * @returns {Array<Object>} Array of match objects.
     * @why_not_base - Requires JOIN with entities table to fetch offering entity details.
     */
    getMatchesForRequirement(requirementId) {
        const stmt = this.db.prepare(this._getBaseSelectQuery('em_child.requirement_id = ?'));
        return stmt.all(requirementId);
    }

    /**
     * Retrieves all matches for a specific offering entity.
     * @method getMatchesForOffering
     * @param {number} offeringId - The offering entity ID.
     * @returns {Array<Object>} Array of match objects.
     * @why_not_base - Requires JOIN with entities table to fetch requirement entity details.
     */
    getMatchesForOffering(offeringId) {
        const stmt = this.db.prepare(this._getBaseSelectQuery('em_child.offering_id = ?'));
        return stmt.all(offeringId);
    }


    /**
     * Retrieves a specific match by requirement and offering entity IDs.
     * @method getMatchByRequirementAndOffering
     * @param {number} requirementId - The requirement entity ID.
     * @param {number} offeringId - The offering entity ID.
     * @returns {Object|null} The match record or null.
     * @why_not_base - Requires INNER JOIN with entities table twice for composite key lookup.
     */
    getMatchByRequirementAndOffering(requirementId, offeringId) {
        const stmt = this.db.prepare(this._getBaseSelectQuery('em_child.requirement_id = ? AND em_child.offering_id = ?', ''));
        return stmt.get(requirementId, offeringId);
    }

    /**
     * Retrieves a specific match by ID.
     * @method getMatchById
     * @param {number} id - The match ID.
     * @returns {Object|null} The match record with requirement and offering details.
     * @why_not_base - Requires INNER JOIN with entities table twice to fetch related entity details.
     */
    getMatchById(id) {
        const stmt = this.db.prepare(this._getBaseSelectQuery('em_base.id = ?', ''));
        return stmt.get(id);
    }

    /**
     * Updates the match score for an existing match.
     * @method updateMatchScore
     * @param {number} id - The match record ID.
     * @param {number} matchScore - The new match score.
     * @returns {boolean} True if the row was updated.
     */
    updateMatchScore(id, matchScore) {
        const stmt = this.db.prepare(`
            UPDATE entities_match SET match_score = ? WHERE entity_id = ?
        `);
        const info = stmt.run(matchScore, id);
        return info.changes > 0;
    }

    /**
     * Deletes a match record.
     * @method deleteMatch
     * @param {number} id - The match record ID.
     * @returns {void}
     * @why_not_base - Custom DELETE that may have cascade behavior (kept in child for explicit control).
     * @socexplanation
     * - Uses CTI pattern: deletes from entities_match (child) and entities_base (base) within a transaction.
     * - Transaction ensures atomicity - both deletes succeed or fail together, preventing orphaned rows.
     * - Wrapping cross-table CTI writes in a transaction ensures referential integrity and prevents orphaned rows.
     */
    deleteMatch(id) {
        const executeTransaction = this.db.transaction(() => {
            const stmt = this.db.prepare('DELETE FROM entities_match WHERE entity_id = ?');
            stmt.run(id);
            const baseStmt = this.db.prepare('DELETE FROM entities_base WHERE id = ?');
            baseStmt.run(id);
        });
        executeTransaction();
    }

    /**
     * Deletes all matches for a specific entity based on role column.
     * Combines deleteMatchesForRequirement and deleteMatchesForOffering into a single method.
     * @method deleteMatchesByEntityRole
     * @param {number} entityId - The entity ID.
     * @param {string} roleColumn - The column to target: 'requirement_id' or 'offering_id'.
     * @returns {void}
     * @why_not_base - Custom DELETE with dynamic column targeting.
     */
    deleteMatchesByEntityRole(entityId, roleColumn) {
        const stmt = this.db.prepare(`
            DELETE FROM entities_match WHERE ${roleColumn} = ?
        `);
        stmt.run(entityId);
    }
}

module.exports = MatchRepo;