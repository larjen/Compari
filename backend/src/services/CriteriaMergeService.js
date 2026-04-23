/**
 * @module CriteriaMergeService
 * @description Domain Service for semantic merging of criteria using vector similarity and AI validation.
 *
 * @responsibility
 * - Executes the auto-merge loop for criteria using vector cosine similarity.
 * - Compares newly extracted criteria against existing linked criteria to detect near-duplicates.
 * - Optionally verifies merge candidates with AI (when AI_VERIFY_MERGES is enabled).
 * - Handles criteria merge operations and tracks deleted criterion IDs to prevent duplicate merges.
 * - Moves deleted criterion folders to TRASHED_DIR during merges.
 *
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (AiValidatorService, FileService) and Repositories (CriteriaRepo).
 * - ✅ MAY call SettingsManager to fetch merge threshold and AI verification settings.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT handle entity state management (use CriteriaManagerWorkflow for that).
 * - ❌ MUST NOT call EntityRepo or EntityService directly.
 *
 * @socexplanation
 * This service separates vector math (cosine similarity calculations) and AI validation
 * (areCriteriaSynonyms) from the general workflow orchestration in CriteriaManagerWorkflow.
 * By extracting this logic into a dedicated service, we achieve:
 * - SRP: This service has one reason to change: the merge algorithm itself.
 * - Testability: Vector math and AI validation can be tested independently.
 * - Reusability: The merge logic can be invoked from different workflows if needed.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */
const { cosineSimilarity } = require('../utils/VectorMath');
const { LOG_LEVELS, LOG_SYMBOLS, SETTING_KEYS } = require('../config/constants');

class CriteriaMergeService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.settingsManager - The SettingsManager instance
     * @param {Object} deps.criteriaService - The CriteriaService instance
     * @param {Object} deps.aiValidatorService - The AiValidatorService instance
     * @param {Object} deps.criteriaRepo - The CriteriaRepo instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.fileService - The FileService instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ settingsManager, criteriaService, aiValidatorService, criteriaRepo, logService, fileService }) {
        this._settingsManager = settingsManager;
        this._criteriaService = criteriaService;
        this._aiValidatorService = aiValidatorService;
        this._criteriaRepo = criteriaRepo;
        this._logService = logService;
        this._fileService = fileService;
    }

    /**
     * Executes the auto-merge loop for criteria using vector similarity.
     * Compares newly extracted criteria against existing linked criteria to detect near-duplicates.
     *
     * @method executeAutoMerge
     * @memberof CriteriaMergeService
     * @param {number} entityId - The entity ID.
     * @param {Array<Object>} criteriaBatch - The batch of newly extracted criteria.
     * @returns {Promise<void>} Resolves when all merge attempts are complete.
     *
     * @description
     * This method performs semantic merging of criteria using cosine similarity on vector embeddings.
     * It uses a threshold from settings to determine when criteria are similar enough to merge.
     * Optionally uses AI to verify whether similar criteria are true synonyms before merging.
     *
     * @algorithm
     * 1. Loads all criteria with embeddings from database.
     * 2. For each new criterion, finds matching linked criteria using cosine similarity.
     * 3. If similarity >= threshold, optionally verifies with AI (if AI_VERIFY_MERGES enabled).
     * 4. Merges criteria and tracks deleted IDs to prevent duplicate merges.
     *
     * @socexplanation
     * This method contains the core vector math (cosine similarity) and AI validation logic
     * that was previously in CriteriaManagerWorkflow._executeAutoMerge. Extracting this into
     * a dedicated service ensures separation of concerns - vector math and AI validation
     * are isolated from workflow orchestration.
     */
    async executeAutoMerge(entityId, criteriaBatch) {
        const allDbCriteria = this._criteriaRepo.getAllCriteriaWithEmbeddings();
        const threshold = parseFloat(this._settingsManager.get(SETTING_KEYS.AUTO_MERGE_THRESHOLD)) || 0.95;
        const deletedCriteriaIds = new Set();

        for (const newCriterion of criteriaBatch) {
            const newCriterionFull = allDbCriteria.find(c => c.normalizedName === newCriterion.normalizedName);
            if (!newCriterionFull) continue;

            if (deletedCriteriaIds.has(newCriterionFull.id)) continue;

            const linkedCriteria = this._criteriaRepo.getCriteriaForEntity(entityId);
            for (const linked of linkedCriteria) {
                if (linked.id === newCriterionFull.id) continue;
                if (linked.normalizedName === newCriterion.normalizedName) continue;

                const linkedFull = allDbCriteria.find(c => c.id === linked.id);
                if (!linkedFull || !linkedFull.embedding) continue;

                try {
                    const score = cosineSimilarity(newCriterionFull.embedding, linkedFull.embedding);
                    if (score >= threshold) {
                        const existingTitle = linked.displayName;
                        const newTitle = newCriterionFull.displayName;

                        const isAiVerificationEnabled = this._settingsManager.get(SETTING_KEYS.AI_VERIFY_MERGES) === 'true';
                        let isSynonym = true;

                        if (isAiVerificationEnabled) {
                            const result = await this._aiValidatorService.areCriteriaSynonyms({ criterionA: newTitle, criterionB: existingTitle });
                            isSynonym = result.isSynonym;
                        }

                        if (!isSynonym) {
                            this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_LEVELS.INFO, origin: 'CriteriaMergeService', message: `Merge rejected by AI Gate: "${newTitle}" !== "${existingTitle}" (Vector Likeness: ${Math.round(score * 100)}%)` });
                            continue;
                        }

                        await this._criteriaService.mergeCriteria(newCriterionFull.id, linked.id);
                        deletedCriteriaIds.add(linked.id);

                        this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'CriteriaMergeService', message: `Manual entry "${newTitle}" preserved; merged existing duplicate "${existingTitle}". (Likeness: ${Math.round(score * 100)}%)` });
                        break;
                    }
                } catch (e) {
                    /** * @socexplanation 
                     * Stack trace preservation enforced. errorObj passed explicitly. 
                     */
                    this._logService.logTerminal({ 
                        status: LOG_LEVELS.WARN, 
                        symbolKey: LOG_SYMBOLS.WARNING, 
                        origin: 'CriteriaMergeService', 
                        message: 'Similarity check failed', 
                        errorObj: e 
                    });
                }
            }
        }
    }
}

module.exports = CriteriaMergeService;