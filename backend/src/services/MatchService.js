/**
 * @module MatchService
 * @description Domain Service for match management - handles match data access and match folder I/O.
 *
 * @responsibility
 * - Wraps MatchRepo to provide a clean API for match data access.
 * - Translates repository data into domain models suitable for Controllers.
 * - Encapsulates all match-related data access behind this service layer.
 * - Handles file system operations for match folder creation and deletion.
 * - Manages document records associated with matches.
 *
 * @boundary_rules
 * - ✅ MAY call Repositories (MatchRepo).
 * - ✅ MAY call Infrastructure Services (FileService).
 * - ✅ MAY emit events via EventService.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business logic or workflow orchestration.
 * - ❌ MUST NOT handle PDF generation or match evaluation (delegated to MatchAnalyticsWorkflow).
 *
 * @socexplanation
 * - The Match domain acts as the sole aggregate root where source and target entities interact, maintaining strict domain isolation.
 * - PDF generation and fast vector evaluations have been extracted to MatchAnalyticsWorkflow to resolve God Class code smell.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const { TRASHED_DIR, ENTITY_ROLES, APP_EVENTS, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');
const path = require('path');
const BaseEntityService = require('./BaseEntityService');
const HashGenerator = require('../utils/HashGenerator');

class MatchService extends BaseEntityService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.matchRepo - The MatchRepo instance
     * @param {Object} deps.fileService - The FileService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.eventService - The EventService instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ matchRepo, entityRepo, fileService, logService, eventService }) {
        super({ repository: matchRepo, eventService, logService, resourceName: 'Match', getByIdMethod: 'getMatchById' });
        this._matchRepo = matchRepo;
        this._entityRepo = entityRepo;
        this._fileService = fileService;
        this._logService = logService;
        this._eventService = eventService;
    }

    /**
     * Retrieves matches with pagination, search, and status filtering.
     * @method getPaginatedMatches
     * @param {Object} matchQueryDto - The DTO containing query parameters
     * @param {number} matchQueryDto.page - Current page number
     * @param {number} matchQueryDto.limit - Items per page
     * @param {string} matchQueryDto.search - Search term for entity names
     * @param {string} matchQueryDto.status - Queue status filter
     * @returns {Object} { matches, meta: { total, page, limit, totalPages } }
     */
    getPaginatedMatches({ page, limit, search, status }) {
        const offset = (page - 1) * limit;
        const { matches, total } = this._matchRepo.getPaginatedMatches({ limit, offset, search, status });

        return {
            matches,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Retrieves all matches with entity details.
     * @returns {Array<Object>} Array of match objects with source and target entity details.
     */
    getAllMatches() {
        return this._matchRepo.getAllMatches();
    }

    /**
     * Retrieves matches for a specific entity based on role.
     * @method getMatchesForEntity
     * @param {number} entityId - The entity ID.
     * @param {string|null} role - The role filter: 'requirement' or 'offering', or null for all.
     * @returns {Array<Object>} Array of UserJobMatch instances.
     * @description Updated terminology: 'source' → 'requirement', 'target' → 'offering'
     */
    getMatchesForEntity(entityId, role) {
        if (role === ENTITY_ROLES.REQUIREMENT) {
            return this._matchRepo.getMatchesForRequirement(entityId);
        } else if (role === ENTITY_ROLES.OFFERING) {
            return this._matchRepo.getMatchesForOffering(entityId);
        }
        return this._matchRepo.getMatchesForRequirement(entityId).concat(this._matchRepo.getMatchesForOffering(entityId));
    }

    /**
     * Retrieves a specific match by requirement and offering entity IDs.
     * @param {number} requirementEntityId - The requirement entity ID.
     * @param {number} offeringEntityId - The offering entity ID.
     * @returns {Object|null} Match instance or null if not found.
     */
    getMatchByEntities(requirementEntityId, offeringEntityId) {
        return this._matchRepo.getMatchByRequirementAndOffering(requirementEntityId, offeringEntityId);
    }

    /**
     * Creates a new match record between entities.
     * @method createMatch
     * @param {Object} matchDto - The match DTO object.
     * @param {number} matchDto.requirementId - The requirement entity ID.
     * @param {number} matchDto.offeringId - The offering entity ID.
     * @param {number|null} [matchDto.matchScore] - The computed match score.
     * @param {string|null} [matchDto.reportPath] - Path to the generated match report.
     * @param {string|null} [matchDto.folderPath] - Path to the match folder.
     * @param {string} [matchDto.status='pending'] - The match status.
     * @returns {number} The ID of the newly created match record.
     */
    createMatch(matchDto) {
        return this._matchRepo.createMatch(matchDto);
    }

    /**
     * Retrieves a specific match by ID.
     * @param {number} id - The match ID.
     * @returns {Object|null} The match record.
     */
    getMatchById(id) {
        return this._matchRepo.getMatchById(id);
    }

    /**
     * Updates the match score for an existing match.
     * @param {number} id - The match record ID.
     * @param {number} matchScore - The new match score.
     */
    updateMatchScore(id, matchScore) {
        return this._matchRepo.updateMatchScore(id, matchScore);
    }

    /**
     * Updates the report path for an existing match.
     * @param {number} id - The match record ID.
     * @param {string} reportPath - The new report path.
     */
    updateReportPath(id, reportPath) {
        return this._matchRepo.updateReportPath(id, reportPath);
    }

    /**
     * Deletes a match record.
     * @param {number} id - The match record ID.
     */
    deleteMatch(id) {
        return this._matchRepo.deleteMatch(id);
    }

    /**
     * Deletes all matches for a specific entity.
     * @param {number} entityId - The entity ID.
     * @param {string} role - The role filter: 'requirement' or 'offering'.
     * @description Updated terminology: 'source' → 'requirement', 'target' → 'offering'
     */
    deleteMatchesForEntity(entityId, role) {
        if (role === ENTITY_ROLES.REQUIREMENT) {
            return this._matchRepo.deleteMatchesForRequirement(entityId);
        } else if (role === ENTITY_ROLES.OFFERING) {
            return this._matchRepo.deleteMatchesForOffering(entityId);
        }
        // If no role specified, delete matches where entity is either requirement or offering
        this._matchRepo.deleteMatchesForRequirement(entityId);
        this._matchRepo.deleteMatchesForOffering(entityId);
    }

    /**
     * Creates a new match with folder and emits event.
     * This method encapsulates all file system logic for match creation.
     *
     * @method createMatchWithFolder
     * @memberof MatchService
     * @param {number} sourceEntityId - The source entity ID.
     * @param {number} targetEntityId - The target entity ID.
     * @returns {number} The ID of the newly created match.
     *
     * @workflow_steps
     * 1. Creates a staging folder in UPLOADS_DIR using unified prepareStagingDirectory.
     * 2. Creates the match folder using this._fileService.
     * 3. Creates the match record in database.
     * 4. Emits matchUpdate event.
     *
     * @socexplanation
     * - CTI: Uses unified prepareStagingDirectory for all entity types.
     * - File system logic (folder creation, path generation) belongs in the Service layer,
     *   not in the Controller. This keeps the Controller focused purely on HTTP transport.
     * - Queue orchestration has been delegated to the Controller to prevent circular dependencies and enforce strict domain boundaries.
     */
    createMatchWithFolder({ requirementId, offeringId }) {
        const folderPath = this._fileService.prepareStagingDirectory(`match-${requirementId}-${offeringId}`);

        const req = this._entityRepo.getEntityById(requirementId);
        const off = this._entityRepo.getEntityById(offeringId);

        const reqName = req?.nicename || 'Unknown Requirement';
        const offName = off?.nicename || 'Unknown Offering';

        const reqLine1 = req?.niceNameLine1 || reqName;
        const offLine1 = off?.niceNameLine1 || offName;

        const hash = HashGenerator.generateUniqueHash();
        const matchDto = {
            requirementId,
            offeringId,
            nicename: `Match: ${reqName} - ${offName}`,
            niceNameLine1: reqLine1,
            niceNameLine2: offLine1,
            matchScore: null,
            reportPath: null,
            folderPath: folderPath,
            status: 'pending',
            hash
        };

        const matchId = this._matchRepo.createMatch(matchDto);

        const newMatch = this._matchRepo.getMatchById(matchId);
        if (newMatch) {
            this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, newMatch);
        }

        return matchId;
    }

    /**
     * Deletes a match by moving its folder to trash and removing the record.
     * This method encapsulates all file system logic for match deletion.
     * 
     * @method deleteMatchWithFolder
     * @memberof MatchService
     * @param {number} id - The match ID.
     * @returns {void}
     * 
     * @workflow_steps
     * 1. Retrieves the match to check for folder path.
     * 2. Moves match folder to TRASHED_DIR using this._fileService.
     * 3. Deletes the match record from database.
     * 
     * @socexplanation
     * - File system logic (moving to trash) belongs in the Service layer,
     *   not in the Controller. This keeps the Controller focused purely on HTTP transport.
     * - Previously handled in MatchController which violated SoC by mixing HTTP handling
     *   with file system operations.
     */
    deleteMatchWithFolder(id) {
        const match = this._matchRepo.getMatchById(id);
        if (!match) {
            throw new Error('Match not found');
        }

        if (match.folder_path) {
            const trashPath = path.join(TRASHED_DIR, `Match_${id}_${Date.now()}`);
            try {
                this._fileService.moveDirectory(match.folder_path, trashPath);
            } catch (err) {
                this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'MatchService', message: `Failed to move match folder to trash: ${err.message}` });
            }
        }

        this._matchRepo.deleteMatch(id);
    }

    /**
     * Opens the match's folder in the native OS file manager.
     * @method openMatchFolder
     * @param {number|string} id - The match ID.
     * @returns {void}
     * 
     * @socexplanation
     * - Delegates native OS operations to this._fileService.
     * - Protects against missing folders or invalid match IDs.
     */
    openMatchFolder(id) {
        const match = this._matchRepo.getMatchById(id);
        if (!match || !match.folder_path) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'MatchService', message: 'Cannot open folder: match not found or has no folder path' });
            return;
        }
        this._fileService.openFolderInOS(match.folder_path);
    }

    /**
     * Registers a document record for a match.
     * @method registerDocumentRecord
     * @param {Object} documentDto - The DTO containing document data
     * @param {number} documentDto.matchId - The match ID
     * @param {string} documentDto.docType - The document type
     * @param {string} documentDto.fileName - The document filename
     * @returns {number} The ID of the newly created document record.
     * @socexplanation
     * - Delegates to MatchRepo.registerDocumentRecord.
     * - Exposes document registration at the Service layer.
     */
    registerDocumentRecord({ matchId, docType, fileName }) {
        return this._matchRepo.registerDocumentRecord({ entityId: matchId, docType, fileName });
    }

    /**
     * Retrieves all document records for a specific match.
     * @method getDocumentsForMatch
     * @param {number} matchId - The match ID.
     * @returns {Array<Object>} Array of document records.
     * @socexplanation
     * - Delegates to MatchRepo.getDocumentsForMatch.
     * - Exposes document retrieval at the Service layer.
     */
    getDocumentsForMatch(matchId) {
        return this._matchRepo.getDocuments(matchId);
    }

    /**
     * Retries a failed match assessment by resetting error state, status.
     * @method retryMatchAssessment
     * @param {number} matchId - The match ID to retry.
     * @returns {Object} The match object.
     * 
     * @workflow_steps
     * 1. Fetches the match by ID. Throws if not found.
     * 2. Clears the error state (sets error string to null).
     * 3. Resets the queue status to 'pending'.
     * 4. Adds an activity log entry indicating the retry.
     *
     * @socexplanation
     * - Encapsulates state reset logic for failed match assessments.
     * - Delegates data access and persistence to MatchRepo.
     * - Queue orchestration has been delegated to the Controller to prevent circular dependencies and enforce strict domain boundaries.
     */
    retryMatchAssessment(matchId) {
        const match = this.getMatchById(matchId);
        if (!match) {
            throw new Error('Match not found');
        }

        this.updateState(matchId, { status: 'pending', error: null });

        this._logService.addActivityLog({
                entityType: 'Match',
                entityId: matchId,
                logType: LOG_LEVELS.INFO,
                message: 'Retrying match assessment.',
                folderPath: match.folder_path
            });

        return match;
    }
}

module.exports = MatchService;