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

const { APP_EVENTS, LOG_LEVELS, ENTITY_STATUS } = require('../config/constants');
const path = require('path');
const BaseEntityService = require('./BaseEntityService');

class MatchService extends BaseEntityService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.matchRepo - The MatchRepo instance
     * @param {Object} deps.entityRepo - The EntityRepo instance
     * @param {Object} deps.fileService - The FileService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.eventService - The EventService instance
     * @param {Object} deps.hashGenerator - The HashGenerator utility
     * @param {Object} deps.markdownGenerator - The MarkdownGenerator utility
     * @param {Object} deps.entityTypes - The ENTITY_TYPES constants
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ matchRepo, entityRepo, fileService, logService, eventService, hashGenerator, markdownGenerator, entityTypes }) {
        super({ repository: matchRepo, eventService, logService, fileService, resourceName: 'Match', getByIdMethod: 'getMatchById' });
        this._matchRepo = matchRepo;
        this._entityRepo = entityRepo;
        this._fileService = fileService;
        this._logService = logService;
        this._eventService = eventService;
        this._hashGenerator = hashGenerator;
        this._markdownGenerator = markdownGenerator;
        this._entityTypes = entityTypes;
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
        if (role === this._entityTypes.REQUIREMENT) {
            return this._matchRepo.getMatchesForRequirement(entityId);
        } else if (role === this._entityTypes.OFFERING) {
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
     * Updates the match score for an existing match and broadcasts the change.
     * @param {number} id - The match record ID.
     * @param {number} matchScore - The new match score.
     */
    updateMatchScore(id, matchScore) {
        this._matchRepo.updateMatchScore(id, matchScore);
        const updated = this.getById(id);
        if (updated) {
            this._eventService.emit(APP_EVENTS.RESOURCE_STATE_CHANGED, updated);
        }
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
        if (role === this._entityTypes.REQUIREMENT) {
            return this._matchRepo.deleteMatchesByEntityRole(entityId, 'requirement_id');
        } else if (role === this._entityTypes.OFFERING) {
            return this._matchRepo.deleteMatchesByEntityRole(entityId, 'offering_id');
        }
        this._matchRepo.deleteMatchesByEntityRole(entityId, 'requirement_id');
        this._matchRepo.deleteMatchesByEntityRole(entityId, 'offering_id');
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
     * 2. Extracts basename before storing to prevent pwd leakage.
     * 3. Creates the match record in database.
     * 4. Emits matchUpdate event.
     *
     * @socexplanation
     * - CTI: Uses unified prepareStagingDirectory for all entity types.
     * - File system logic (folder creation, path generation) belongs in the Service layer,
     *   not in the Controller. This keeps the Controller focused purely on HTTP transport.
     * - Queue orchestration has been delegated to the Controller to prevent circular dependencies and enforce strict domain boundaries.
     * - FIXED: Now extracts basename before storing to prevent pwd leakage.
     * - Delegates staging lifecycle to base class createStagedEntity to eliminate duplicated boilerplate.
     */
    async createMatchWithFolder({ requirementId, offeringId }) {
        const req = this._entityRepo.getEntityById(requirementId);
        const off = this._entityRepo.getEntityById(offeringId);

        const reqName = req?.nicename || 'Unknown Requirement';
        const offName = off?.nicename || 'Unknown Offering';
        const niceNameString = `Match - ${reqName} - ${offName}`;

        const reqLine1 = req?.niceNameLine1 || reqName;
        const offLine1 = off?.niceNameLine1 || offName;

        const baseDto = {
            entityType: this._entityTypes.MATCH,
            nicename: niceNameString,
            requirementId,
            offeringId,
            niceNameLine1: reqLine1,
            niceNameLine2: offLine1,
            matchScore: null,
            status: ENTITY_STATUS.PENDING
        };

        return this.createStagedEntity(baseDto, {
            execute: (dto) => this._matchRepo.createMatch(dto)
        });
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
     * 1. Delegates folder lifecycle to base class method.
     * 2. Deletes the match record from database.
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

        this.deleteEntityFolder(id);
        this._matchRepo.deleteMatch(id);
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

        this.updateState(matchId, { status: ENTITY_STATUS.PENDING, error: null });

        this.logActivity(matchId, {
                logType: LOG_LEVELS.INFO,
                message: 'Retrying match assessment.'
            });

        return match;
    }

    /**
     * Manually regenerates the match master markdown file by re-reading the match_report.json
     * and reconstructing the markdown content.
     *
     * @method writeMasterFile
     * @param {number} matchId - The match ID.
     * @returns {Object} The match object.
     *
     * @workflow_steps
     * 1. Fetch the match by ID.
     * 2. Read the existing match_report.json to extract ai_summary_executive and matched criteria.
     * 3. Fetch source and target entities to get their folder names for Wiki Links.
     * 4. Use MarkdownGenerator.generateMatchMaster to rebuild the markdown.
     * 5. Use base class generateAndSaveMasterDocument for common lifecycle.
     *
     * @socexplanation
     * - Encapsulates file system logic in Service layer to keep Controller thin.
     * - Delegates markdown generation to MarkdownGenerator utility.
     * - Uses base class generateAndSaveMasterDocument for common lifecycle.
     */
    async writeMasterFile(matchId) {
        const match = this.getMatchById(matchId);
        if (!match) {
            throw new Error('Match not found');
        }

        const matchFolderPath = this.getEntityFolderPath(matchId);
        if (!matchFolderPath) {
            throw new Error('Match folder path is not set');
        }

        const folderName = path.basename(matchFolderPath);
        const masterFileName = `${folderName}.md`;
        const allFiles = this._fileService.listFilesInFolder(matchFolderPath) || [];
        const associatedFiles = allFiles.filter(f => f !== masterFileName);

        const generateMatchContent = ({ folderName }) => {
            const reportPath = path.join(matchFolderPath, 'match_report.json');
            const reportData = this._fileService.readJsonFile(reportPath);

            const aiSummaryExecutive = reportData?.reportInfo?.ai_summary_executive || '';

            const sourceEntity = this._entityRepo.getEntityById(match.requirement_id);
            const targetEntity = this._entityRepo.getEntityById(match.offering_id);

            const reqFolderName = this.getCleanLinkName(sourceEntity);
            const offFolderName = this.getCleanLinkName(targetEntity);

            const dimensionalSummaries = [];
            if (reportData && reportData.dimensions) {
                for (const dim of Object.values(reportData.dimensions)) {
                    if (dim.ai_summary) {
                        dimensionalSummaries.push({
                            displayName: dim.displayName || 'Dimension',
                            summary: dim.ai_summary
                        });
                    }
                }
            }

            return this._markdownGenerator.generateMatchMaster({
                matchFolderName: folderName,
                reqFolderName,
                offFolderName,
                executiveSummary: aiSummaryExecutive,
                dimensionalSummaries,
                matchId,
                matchScore: match.matchScore ?? match.match_score,
                associatedFiles
            });
        };

        await this.generateAndSaveMasterDocument(matchId, generateMatchContent);

        return match;
    }

    /**
     * Generates a safe PDF filename for a match report.
     * @param {number} matchId - The match ID.
     * @returns {string} The formatted PDF filename.
     */
    getMatchPdfFileName(matchId) {
        const match = this.getMatchById(matchId);
        if (!match) return `Match_Report_${matchId}.pdf`;
        
        const NameGenerator = require('../utils/NameGenerator');
        const safeReqName = NameGenerator.sanitizeForFileSystem(match.requirement_name || "Requirement");
        const safeOffName = NameGenerator.sanitizeForFileSystem(match.offering_name || "Offering");
        
        return `Match - ${safeReqName} - ${safeOffName}.pdf`;
    }

    /**
     * Ensures a match has a folder, creating and saving the path if it doesn't exist.
     * @param {number} matchId - The match ID.
     * @returns {string} The absolute folder path.
     */
    ensureMatchFolder(matchId) {
        let folderPath = this.getEntityFolderPath(matchId);
        if (!folderPath) {
            const match = this.getMatchById(matchId);
            const folderName = match.nicename || `${match.requirement_id} vs ${match.offering_id}`;
            folderPath = this._fileService.prepareStagingDirectory(
                this._entityTypes.MATCH,
                folderName
            );
            this.updateFolderPath(matchId, folderPath);
        }
        return folderPath;
    }
}

module.exports = MatchService;