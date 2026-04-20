/**
 * @module CriteriaManagerWorkflow
 * @description Domain Service for managing entity criteria: extraction, storage, and matching.
 * 
 * @responsibility
 * - Extracts criteria from entity text using AI and stores them in the database.
 * - Extracts user criteria from the career archive and stores them for matching.
 * - Calculates criteria match scores between source and target entity criteria.
 * - Uses CriteriaRepo for persistence and AiService for AI-based extraction.
 * 
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (AiService, FileService) and Repositories (CriteriaRepo, EntityRepo).
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT handle document processing or entity assessment directly (use other workflows).
 */
const MatchingEngine = require('../utils/MatchingEngine');
const { cosineSimilarity } = require('../utils/VectorMath');
const { ENTITY_ROLES, LOG_LEVELS, LOG_SYMBOLS, SETTING_KEYS, ENTITY_STATUS, QUEUE_TASKS } = require('../config/constants');
const path = require('path');
class CriteriaManagerWorkflow {
/**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.settingsManager - The SettingsManager instance
     * @param {Object} deps.aiService - The AiService instance
     * @param {Object} deps.aiValidatorService - The AiValidatorService instance
     * @param {Object} deps.fileService - The FileService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.entityService - The EntityService instance
     * @param {Object} deps.criteriaService - The CriteriaService instance
     * @param {Object} deps.entityRepo - The EntityRepo instance
     * @param {Object} deps.criteriaRepo - The CriteriaRepo instance
     * @param {Object} deps.dimensionRepo - The DimensionRepo instance
     * @param {Object} deps.blueprintRepo - The BlueprintRepo instance
     * @param {Object} deps.dynamicSchemaBuilder - The DynamicSchemaBuilder instance
     * @param {Object} deps.promptBuilder - The PromptBuilder instance
     * @dependency_injection Dependencies are injected strictly via the constructor.
     * Defensive getters are not required as instantiation guarantees dependency presence.
     * Reasoning: Constructor Injection ensures all services are available immediately after construction.
     */
    constructor({ settingsManager, aiService, aiValidatorService, fileService, logService, entityService, criteriaService, entityRepo, criteriaRepo, dimensionRepo, blueprintRepo, dynamicSchemaBuilder, promptBuilder, queueService }) {
        this._settingsManager = settingsManager;
        this._aiService = aiService;
        this._aiValidatorService = aiValidatorService;
        this._fileService = fileService;
        this._logService = logService;
        this._entityService = entityService;
        this._criteriaService = criteriaService;
        this._entityRepo = entityRepo;
        this._criteriaRepo = criteriaRepo;
        this._dimensionRepo = dimensionRepo;
        this._blueprintRepo = blueprintRepo;
        this._dynamicSchemaBuilder = dynamicSchemaBuilder;
        this._promptBuilder = promptBuilder;
        this._queueService = queueService;
    }

/**
     * Normalizes a criterion name for consistent storage and lookup.
     * Converts to lowercase and removes non-alphanumeric characters.
     *
     * @method _normalizeCriterionName
     * @memberof CriteriaManagerWorkflow
     * @param {string} criterion - The criterion name to normalize.
     * @returns {string} The normalized criterion name.
     * @private
     */
    _normalizeCriterionName(criterion) {
        return criterion.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    }

    /**
     * Parses and standardizes the LLM JSON output into a predictable dimensions object.
     * Handles JSON parsing errors and provides fallback empty arrays for each dimension.
     * Dynamically iterates over active dimensions rather than hardcoding specific dimension names.
     *
     * @method _parseDimensionResponse
     * @memberof CriteriaManagerWorkflow
     * @param {string} responseString - The raw JSON string response from the LLM.
     * @param {Array<Object>} activeDimensions - The active dimensions array from the database.
     * @returns {Object} Object containing parsed dimensions keyed by dimension names.
     * @private
     *
     * @dry_explanation
     * - Centralizes JSON parsing and dimension extraction logic that was duplicated
     *   in extractAndStoreEntityCriteria.
     * - Ensures consistent handling of missing array fields across all extraction flows.
     * - Uses dynamic iteration over activeDimensions instead of hardcoding dimension keys.
     */
    _parseDimensionResponse(responseString, activeDimensions) {
        let parsed;
        try {
            parsed = JSON.parse(responseString);
        } catch (e) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `JSON Parse Error: ${e.message}` });
            throw new Error(`Failed to parse dimension JSON. AI returned: ${responseString.substring(0, 100)}...`, { cause: e });
        }

        const sanitizeArray = (arr) => {
            if (!Array.isArray(arr)) return [];
            return arr.map(item => {
                if (typeof item === 'string') return item.trim();
                if (typeof item === 'number') return String(item);
                if (typeof item === 'object' && item !== null) {
                    const values = Object.values(item).filter(v => typeof v === 'string');
                    return values.length > 0 ? values.join(' ') : JSON.stringify(item);
                }
                return String(item);
            }).filter(s => s.length > 0);
        };

        const dimensions = {};

        for (const dim of activeDimensions) {
            const dimName = dim.name;
            const possibleKeys = [
                dimName,
                dimName.replace(/_/g, ''),
                dim.displayName.replace(/ /g, '_'),
                dim.displayName.replace(/ /g, '')
            ];

            let extractedArray = [];
            for (const key of possibleKeys) {
                if (parsed[key] !== undefined) {
                    extractedArray = parsed[key];
                    break;
                }
            }

            dimensions[dimName] = sanitizeArray(extractedArray);
        }

        return { dimensions };
    }

    /**
     * Processes dimensions and generates embeddings for criteria.
     * Iterates through all dimensions and their criteria, checking for existing criteria
     * in the database and generating new embeddings when needed.
     *
     * @method _processDimensionsAndGenerateEmbeddings
     * @memberof CriteriaManagerWorkflow
     * @param {Object} dimensions - Object mapping dimension names to arrays of criterion names.
     *                              e.g., { core_competencies: ['Java', 'Python'], soft_skills: ['Communication'] }
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @param {Object} [options={}] - Options object.
     * @param {boolean} [options.deduplicate=false] - Whether to skip duplicate criteria by normalized name.
     * @param {boolean} [options.isRequired=true] - Whether to mark criteria as required. Set to null to omit the field.
     * @param {string|null} [options.folderPath=null] - Folder path for logging.
     * @returns {Promise<Array<Object>>} Array of criterion objects with normalizedName, displayName, dimension, embedding, and optionally isRequired.
     * @private
     *
 * @example
      * const dimensions = { core_competencies: ['Java', 'Python'], soft_skills: ['Communication'] };
      * const criteriaBatch = await this._processDimensionsAndGenerateEmbeddings(dimensions, signal, { deduplicate: true, isRequired: true, folderPath: '/path' });
     */
    async _processDimensionsAndGenerateEmbeddings(dimensions, signal, options = {}) {
        const { deduplicate = false, isRequired = true, folderPath = null } = options;
        const criteriaBatch = [];
        const seenNormalized = new Set();

        for (const [dimension, criteriaList] of Object.entries(dimensions)) {
            for (const criterionName of criteriaList) {
                const normalizedName = this._normalizeCriterionName(criterionName);

                if (deduplicate) {
                    if (seenNormalized.has(normalizedName)) {
                        continue;
                    }
                    seenNormalized.add(normalizedName);
                }

                const existingCriterion = this._criteriaRepo.getCriterionByName(normalizedName);

                const dimRecord = this._dimensionRepo.getActiveDimensions().find(d => d.name === dimension);
                const tag = dimRecord ? dimRecord.displayName : dimension.replace(/_/g, ' ');

                let embedding;
                if (existingCriterion) {
                    embedding = existingCriterion.embedding;
                } else {
                    /**
                     * SEMANTIC EMBEDDING GENERATION (Context-Anchored)
                     * @rationale We use a lightweight tagging format: "[Dimension Display Name] Keyword".
                     * This provides BGE-M3 with enough context to resolve polysemy.
                     * We look up the dimension's display name to ensure natural language
                     * tokenization, falling back to a string replacement if not found.
                     */
                    const contextualizedText = `[${tag}] ${criterionName}`;
                    embedding = await this._aiService.generateEmbedding(contextualizedText, { signal, logFolderPath: folderPath });
                }

                const criterionObj = {
                    normalizedName,
                    displayName: criterionName,
                    dimension,
                    dimensionDisplayName: tag,
                    embedding
                };

                if (isRequired !== null && isRequired !== undefined) {
                    criterionObj.isRequired = isRequired;
                }

                criteriaBatch.push(criterionObj);
            }
        }

        return criteriaBatch;
    }

    /**
     * Executes the auto-merge loop for criteria using vector similarity.
     * Compares newly extracted criteria against existing linked criteria to detect near-duplicates.
     *
     * @method _executeAutoMerge
     * @memberof CriteriaManagerWorkflow
     * @param {number} entityId - The entity ID.
     * @param {Array<Object>} criteriaBatch - The batch of newly extracted criteria.
     * @returns {void}
     * @private
     *
     * @socexplanation
     * - Extracted from extractAndStoreEntityCriteria to reduce function complexity (God Function anti-pattern).
     * - Uses deletedCriteriaIds Set to prevent duplicate merge attempts in the same batch.
     * - When the AI extracts identical criteria across different dimensions, the auto-merge loop
     *   could attempt to merge already-deleted records. The Set tracks merged criterion IDs to skip them.
     * - Since the set is in-memory and scoped to this method execution, it safely handles duplicate batch criteria
     *   without requiring additional database queries to check deleted status.
     *
     * @algorithm
     * 1. Loads all criteria with embeddings from database.
     * 2. For each new criterion, finds matching linked criteria using cosine similarity.
     * 3. If similarity >= threshold, optionally verifies with AI (if AI_VERIFY_MERGES enabled).
     * 4. Merges criteria and tracks deleted IDs to prevent duplicate merges.
     */
    async _executeAutoMerge(entityId, criteriaBatch) {
        const allDbCriteria = this._criteriaRepo._getAllCriteriaWithEmbeddings();
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
                            this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_LEVELS.INFO, origin: 'CriteriaManager', message: `Merge rejected by AI Gate: "${newTitle}" !== "${existingTitle}" (Vector Likeness: ${Math.round(score * 100)}%)` });
                            continue;
                        }

                        await this._criteriaService.mergeCriteria(linked.id, newCriterionFull.id);
                        deletedCriteriaIds.add(newCriterionFull.id);
                        this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'CriteriaManager', message: `Auto-merged ${newTitle} into ${existingTitle} (Likeness: ${Math.round(score * 100)}%)` });
                        break;
                    }
                } catch (e) {
                    this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `Similarity check failed: ${e.message}` });
                }
            }
        }
    }

    /**
     * Extracts and stores entity criteria from text using dynamic dimensions.
     * Uses a chunked concurrent approach for extracting each dimension separately.
     * 
     * This method performs the following operations:
     * 1. Fetches active dimensions from DimensionRepo.
     * 2. For each active dimension, makes a concurrent AI call to extract criteria for that dimension only.
     * 3. The chunked architecture provides three key benefits:
     *    - Accuracy: Each LLM call focuses on a single dimension, improving attention and extraction quality.
     *    - Speed: All dimension extractions run in parallel, reducing total wall-clock time.
     *    - Fault Tolerance: If one dimension fails (e.g., malformed JSON), others continue uninterrupted.
     * 4. Accumulates results from all concurrent calls into a combined dimensions object.
     * 5. For each criterion, checks if it already exists in the database.
     * 6. If new, generates an embedding vector and stores the criterion.
     * 7. Links all criteria to the entity.
     * 
     * @async
     * @method extractAndStoreEntityCriteria
     * @memberof CriteriaManagerWorkflow
     * @param {number} entityId - The entity ID to associate criteria with.
     * @param {string} text - The raw text to extract criteria from.
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<void>} Resolves when all criteria have been processed and stored.
     * 
     * @notes
     * - The normalized name is generated in the Domain Service layer (CriteriaManagerWorkflow)
     *   before passing to the Repository layer (CriteriaRepo). This maintains Separation
     *   of Concerns: the Repository handles data persistence, while the Service
     *   orchestrates business logic like normalization and entity creation.
     * - The display name is preserved separately from the normalized form to
     *   support user-facing UI while enabling consistent database lookups.
     * - Embedding generation happens in the Service layer since it requires AI,
     *   which is an external dependency not handled by the data layer.
     * - The chunked concurrent architecture extracts each dimension in parallel, providing
     *   improved accuracy (focused LLM attention), speed (parallel execution), and
     *   fault tolerance (isolated dimension failures).
     * 
     * @boundary_rules
     * - ✅ Uses AiService.generateChatResponse with DynamicSchemaBuilder for extraction.
     * - ✅ Uses CriteriaRepo for criterion CRUD operations and linking to entities.
     * - ✅ Uses DimensionRepo to fetch active dimensions.
     * - ✅ Uses SettingsManager to fetch dynamic auto_merge_threshold from database.
     * - ❌ Does NOT directly update entity records - uses CriteriaRepo methods.
     * 
     * @auto_merge_threshold
     * - The criteria auto-merge threshold is dynamically pulled from the database settings table.
     * - Stored as 'auto_merge_threshold' in the settings table (e.g., '95' for 95%).
     * - Converted to a float (0.95) for vector similarity comparison.
     * - Defaults to 95% if not configured.
     * 
     * @state_management
     * - Uses an in-memory Set (deletedCriteriaIds) to track criteria that have been merged in the current batch.
     * - This prevents "Ghost Reference" bugs where the AI extracts identical criteria across different dimensions,
     *   causing the auto-merge loop to attempt merging already-deleted records.
     * - Since the set is in-memory and scoped to this method execution, it safely handles duplicate batch criteria
     *   without requiring additional database queries to check deleted status.
     */
    async extractAndStoreEntityCriteria(entityId, text, signal) {
        if (!this._aiValidatorService.validateInputText(text, `Entity #${entityId} extraction`)) {
            return;
        }

        const entity = this._entityRepo.getEntityById(entityId);

        if (!entity) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `Entity #${entityId} not found for extraction` });
            return;
        }

        const entityRole = entity.entityType || ENTITY_ROLES.OFFERING;

        let activeDimensions = [];

        if (entity && entity.blueprintId) {
            activeDimensions = this._blueprintRepo.getBlueprintDimensions(entity.blueprintId);
        }

        if (activeDimensions.length === 0) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'No blueprint dimensions found, falling back to global active dimensions.' });
            activeDimensions = this._dimensionRepo.getActiveDimensions();
        }

        if (activeDimensions.length === 0) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'No active dimensions found in database.' });
            return;
        }

        // Accumulator for the chunked results
        const combinedDimensions = {};

        // Create an array of concurrent extraction tasks, one for each dimension
        const extractionTasks = activeDimensions.map((dim) => async () => {
            const singleDimArray = [dim];

            try {

                const messages = this._promptBuilder.buildDynamicExtractionMessages(text, singleDimArray, entityRole);
                const extractionSchema = this._dynamicSchemaBuilder.buildExtractionSchema(singleDimArray, entityRole);

                const { content } = await this._aiService.generateChatResponse(
                    messages,
                    { format: extractionSchema, logFolderPath: entity.folderPath, logAction: `Extracted dimension '${dim.displayName}' for Entity #${entityId}.`, signal }
                );

                const parsed = this._parseDimensionResponse(content, singleDimArray);

                // Merge the parsed dimension into our accumulator
                if (parsed.dimensions && parsed.dimensions[dim.name]) {
                    combinedDimensions[dim.name] = parsed.dimensions[dim.name];
                } else {
                    combinedDimensions[dim.name] = [];
                }
            } catch (err) {
                this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `Failed to extract dimension '${dim.name}' for Entity #${entityId}: ${err.message}` });
                this._logService.logErrorFile({ origin: 'CriteriaManagerWorkflow', message: `Failed to extract dimension '${dim.name}' for Entity #${entityId}`, errorObj: err });
                combinedDimensions[dim.name] = [];
            }
        });

        // Execute all chunked requests based on concurrency setting
        const allowConcurrent = this._settingsManager.get(SETTING_KEYS.ALLOW_CONCURRENT_AI) === 'true';
        if (allowConcurrent) {
            await Promise.all(extractionTasks.map(t => t()));
        } else {
            for (const task of extractionTasks) {
                await task();
            }
        }

        const dimensions = combinedDimensions;

        if (this._aiValidatorService.isEmptyExtraction(dimensions, activeDimensions)) {
            const inputPreview = text.trim().substring(0, 200);
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `AI returned completely empty dimensions for Entity #${entityId}. Input text preview: "${inputPreview}"` });
            this._logService.logErrorFile({ origin: 'CriteriaManagerWorkflow', message: `AI returned completely empty dimensions for Entity #${entityId}`, errorObj: null, details: { entityId, inputLength: text.length, inputPreview } });
            return;
        }

        const criteriaByDimension = {};
        for (const dim of activeDimensions) {
            const criteria = dimensions[dim.name] || [];
            criteriaByDimension[dim.name] = criteria;
        }

        try {
            this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `Extracted ${activeDimensions.length}-Dimension criteria from entity text.`,
                folderPath: entity.folderPath,
                verboseDetails: criteriaByDimension
            });
        } catch (err) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `Failed to log criteria extraction: ${err.message}` });
        }

        // Determine if entity is a requirement (has isRequired=true) or offering (has isRequired=null)
        // Requirements define required criteria, Offerings possess them
        const isRequired = entity && (entity.entityType === ENTITY_ROLES.REQUIREMENT || entity.type === ENTITY_ROLES.REQUIREMENT) ? true : false;

        const criteriaBatch = await this._processDimensionsAndGenerateEmbeddings(dimensions, signal, {
            deduplicate: false,
            isRequired,
            folderPath: entity.folderPath
        });

        const insertedCount = this._criteriaRepo.insertEntityCriteriaBatch(entityId, criteriaBatch);

        await this._executeAutoMerge(entityId, criteriaBatch);

        try {
            this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `Stored ${insertedCount} criteria across ${activeDimensions.length} dimensions with embeddings.`,
                folderPath: entity.folderPath
            });
        } catch (err) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `Failed to log criteria storage: ${err.message}` });
        }
    }

    /**
     * Calculates the criteria match score between requirement and offering entity criteria using semantic vector similarity.
     * Returns a rich data object containing the overall score AND dimensional breakdown.
     * 
     * This method uses cosine similarity to find semantically similar criteria between the requirement document
     * and the offering profile. Unlike exact ID matching (which only finds identical criteria), semantic
     * matching finds criteria that are conceptually similar even if they use different wording.
     * 
     * @method calculateCriteriaMatch
     * @memberof CriteriaManagerWorkflow
     * @param {number} requirementEntityId - The requirement entity ID.
     * @param {number} offeringEntityId - The offering entity ID.
     * @returns {Object} Object containing score, totals, and dimensional breakdown.
     * @throws {Error} If requirement or offering entity has no criteria.
     * 
     * @algorithm
     * 1. Fetch requirementCriteria and offeringCriteria. If either is empty, throw error.
     * 2. Group both sets by dimension property.
     * 3. Loop over requirementCriteria (outer loop). For each requirement criterion, scan the offeringCriteria (inner loop) using cosineSimilarity to find the best match (>= 0.70).
     * 4. If no match, flag it as missingRequired. Unmatched offeringCriteria go into the bonus array.
     * 5. Calculate global requiredTotals and requiredMet counts.
     * 
     * @return_structure
     * {
     *   score: number,
     *   requiredTotal: number,
     *   requiredMet: number,
     *   dimensions: {
     *     [dimKey]: {
     *       score: number|null,
     *       metrics: { requiredMet: number, requiredTotal: number },
     *       matched: [{ targetCriterion: string, sourceCriterion: string, similarity: number }],
     *       missingRequired: [string],
     *       bonus: [string]
     *     }
     *   }
     * }
     * 
     * @semantic_matching_rationale
     * - Exact matching is too strict for real-world criteria matching.
     * - Vector embeddings capture semantic meaning, enabling fuzzy matching.
     * - The 0.82 threshold balances false positives (too low) vs false negatives (too high).
     * 
     * @socexplanation
     * - This method handles complex domain business rules (semantic vector matching logic).
     * - The algorithm performs mathematical similarity calculations that belong in the domain layer,
     *   not in the Controller or Repository layers.
     * - Returns a rich data object with both global and dimensional sub-scores, fully computed
     *   in the Domain layer, ready for presentation in the frontend.
     * - Calculating dimensional sub-scores in the Domain layer ensures the frontend remains purely
     *   responsible for presentation, receiving fully computed metrics ready for display.
     */
    /**
     * Calculates the criteria match score between requirement and offering entity criteria using semantic vector similarity.
     * Returns a rich data object containing the overall score AND dimensional breakdown.
     * 
     * This method uses cosine similarity to find semantically similar criteria between the requirement document
     * and the offering profile. Unlike exact ID matching (which only finds identical criteria), semantic
     * matching finds criteria that are conceptually similar even if they use different wording.
     * 
     * @method calculateCriteriaMatch
     * @memberof CriteriaManagerWorkflow
     * @param {number} requirementEntityId - The requirement entity ID.
     * @param {number} offeringEntityId - The offering entity ID.
     * @returns {Object} Object containing score, totals, and dimensional breakdown.
     * @throws {Error} If requirement or offering entity has no criteria.
     * 
     * @algorithm
     * 1. Fetch requirementCriteria and offeringCriteria. If either is empty, throw error.
     * 2. Group both sets by dimension property.
     * 3. Loop over requirementCriteria (outer loop). For each requirement criterion, scan the offeringCriteria (inner loop) using cosineSimilarity to find the best match (>= 0.70).
     * 4. If no match, flag it as missingRequired. Unmatched offeringCriteria go into the bonus array.
     * 5. Calculate global requiredTotals and requiredMet counts.
     * 
     * @return_structure
     * {
     *   score: number,
     *   requiredTotal: number,
     *   requiredMet: number,
     *   dimensions: {
     *     [dimKey]: {
     *       score: number|null,
     *       metrics: { requiredMet: number, requiredTotal: number },
     *       matched: [{ targetCriterion: string, sourceCriterion: string, similarity: number }],
     *       missingRequired: [string],
     *       bonus: [string]
     *     }
     *   }
     * }
     * 
     * @semantic_matching_rationale
     * - Exact matching is too strict for real-world criteria matching.
     * - Vector embeddings capture semantic meaning, enabling fuzzy matching.
     * - The 0.82 threshold balances false positives (too low) vs false negatives (too high).
     * 
     * @socexplanation
     * - This method handles complex domain business rules (semantic vector matching logic).
     * - The algorithm performs mathematical similarity calculations that belong in the domain layer,
     *   not in the Controller or Repository layers.
     * - Returns a rich data object with both global and dimensional sub-scores, fully computed
     *   in the Domain layer, ready for presentation in the frontend.
     * - Calculating dimensional sub-scores in the Domain layer ensures the frontend remains purely
     *   responsible for presentation, receiving fully computed metrics ready for display.
     * 
* @new_structure
      * - Extracts the overall score from the rawComparison report (no recalculation).
      * - Dimension objects at root contain metrics with weights/scores.
      * - Root level contains flattened dimension arrays with perfectMatch/partialMatch/missedMatch.
     */
    calculateCriteriaMatch(requirementEntityId, offeringEntityId) {
        const requirementEntity = this._entityRepo.getEntityById(requirementEntityId);
        const offeringEntity = this._entityRepo.getEntityById(offeringEntityId);
        // Use the heavy retrieval method to ensure embeddings are present for the MatchingEngine's vector math
        const requirementCriteria = this._criteriaRepo.getCriteriaWithEmbeddingsForEntity(requirementEntityId);
        const offeringCriteria = this._criteriaRepo.getCriteriaWithEmbeddingsForEntity(offeringEntityId);

        if (!requirementEntity || !offeringEntity) {
            throw new Error('Entities not found for match calculation.');
        }

        const activeDimensions = this._dimensionRepo.getActiveDimensions();

        const minFloorSetting = parseFloat(this._settingsManager.get(SETTING_KEYS.MINIMUM_MATCH_FLOOR)) || 0.50;
        const perfectScoreSetting = parseFloat(this._settingsManager.get(SETTING_KEYS.PERFECT_MATCH_SCORE)) || 0.85;

        const matchSettings = {
            minimumFloor: minFloorSetting,
            perfectScore: perfectScoreSetting
        };

        const standardResult = MatchingEngine.calculate(requirementCriteria, offeringCriteria);

        const rawComparison = MatchingEngine.buildRawComparison({
            entities: {
                requirement: { id: requirementEntity.id, name: requirementEntity.niceName },
                offering: { id: offeringEntity.id, name: offeringEntity.niceName }
            },
            criteria: {
                requirementCriteria,
                offeringCriteria
            },
            activeDimensions,
            matchSettings
        });

        // Extract the pre-calculated overall score from the rawComparison report.
        // This satisfies the DRY principle by preventing redundant vector math recalculations,
        // and resolves structural mismatch issues with calculateWeightedMatchScore.
        const calculatedScore = rawComparison?.reportInfo?.metrics?.score || 0;
        const newOverallScore = Number(calculatedScore.toFixed(4));

        return {
            ...standardResult,
            score: newOverallScore,
            rawComparison
        };
    }

    /**
     * Atomized Method A: Extracts entity criteria from a specific file.
     * Extracts dimensions via AI from raw text and stores criteria WITHOUT embeddings.
     * Then enqueues VECTORIZE_ENTITY_CRITERIA.
     *
     * @async
     * @method extractEntityCriteria
     * @memberof CriteriaManagerWorkflow
     * @param {Object} payload - The task payload.
     * @param {number} payload.entityId - The entity ID to associate criteria with.
     * @param {string} payload.fileName - The name of the file to extract criteria from.
     * @param {boolean} [payload.isNewUpload] - Flag indicating if this is a new upload workflow.
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<number>} The entity ID.
     */
    async extractEntityCriteria(payload, signal) {
        const { entityId, fileName } = payload;

        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'Cannot extract criteria: entity not found or has no folder path' });
            return 0;
        }

        const filePath = path.join(entity.folderPath, fileName);

        try {
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_CRITERIA });
            this._entityService.updateMetadata(entityId, { processingStartedAt: new Date().toISOString() });

            const text = await this._fileService.extractTextFromFile(filePath);
            if (!text || text.trim().length === 0) {
                this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `No text content extracted from file: ${fileName}` });
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.COMPLETED });
                return 0;
            }

            await this._extractCriteriaWithoutEmbeddings(entityId, text, signal);

            this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `Extracted criteria from file: ${fileName}`,
                folderPath: entity.folderPath
            });

            return entityId;
        } catch (error) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `Failed to extract criteria: ${error.message}` });
            this._logService.logErrorFile({ origin: 'CriteriaManagerWorkflow', message: `Failed to extract criteria from file: ${fileName}`, errorObj: error });
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.FAILED, error: error.message });
            throw error;
        }
    }

    /**
     * Internal method: Extracts criteria from text WITHOUT generating embeddings.
     * Stores criteria in DB but leaves embedding field empty.
     *
     * @async
     * @method _extractCriteriaWithoutEmbeddings
     * @memberof CriteriaManagerWorkflow
     * @param {number} entityId - The entity ID.
     * @param {string} text - The raw text to extract criteria from.
     * @param {AbortSignal} [signal] - Optional signal.
     * @returns {Promise<void>}
     * @private
     */
    async _extractCriteriaWithoutEmbeddings(entityId, text, signal) {
        if (!this._aiValidatorService.validateInputText(text, `Entity #${entityId} extraction`)) {
            return;
        }

        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `Entity #${entityId} not found for extraction` });
            return;
        }

        const entityRole = entity.entityType || entity.type || ENTITY_ROLES.OFFERING;

        let activeDimensions = [];
        if (entity && entity.blueprintId) {
            activeDimensions = this._blueprintRepo.getBlueprintDimensions(entity.blueprintId);
        }
        if (activeDimensions.length === 0) {
            activeDimensions = this._dimensionRepo.getActiveDimensions();
        }
        if (activeDimensions.length === 0) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'No active dimensions found in database.' });
            return;
        }

        const combinedDimensions = {};
        const extractionTasks = activeDimensions.map((dim) => async () => {
            const singleDimArray = [dim];
            try {
                const messages = this._promptBuilder.buildDynamicExtractionMessages(text, singleDimArray, entityRole);
                const extractionSchema = this._dynamicSchemaBuilder.buildExtractionSchema(singleDimArray, entityRole);

                const { content } = await this._aiService.generateChatResponse(
                    messages,
                    { format: extractionSchema, logFolderPath: entity.folderPath, logAction: `Extracted dimension '${dim.displayName}' for Entity #${entityId}.`, signal }
                );

                const parsed = this._parseDimensionResponse(content, singleDimArray);
                if (parsed.dimensions && parsed.dimensions[dim.name]) {
                    combinedDimensions[dim.name] = parsed.dimensions[dim.name];
                } else {
                    combinedDimensions[dim.name] = [];
                }
            } catch (err) {
                this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `Failed to extract dimension '${dim.name}' for Entity #${entityId}: ${err.message}` });
                combinedDimensions[dim.name] = [];
            }
        });

        const allowConcurrent = this._settingsManager.get(SETTING_KEYS.ALLOW_CONCURRENT_AI) === 'true';
        if (allowConcurrent) {
            await Promise.all(extractionTasks.map(t => t()));
        } else {
            for (const task of extractionTasks) {
                await task();
            }
        }

        const dimensions = combinedDimensions;
        if (this._aiValidatorService.isEmptyExtraction(dimensions, activeDimensions)) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `AI returned completely empty dimensions for Entity #${entityId}.` });
            return;
        }

        const isRequired = entity && (entity.entityType === ENTITY_ROLES.REQUIREMENT || entity.type === ENTITY_ROLES.REQUIREMENT) ? true : false;

        const criteriaBatch = [];
        for (const [dimension, criteriaList] of Object.entries(dimensions)) {
            const dimRecord = activeDimensions.find(d => d.name === dimension);
            const dimensionDisplayName = dimRecord ? dimRecord.displayName : dimension.replace(/_/g, ' ');

            for (const criterionName of criteriaList) {
                const normalizedName = this._normalizeCriterionName(criterionName);
                const criterionObj = {
                    normalizedName,
                    displayName: criterionName,
                    dimension,
                    dimensionDisplayName
                };
                if (isRequired !== null && isRequired !== undefined) {
                    criterionObj.isRequired = isRequired;
                }
                criteriaBatch.push(criterionObj);
            }
        }

        this._criteriaRepo.insertEntityCriteriaBatch(entityId, criteriaBatch);
    }

    /**
     * Atomized Method B: Vectorizes entity criteria.
     * Fetches criteria without embeddings, generates embeddings, updates records.
     * Then enqueues MERGE_ENTITY_CRITERIA.
     *
     * @async
     * @method vectorizeEntityCriteria
     * @memberof CriteriaManagerWorkflow
     * @param {Object} payload - The task payload.
     * @param {number} payload.entityId - The entity ID.
     * @param {boolean} [payload.isNewUpload] - Flag indicating if this is a new upload workflow.
     * @param {AbortSignal} [signal] - Optional signal.
     * @returns {Promise<number>} The entity ID.
     */
    async vectorizeEntityCriteria(payload, signal) {
        const { entityId } = payload;

        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity) {
            throw new Error(`Entity #${entityId} not found.`);
        }

        try {
            const criteriaWithoutEmbeddings = this._criteriaRepo.getCriteriaWithoutEmbeddingsForEntity(entityId);

            if (!criteriaWithoutEmbeddings || criteriaWithoutEmbeddings.length === 0) {
                this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.INFO, origin: 'CriteriaManagerWorkflow', message: `No criteria to vectorize for Entity #${entityId}.` });
            } else {
                for (const criterion of criteriaWithoutEmbeddings) {
                    const dimRecord = this._dimensionRepo.getActiveDimensions().find(d => d.name === criterion.dimension);
                    const tag = dimRecord ? dimRecord.displayName : criterion.dimension.replace(/_/g, ' ');
                    const contextualizedText = `[${tag}] ${criterion.displayName}`;

                    const embedding = await this._aiService.generateEmbedding(contextualizedText, { signal, logFolderPath: entity.folderPath });

                    this._criteriaRepo.updateCriterionEmbedding(criterion.id, embedding);
                }
            }

            return entityId;
        } catch (error) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `Failed to vectorize criteria: ${error.message}` });
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.FAILED, error: error.message });
            throw error;
        }
    }

    /**
     * Atomized Method C: Merges entity criteria.
     * Runs semantic auto-merge loop using cosine similarity.
     * Then enqueues FINALIZE_ENTITY_WORKSPACE or sets COMPLETED.
     *
     * @async
     * @method mergeEntityCriteria
     * @memberof CriteriaManagerWorkflow
     * @param {Object} payload - The task payload.
     * @param {number} payload.entityId - The entity ID.
     * @param {boolean} [payload.isNewUpload] - Flag indicating if this is a new upload workflow.
     * @returns {Promise<number>} The entity ID.
     */
    async mergeEntityCriteria(payload) {
        const { entityId, isNewUpload } = payload;

        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity) {
            throw new Error(`Entity #${entityId} not found.`);
        }

        try {
            const allDbCriteria = this._criteriaRepo._getAllCriteriaWithEmbeddings();
            const threshold = parseFloat(this._settingsManager.get(SETTING_KEYS.AUTO_MERGE_THRESHOLD)) || 0.95;
            const deletedCriteriaIds = new Set();

            const linkedCriteria = this._criteriaRepo.getCriteriaForEntity(entityId);

            for (const criterion of linkedCriteria) {
                if (deletedCriteriaIds.has(criterion.id)) continue;

                const criterionFull = allDbCriteria.find(c => c.id === criterion.id);
                if (!criterionFull || !criterionFull.embedding) continue;

                for (const linked of linkedCriteria) {
                    if (linked.id === criterion.id) continue;
                    if (linked.normalizedName === criterion.normalizedName) continue;

                    const linkedFull = allDbCriteria.find(c => c.id === linked.id);
                    if (!linkedFull || !linkedFull.embedding) continue;

                    try {
                        const score = cosineSimilarity(criterionFull.embedding, linkedFull.embedding);
                        if (score >= threshold) {
                            const isAiVerificationEnabled = this._settingsManager.get(SETTING_KEYS.AI_VERIFY_MERGES) === 'true';
                            let isSynonym = true;

                            if (isAiVerificationEnabled) {
                                const result = await this._aiValidatorService.areCriteriaSynonyms({ criterionA: criterion.displayName, criterionB: linked.displayName });
                                isSynonym = result.isSynonym;
                            }

                            if (!isSynonym) {
                                continue;
                            }

                            await this._criteriaService.mergeCriteria(linked.id, criterion.id);
                            deletedCriteriaIds.add(criterion.id);
                            this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'CriteriaManager', message: `Auto-merged ${criterion.displayName} into ${linked.displayName} (Likeness: ${Math.round(score * 100)}%)` });
                            break;
                        }
                    } catch (e) {
                        this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `Similarity check failed: ${e.message}` });
                    }
                }
            }

            if (isNewUpload) {
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.MOVING_TO_VAULT });
            } else {
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.COMPLETED });
            }

            this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `Criteria merged for entity #${entityId}`,
                folderPath: entity.folderPath
            });

            return entityId;
        } catch (error) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `Failed to merge criteria: ${error.message}` });
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.FAILED, error: error.message });
            throw error;
        }
    }

    /**
     * Extracts entity criteria from a specific file in the entity folder.
     * This method allows manual extraction of criteria from a selected file,
     * bypassing the automatic file detection used in the document processor workflow.
     *
     * @async
     * @method extractEntityCriteriaFromFile
     * @memberof CriteriaManagerWorkflow
     * @param {Object} payload - The task payload.
     * @param {number} payload.entityId - The entity ID to associate criteria with.
     * @param {string} payload.fileName - The name of the file to extract criteria from.
     * @param {boolean} [payload.isNewUpload] - Flag indicating if this is a new upload workflow.
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<number>} The number of criteria extracted and stored.
     *
     * @workflow_steps
     * 1. Fetches the entity to get the folder path.
     * 2. Constructs the full file path.
     * 3. Extracts text from the file using FileService.
     * 4. Calls the existing extractAndStoreEntityCriteria method.
     * 5. If isNewUpload: enqueue FINALIZE_ENTITY_WORKSPACE.
     * 6. If manual trigger: set status to COMPLETED and step to null.
     * 7. Logs the successful extraction.
     *
     * @boundary_rules
     * - ✅ Uses FileService to read the file.
     * - ✅ Uses the existing extractAndStoreEntityCriteria method.
     * - ✅ Uses LogService for activity logging.
     * - ✅ Uses EntityService for queue status updates.
     * - ✅ Uses QueueService to enqueue FINALIZE_ENTITY_WORKSPACE when isNewUpload is true.
     *
     * @soc_explanation
     * - This workflow is responsible for its own queue status domain updates.
     * - Sets queue status to PROCESSING at start and clears to null upon completion,
     *   keeping the event listener layer completely agnostic of business logic (Separation of Concerns).
     */
    async extractEntityCriteriaFromFile(payload, signal) {
        const { entityId, fileName, isNewUpload } = payload;

        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'Cannot extract criteria: entity not found or has no folder path' });
            return 0;
        }

        const filePath = path.join(entity.folderPath, fileName);

        try {
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_CRITERIA });
            this._entityService.updateMetadata(entityId, { processingStartedAt: new Date().toISOString() });

            const text = await this._fileService.extractTextFromFile(filePath);
            if (!text || text.trim().length === 0) {
                this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `No text content extracted from file: ${fileName}` });
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.COMPLETED });
                return 0;
            }

            await this.extractAndStoreEntityCriteria(entityId, text, signal);

            if (isNewUpload) {
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.MOVING_TO_VAULT });
                this._queueService.enqueue(QUEUE_TASKS.FINALIZE_ENTITY_WORKSPACE, {
                    entityId,
                    folderPath: entity.folderPath
                });
            } else {
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.COMPLETED });
            }

            this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.INFO,
                message: `Extracted criteria from file: ${fileName}`,
                folderPath: entity.folderPath
            });

            return 1;
        } catch (error) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: `Failed to extract criteria from file: ${error.message}` });
            this._logService.logErrorFile({ origin: 'CriteriaManagerWorkflow', message: `Failed to extract criteria from file: ${fileName}`, errorObj: error });
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.FAILED, error: error.message });
            this._logService.addActivityLog({
                entityType: 'Entity',
                entityId,
                logType: LOG_LEVELS.ERROR,
                message: `Failed to extract criteria from file: ${fileName} - ${error.message}`,
                folderPath: entity.folderPath
            });
            throw error;
        }
    }
}

module.exports = CriteriaManagerWorkflow;
