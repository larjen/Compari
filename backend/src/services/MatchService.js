/**
 * @module MatchService
 * @description Domain Service for match management - acts as the domain boundary between Controllers and Repositories.
 * 
 * @responsibility
 * - Wraps MatchRepo to provide a clean API for match data access.
 * - Translates repository data into domain models suitable for Controllers.
 * - Encapsulates all match-related data access behind this service layer.
 * - Handles file system operations for match folder creation and deletion.
 * 
 * @boundary_rules
 * - ✅ MAY call Repositories (MatchRepo).
 * - ✅ MAY call Infrastructure Services (FileService).
 * * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business logic or workflow orchestration.
 * - ❌ MUST NOT emit events directly (use EventService if needed).
 * 
 * @socexplanation
 * - The Match domain acts as the sole aggregate root where source and target entities interact, maintaining strict domain isolation.
 */

const matchRepo = require('../repositories/MatchRepo');
const entityRepo = require('../repositories/EntityRepo');
const criteriaRepo = require('../repositories/CriteriaRepo');
const dimensionRepo = require('../repositories/DimensionRepo');
const criteriaManagerWorkflow = require('../workflows/CriteriaManagerWorkflow');
const MatchingEngine = require('../utils/MatchingEngine');
const FileService = require('./FileService');
const logService = require('./LogService');
const SettingsManager = require('../config/SettingsManager');
const { TRASHED_DIR, QUEUE_TASKS } = require('../config/constants');
const path = require('path');
const eventService = require('./EventService');
const queueService = require('./QueueService');

class MatchService {
    /**
     * Retrieves matches with pagination, search, and status filtering.
     * @method getPaginatedMatches
     * @param {number} page - Current page number.
     * @param {number} limit - Items per page.
     * @param {string} search - Search term for entity names.
     * @param {string} status - Queue status filter.
     * @returns {Object} { matches, meta: { total, page, limit, totalPages } }
     */
    getPaginatedMatches(page, limit, search, status) {
        const offset = (page - 1) * limit;
        const { matches, total } = matchRepo.getPaginatedMatches(limit, offset, search, status);

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
        return matchRepo.getAllMatches();
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
        if (role === 'requirement') {
            return matchRepo.getMatchesForRequirement(entityId);
        } else if (role === 'offering') {
            return matchRepo.getMatchesForOffering(entityId);
        }
        return matchRepo.getMatchesForRequirement(entityId).concat(matchRepo.getMatchesForOffering(entityId));
    }

    /**
     * Retrieves a specific match by requirement and offering entity IDs.
     * @param {number} requirementEntityId - The requirement entity ID.
     * @param {number} offeringEntityId - The offering entity ID.
     * @returns {Object|null} Match instance or null if not found.
     */
    getMatchByEntities(requirementEntityId, offeringEntityId) {
        return matchRepo.getMatchByRequirementAndOffering(requirementEntityId, offeringEntityId);
    }

    /**
     * Creates a new match record between entities.
     * @param {number} sourceEntityId - The source entity ID (user).
     * @param {number} targetEntityId - The target entity ID (job listing).
     * @param {number|null} matchScore - The computed match score.
     * @param {string|null} reportPath - Path to the generated match report.
     * @param {string|null} folderPath - Path to the match folder.
     * @param {string} status - The match status (default: 'pending').
     * @returns {number} The ID of the newly created match record.
     */
    createMatch(sourceEntityId, targetEntityId, matchScore, reportPath, folderPath, status = 'pending') {
        return matchRepo.createMatch(sourceEntityId, targetEntityId, matchScore, reportPath, folderPath, status);
    }

    /**
     * Retrieves a specific match by ID.
     * @param {number} id - The match ID.
     * @returns {Object|null} The match record.
     */
    getMatchById(id) {
        return matchRepo.getMatchById(id);
    }

    /**
     * Updates the status for an existing match and emits SSE event to push state to UI.
     * @param {number} id - The match record ID.
     * @param {string} status - The new status.
     * 
     * @socexplanation
     * - This method serves as the authoritative state transition point for match status.
     * - The service layer is responsible for dispatching SSE events when state changes,
     *   keeping workflows agnostic of transport layers (HTTP/SSE).
     * - This ensures the frontend receives real-time status updates regardless of how
     *   the workflow was triggered (API call, queued task, etc.).
     * - Sanitizes the status string to lowercase and trims whitespace before
     *   passing to the repository to prevent CHECK constraint violations
     *   due to casing issues.
     */
    updateMatchStatus(id, status) {
        const sanitizedStatus = status.toLowerCase().trim();
        matchRepo.updateMatchStatus(id, sanitizedStatus);
        const updatedMatch = matchRepo.getMatchById(id);
        if (updatedMatch) {
            eventService.emit('matchUpdate', updatedMatch);
        }
    }

    /**
     * Updates the error for an existing match, logs it, and emits event to push state to UI.
     * @param {number} id - The match record ID.
     * @param {string|null} error - The error message.
     */
    updateMatchError(id, error) {
        matchRepo.updateMatchError(id, error);

        if (error) {
            const match = matchRepo.getMatchById(id);
            const folderPath = match ? match.folder_path : null;
            logService.addActivityLog('Match', id, 'ERROR', `Assessment failed: ${error}`, folderPath);
        }

        const updatedMatch = matchRepo.getMatchById(id);
        if (updatedMatch) {
            eventService.emit('matchUpdate', updatedMatch);
        }
    }

    /**
     * Updates the folder path for an existing match.
     * @param {number} id - The match record ID.
     * @param {string} folderPath - The folder path.
     * 
     * @socexplanation
     * - Delegates DB updates to the Repository to maintain strict data-access boundaries.
     * - Previously bypassed the Repository layer with raw SQL, which violated SoC.
     * - Now properly delegates to MatchRepo.updateFolderPath method.
     */
    updateFolderPath(id, folderPath) {
        return matchRepo.updateFolderPath(id, folderPath);
    }

    /**
     * Updates the match score for an existing match.
     * @param {number} id - The match record ID.
     * @param {number} matchScore - The new match score.
     */
    updateMatchScore(id, matchScore) {
        return matchRepo.updateMatchScore(id, matchScore);
    }

    /**
     * Updates the report path for an existing match.
     * @param {number} id - The match record ID.
     * @param {string} reportPath - The new report path.
     */
    updateReportPath(id, reportPath) {
        return matchRepo.updateReportPath(id, reportPath);
    }

    /**
     * Deletes a match record.
     * @param {number} id - The match record ID.
     */
    deleteMatch(id) {
        return matchRepo.deleteMatch(id);
    }

    /**
     * Deletes all matches for a specific entity.
     * @param {number} entityId - The entity ID.
     * @param {string} role - The role filter: 'requirement' or 'offering'.
     * @description Updated terminology: 'source' → 'requirement', 'target' → 'offering'
     */
    deleteMatchesForEntity(entityId, role) {
        if (role === 'requirement') {
            return matchRepo.deleteMatchesForRequirement(entityId);
        } else if (role === 'offering') {
            return matchRepo.deleteMatchesForOffering(entityId);
        }
        // If no role specified, delete matches where entity is either requirement or offering
        matchRepo.deleteMatchesForRequirement(entityId);
        matchRepo.deleteMatchesForOffering(entityId);
    }

    /**
     * Creates a new match with folder, queues assessment, and emits event.
     * This method encapsulates all file system logic for match creation.
     * 
     * @method createMatchWithFolder
     * @memberof MatchService
     * @param {number} sourceEntityId - The source entity ID.
     * @param {number} targetEntityId - The target entity ID.
     * @returns {number} The ID of the newly created match.
     * 
     * @workflow_steps
     * 1. Generates unique folder path in MATCH_REPORTS_DIR.
     * 2. Creates the match folder using FileService.
     * 3. Creates the match record in database.
     * 4. Queues the assessment task.
     * 5. Emits matchUpdate event.
     * 
     * @socexplanation
     * - File system logic (folder creation, path generation) belongs in the Service layer,
     *   not in the Controller. This keeps the Controller focused purely on HTTP transport.
     */
    createMatchWithFolder(sourceEntityId, targetEntityId) {
        const folderPath = FileService.generateMatchFolderPath(sourceEntityId, targetEntityId);
        FileService.createDirectory(folderPath);

        const matchId = matchRepo.createMatch(sourceEntityId, targetEntityId, null, null, folderPath, 'pending');

        queueService.enqueue(QUEUE_TASKS.ASSESS_ENTITY_MATCH, { sourceEntityId, targetEntityId, matchId });

        const newMatch = matchRepo.getMatchById(matchId);
        if (newMatch) {
            eventService.emit('matchUpdate', newMatch);
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
     * 2. Moves match folder to TRASHED_DIR using FileService.
     * 3. Deletes the match record from database.
     * 
     * @socexplanation
     * - File system logic (moving to trash) belongs in the Service layer,
     *   not in the Controller. This keeps the Controller focused purely on HTTP transport.
     * - Previously handled in MatchController which violated SoC by mixing HTTP handling
     *   with file system operations.
     */
    deleteMatchWithFolder(id) {
        const match = matchRepo.getMatchById(id);
        if (!match) {
            throw new Error('Match not found');
        }

        if (match.folder_path) {
            const trashPath = path.join(TRASHED_DIR, `Match_${id}_${Date.now()}`);
            try {
                FileService.moveDirectory(match.folder_path, trashPath);
            } catch (err) {
                logService.logTerminal('ERROR', 'ERROR', 'MatchService', `Failed to move match folder to trash: ${err.message}`);
            }
        }

        matchRepo.deleteMatch(id);
    }

    /**
     * Opens the match's folder in the native OS file manager.
     * @method openMatchFolder
     * @param {number|string} id - The match ID.
     * @returns {void}
     * 
     * @socexplanation
     * - Delegates native OS operations to FileService.
     * - Protects against missing folders or invalid match IDs.
     */
    openMatchFolder(id) {
        const match = matchRepo.getMatchById(id);
        if (!match || !match.folder_path) {
            logService.logTerminal('WARN', 'WARNING', 'MatchService', 'Cannot open folder: match not found or has no folder path');
            return;
        }
        FileService.openFolderInOS(match.folder_path);
    }

    /**
     * Registers a document record for a match.
     * @method registerDocumentRecord
     * @param {number} matchId - The match ID.
     * @param {string} docType - The document type.
     * @param {string} fileName - The document filename.
     * @param {string} filePath - The full path to the document file.
     * @returns {number} The ID of the newly created document record.
     * @socexplanation
     * - Delegates to MatchRepo.registerDocumentRecord.
     * - Exposes document registration at the Service layer.
     */
    registerDocumentRecord(matchId, docType, fileName, filePath) {
        return matchRepo.registerDocumentRecord(matchId, docType, fileName, filePath);
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
        return matchRepo.getDocumentsForMatch(matchId);
    }

    /**
     * Retries a failed match assessment by resetting error state, status, and re-queuing the task.
     * @method retryMatchAssessment
     * @param {number} matchId - The match ID to retry.
     * @returns {void}
     * 
     * @workflow_steps
     * 1. Fetches the match by ID. Throws if not found.
     * 2. Clears the error state (sets error string to null).
     * 3. Resets the queue status to 'pending'.
     * 4. Re-enqueues the assessment task with the original entity IDs and matchId.
     * 5. Adds an activity log entry indicating the retry.
     * 
     * @socexplanation
     * - Encapsulates queue re-entry logic for failed match assessments.
     * - Delegates data access and persistence to MatchRepo.
     * - Delegates queueing to QueueService.
     * - This method is the domain-level retry orchestration, keeping Controllers
     *   focused purely on HTTP transport and error forwarding.
     */
    retryMatchAssessment(matchId) {
        const match = this.getMatchById(matchId);
        if (!match) {
            throw new Error('Match not found');
        }

        this.updateMatchError(matchId, null);
        this.updateMatchStatus(matchId, 'pending');

        queueService.enqueue(QUEUE_TASKS.ASSESS_ENTITY_MATCH, {
            sourceEntityId: match.requirement_id,
            targetEntityId: match.offering_id,
            matchId
        });

        logService.addActivityLog('Match', matchId, 'INFO', 'Retrying match assessment.', match.folder_path);
    }

    /**
     * Evaluates a paginated chunk of potential matches for an entity using pure vector math.
     * @method evaluateMatchesChunk
     * @param {number} entityId - The base entity ID to find matches for.
     * @param {number} offset - The offset for pagination (0-indexed).
     * @param {number} limit - The number of entities to evaluate in this chunk.
     * @returns {Object} Object containing evaluatedChunk array and totalOpposites count.
     * 
     * @architectural_reasoning
     * - This method bypasses the heavy AI report generation (criteriaManagerWorkflow.calculateCriteriaMatch)
     *   which invokes AiReportGenerator. Instead, it directly calls MatchingEngine.calculateFastMatchScore()
     *   to obtain the pure mathematical vector similarity score without generating JSON reports.
     * - By working in chunks (offset/limit), it prevents blocking the Node.js event loop and enables
     *   progressive UI updates as chunks are processed.
     * - The frontend recursively fetches chunks until all entities are evaluated, maintaining a running
     *   top-20 list that updates dynamically.
     * - Uses dimension weights from the database to compute weighted match scores per dimension.
     * 
     * @dry_principles
     * - Delegates to MatchingEngine.calculateFastMatchScore() which reuses evaluateCriteriaPair internally.
     * - Reuses existing repository methods for criteria and entity retrieval.
     * - Fetches active dimensions once per chunk and reuses across all evaluations in that chunk.
     * 
     * @boundary_rules
     * - ✅ MAY call MatchingEngine for pure vector math.
     * - ✅ MAY call entityRepo, criteriaRepo, and dimensionRepo for data retrieval.
     * - ✅ MAY call SettingsManager for threshold configuration.
     * - ❌ MUST NOT call criteriaManagerWorkflow (which triggers AI report generation).
     * - ❌ MUST NOT call MatchingEngine.calculate() or buildRawComparison() (generates heavy JSON).
     */
    evaluateMatchesChunk(entityId, offset = 0, limit = 20) {
        const entity = entityRepo.getEntityById(entityId);
        if (!entity) throw new Error('Entity not found');

        const oppositeType = entity.type === 'requirement' ? 'offering' : 'requirement';

        const baseCriteria = criteriaRepo.getCriteriaWithEmbeddingsForEntity(entityId);
        if (!baseCriteria || baseCriteria.length === 0) {
            throw new Error('Base entity has no criteria with embeddings to match against.');
        }

        const activeDimensions = dimensionRepo.getActiveDimensions();
        
        const minimumFloor = parseFloat(SettingsManager.get('minimum_match_floor')) || 0.50;
        const perfectScore = parseFloat(SettingsManager.get('perfect_match_score')) || 0.85;

        const page = Math.floor(offset / limit) + 1;
        const { entities: opposites, meta } = entityRepo.getAllEntities({
            type: oppositeType,
            page: page,
            limit: limit
        });

        if (!opposites || opposites.length === 0) {
            return {
                evaluatedChunk: [],
                totalOpposites: meta.total
            };
        }

        const evaluatedChunk = [];

        for (const opp of opposites) {
            try {
                const reqId = entity.type === 'requirement' ? entity.id : opp.id;
                const offId = entity.type === 'offering' ? entity.id : opp.id;

                const oppositeCriteria = criteriaRepo.getCriteriaWithEmbeddingsForEntity(opp.id);
                if (!oppositeCriteria || oppositeCriteria.length === 0) {
                    continue;
                }

                const reqCriteria = entity.type === 'requirement' ? baseCriteria : oppositeCriteria;
                const offCriteria = entity.type === 'requirement' ? oppositeCriteria : baseCriteria;

                const fastScore = MatchingEngine.calculateFastMatchScore(
                    reqCriteria,
                    offCriteria,
                    activeDimensions,
                    minimumFloor,
                    perfectScore
                );

                const existingMatch = matchRepo.getMatchByRequirementAndOffering(reqId, offId);

                evaluatedChunk.push({
                    entity: opp,
                    score: fastScore,
                    existingMatchId: existingMatch ? existingMatch.id : null,
                    existingMatchStatus: existingMatch ? existingMatch.status : null
                });
            } catch(e) {
                continue;
            }
        }

        return {
            evaluatedChunk,
            totalOpposites: meta.total
        };
    }
}

module.exports = new MatchService();
