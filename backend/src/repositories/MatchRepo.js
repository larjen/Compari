/**
 * @module MatchRepo
 * @description Data Access Layer for `entity_matches` table.
 * * @responsibility
 * - Executes all SQL CRUD queries related to entity matches.
 * - Maps raw SQLite rows into match objects.
 * * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT interact with the file system or AI.
 * - ❌ This layer ONLY handles database operations.
 */

const db = require('./Database');
const BaseRepository = require('./BaseRepository');
const Entity = require('../models/Entity');

/**
 * @class MatchRepo
 * @extends BaseRepository
 * @description Repository for entity match CRUD operations.
 */
class MatchRepo extends BaseRepository {
    /**
     * Creates a new MatchRepo instance.
     * @constructor
     */
    constructor() {
        super('entity_matches');
    }
    /**
     * Retrieves all matches with requirement and offering entity details.
     * @method getAllMatches
     * @returns {Array<Object>} Array of match objects with requirement and offering details.
     * @why_not_base - Requires INNER JOIN with entities table twice (requirement and offering)
     *                 to fetch related entity data in single query.
     */
    getAllMatches() {
        const stmt = db.prepare(`
            SELECT 
                em.*,
                re.name as requirement_name,
                re.description as requirement_description,
                re.type as requirement_type,
                re.metadata as requirement_metadata,
                re.blueprint_id as requirement_blueprint_id,
                oe.name as offering_name,
                oe.description as offering_description,
                oe.type as offering_type,
                oe.metadata as offering_metadata,
                oe.blueprint_id as offering_blueprint_id
            FROM entity_matches em
            JOIN entities re ON em.requirement_id = re.id
            JOIN entities oe ON em.offering_id = oe.id
            ORDER BY em.created_at DESC
        `);
        const rows = stmt.all();
        return rows;
    }

    /**
     * Retrieves matches with pagination, search, and status filtering.
     * @method getPaginatedMatches
     * @param {number} limit - Max number of records to return.
     * @param {number} offset - Number of records to skip.
     * @param {string} search - Search term for entity names.
     * @param {string} status - Queue status filter.
     * @returns {Object} Object containing matches array and total count.
     */
    getPaginatedMatches(limit, offset, search, status) {
        let baseQuery = `
            FROM entity_matches em
            JOIN entities re ON em.requirement_id = re.id
            JOIN entities oe ON em.offering_id = oe.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            baseQuery += ` AND (re.name LIKE ? OR oe.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (status && status !== 'all') {
            baseQuery += ` AND em.queue_status = ?`;
            params.push(status);
        }

        const countStmt = db.prepare(`SELECT COUNT(*) as count ${baseQuery}`);
        const total = countStmt.get(...params).count;

        const dataQuery = `
            SELECT 
                em.*,
                re.name as requirement_name,
                re.description as requirement_description,
                re.type as requirement_type,
                re.metadata as requirement_metadata,
                re.blueprint_id as requirement_blueprint_id,
                oe.name as offering_name,
                oe.description as offering_description,
                oe.type as offering_type,
                oe.metadata as offering_metadata,
                oe.blueprint_id as offering_blueprint_id
            ${baseQuery}
            ORDER BY em.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const dataParams = [...params, limit, offset];
        const stmt = db.prepare(dataQuery);
        const matches = stmt.all(...dataParams);

        return { matches, total };
    }

    /**
     * Creates a new entity match record.
     * @method createMatch
     * @param {number} requirementId - The requirement entity ID.
     * @param {number} offeringId - The offering entity ID.
     * @param {number|null} matchScore - The computed match score.
     * @param {string|null} reportPath - Path to the generated match report.
     * @param {string|null} folderPath - Path to the match folder.
     * @param {string} [status='pending'] - The match status.
     * @returns {number} The ID of the newly created match record.
     * @why_not_base - Custom INSERT with specific columns and returns lastInsertRowid.
     */
    createMatch(requirementId, offeringId, matchScore, reportPath, folderPath, status = 'pending') {
        const stmt = db.prepare(`
            INSERT INTO entity_matches (requirement_id, offering_id, match_score, report_path, folder_path, queue_status, status)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `);
        const info = stmt.run(requirementId, offeringId, matchScore || null, reportPath || null, folderPath || null, status);
        return info.lastInsertRowid;
    }

    /**
     * Updates the queue status for an existing match.
     * @method updateMatchQueueStatus
     * @param {number} id - The match record ID.
     * @param {string} status - The new queue status ('pending', 'processing', 'completed', 'error').
     * @returns {void}
     * @why_not_base - Custom UPDATE with specific column targeting and timestamp.
     */
    updateMatchQueueStatus(id, status) {
        const stmt = db.prepare('UPDATE entity_matches SET queue_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(status, id);
    }

    /**
     * Updates the error for an existing match.
     * @method updateMatchError
     * @param {number} id - The match record ID.
     * @param {string|null} error - The error message.
     * @returns {void}
     * @why_not_base - Custom UPDATE with specific column targeting and timestamp.
     */
    updateMatchError(id, error) {
        const stmt = db.prepare('UPDATE entity_matches SET error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(error, id);
    }

    /**
     * Retrieves all matches for a specific requirement entity.
     * @method getMatchesForRequirement
     * @param {number} requirementId - The requirement entity ID.
     * @returns {Array<Object>} Array of match objects.
     * @why_not_base - Requires JOIN with entities table to fetch offering entity details.
     */
    getMatchesForRequirement(requirementId) {
        const stmt = db.prepare(`
            SELECT em.*,
                oe.name as offering_name,
                oe.description as offering_description,
                oe.type as offering_type,
                oe.metadata as offering_metadata,
                oe.blueprint_id as offering_blueprint_id
            FROM entity_matches em
            JOIN entities oe ON em.offering_id = oe.id
            WHERE em.requirement_id = ?
            ORDER BY em.created_at DESC
        `);
        const rows = stmt.all(requirementId);
        return rows;
    }

    /**
     * Retrieves all matches for a specific offering entity.
     * @method getMatchesForOffering
     * @param {number} offeringId - The offering entity ID.
     * @returns {Array<Object>} Array of match objects.
     * @why_not_base - Requires JOIN with entities table to fetch requirement entity details.
     */
    getMatchesForOffering(offeringId) {
        const stmt = db.prepare(`
            SELECT em.*,
                re.name as requirement_name,
                re.description as requirement_description,
                re.type as requirement_type,
                re.metadata as requirement_metadata,
                re.blueprint_id as requirement_blueprint_id
            FROM entity_matches em
            JOIN entities re ON em.requirement_id = re.id
            WHERE em.offering_id = ?
            ORDER BY em.created_at DESC
        `);
        const rows = stmt.all(offeringId);
        return rows;
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
        const stmt = db.prepare(`
            SELECT em.*,
                re.name as requirement_name,
                re.description as requirement_description,
                re.type as requirement_type,
                re.metadata as requirement_metadata,
                re.blueprint_id as requirement_blueprint_id,
                oe.name as offering_name,
                oe.description as offering_description,
                oe.type as offering_type,
                oe.metadata as offering_metadata,
                oe.blueprint_id as offering_blueprint_id
            FROM entity_matches em
            JOIN entities re ON em.requirement_id = re.id
            JOIN entities oe ON em.offering_id = oe.id
            WHERE em.requirement_id = ? AND em.offering_id = ?
        `);
        const row = stmt.get(requirementId, offeringId);
        return row;
    }

    /**
     * Retrieves a specific match by ID.
     * @method getMatchById
     * @param {number} id - The match ID.
     * @returns {Object|null} The match record with requirement and offering details.
     * @why_not_base - Requires INNER JOIN with entities table twice to fetch related entity details.
     */
    getMatchById(id) {
        const stmt = db.prepare(`
            SELECT 
                em.*,
                re.name as requirement_name,
                re.description as requirement_description,
                re.type as requirement_type,
                re.metadata as requirement_metadata,
                re.blueprint_id as requirement_blueprint_id,
                oe.name as offering_name,
                oe.description as offering_description,
                oe.type as offering_type,
                oe.metadata as offering_metadata,
                oe.blueprint_id as offering_blueprint_id
            FROM entity_matches em
            JOIN entities re ON em.requirement_id = re.id
            JOIN entities oe ON em.offering_id = oe.id
            WHERE em.id = ?
        `);
        return stmt.get(id);
    }

    /**
     * Updates the match score for an existing match.
     * @method updateMatchScore
     * @param {number} id - The match record ID.
     * @param {number} matchScore - The new match score.
     * @returns {void}
     * @why_not_base - Custom UPDATE with specific column targeting.
     */
    updateMatchScore(id, matchScore) {
        const stmt = db.prepare('UPDATE entity_matches SET match_score = ? WHERE id = ?');
        stmt.run(matchScore, id);
    }

    /**
     * Updates the report path for an existing match.
     * @method updateReportPath
     * @param {number} id - The match record ID.
     * @param {string} reportPath - The new report path.
     * @returns {void}
     * @why_not_base - Custom UPDATE with specific column targeting.
     */
    updateReportPath(id, reportPath) {
        const stmt = db.prepare('UPDATE entity_matches SET report_path = ? WHERE id = ?');
        stmt.run(reportPath, id);
    }

    /**
     * Updates the folder path for an existing match.
     * @method updateFolderPath
     * @param {number} id - The match record ID.
     * @param {string} folderPath - The new folder path.
     * @returns {void}
     * 
     * @socexplanation
     * - Delegates DB updates to the Repository to maintain strict data-access boundaries.
     * - Workflows and Services MUST NOT execute raw SQL; they must use Repository methods.
     * - This ensures centralized data access control and prevents boundary violations.
     */
    updateFolderPath(id, folderPath) {
        const stmt = db.prepare('UPDATE entity_matches SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(folderPath, id);
    }

    /**
     * Deletes a match record.
     * @method deleteMatch
     * @param {number} id - The match record ID.
     * @returns {void}
     * @why_not_base - Custom DELETE that may have cascade behavior (kept in child for explicit control).
     */
    deleteMatch(id) {
        const stmt = db.prepare('DELETE FROM entity_matches WHERE id = ?');
        stmt.run(id);
    }

    /**
     * Deletes all matches for a specific requirement entity.
     * @method deleteMatchesForRequirement
     * @param {number} requirementId - The requirement entity ID.
     * @returns {void}
     * @why_not_base - Custom DELETE with specific column targeting (requirement_id).
     */
    deleteMatchesForRequirement(requirementId) {
        const stmt = db.prepare('DELETE FROM entity_matches WHERE requirement_id = ?');
        stmt.run(requirementId);
    }

    /**
     * Deletes all matches for a specific offering entity.
     * @method deleteMatchesForOffering
     * @param {number} offeringId - The offering entity ID.
     * @returns {void}
     * @why_not_base - Custom DELETE with specific column targeting (offering_id).
     */
    deleteMatchesForOffering(offeringId) {
        const stmt = db.prepare('DELETE FROM entity_matches WHERE offering_id = ?');
        stmt.run(offeringId);
    }


    /**
     * Retrieves matches with a specific queue status.
     * @method getMatchesByQueueStatus
     * @param {string} queueStatus - The queue status to filter by.
     * @returns {Array<Object>} Array of match objects.
     * @why_not_base - Requires JOIN with entities table to fetch entity names.
     */
    getMatchesByQueueStatus(queueStatus) {
        const stmt = db.prepare(`
            SELECT em.*,
                re.name as requirement_name,
                oe.name as offering_name
            FROM entity_matches em
            JOIN entities re ON em.requirement_id = re.id
            JOIN entities oe ON em.offering_id = oe.id
            WHERE em.queue_status = ?
            ORDER BY em.created_at DESC
        `);
        const rows = stmt.all(queueStatus);
        return rows;
    }

    /**
     * Retrieves all matches with a specific status.
     * @method getMatchesByStatus
     * @param {string} status - The status to filter by.
     * @returns {Array<Object>} Array of match objects.
     * @why_not_base - Requires JOIN with entities table to fetch entity names.
     */
    getMatchesByStatus(status) {
        const stmt = db.prepare(`
            SELECT em.*,
                re.name as requirement_name,
                oe.name as offering_name
            FROM entity_matches em
            JOIN entities re ON em.requirement_id = re.id
            JOIN entities oe ON em.offering_id = oe.id
            WHERE em.status = ?
            ORDER BY em.created_at DESC
        `);
        const rows = stmt.all(status);
        return rows;
    }

    /**
     * Registers a document record for a match.
     * @method registerDocumentRecord
     * @param {number} matchId - The match ID.
     * @param {string} docType - The document type (e.g., 'Match Report', 'General Summary', 'Dimension Summary').
     * @param {string} fileName - The document filename.
     * @param {string} filePath - The full path to the document file.
     * @returns {number} The ID of the newly created document record.
     * @why_not_base - Custom INSERT for match_documents table to track match-generated files.
     * @socexplanation
     * - Brings Matches into parity with Entity document tracking.
     * - Enables DB-backed file retrieval instead of dynamic folder reading.
     */
    registerDocumentRecord(matchId, docType, fileName, filePath) {
        const stmt = db.prepare(`
            INSERT INTO match_documents (match_id, doc_type, file_name, file_path)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(matchId, docType, fileName, filePath);
        return info.lastInsertRowid;
    }

    /**
     * Retrieves all document records for a specific match.
     * @method getDocumentsForMatch
     * @param {number} matchId - The match ID.
     * @returns {Array<Object>} Array of document records with id, match_id, doc_type, file_name, file_path.
     * @why_not_base - Custom SELECT from match_documents table.
     * @socexplanation
     * - Enables DB-backed file retrieval instead of dynamic folder reading.
     * - Returns raw database records for mapping in the Service layer.
     */
    getDocumentsForMatch(matchId) {
        const stmt = db.prepare(`
            SELECT id, match_id, doc_type, file_name, file_path
            FROM match_documents
            WHERE match_id = ?
            ORDER BY id ASC
        `);
        const rows = stmt.all(matchId);
        return rows;
    }
}

module.exports = new MatchRepo();
