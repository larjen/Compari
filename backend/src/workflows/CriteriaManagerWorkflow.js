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
const AiService = require('../services/AiService');
const FileService = require('../services/FileService');
const logService = require('../services/LogService');
const entityService = require('../services/EntityService');
const criteriaService = require('../services/CriteriaService');
const entityRepo = require('../repositories/EntityRepo');
const criteriaRepo = require('../repositories/CriteriaRepo');
const dimensionRepo = require('../repositories/DimensionRepo');
const blueprintRepo = require('../repositories/BlueprintRepo');
const SettingsManager = require('../config/SettingsManager');
const PromptBuilder = require('../utils/PromptBuilder');
const DynamicSchemaBuilder = require('../utils/DynamicSchemaBuilder');
const MatchingEngine = require('../utils/MatchingEngine');
const AiValidator = require('../utils/AiValidator');
const { cosineSimilarity } = require('../utils/VectorMath');
const { ENTITY_ROLES, LOG_LEVELS, LOG_SYMBOLS, SETTING_KEYS } = require('../config/constants');
const path = require('path');

class CriteriaManagerWorkflow {

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
        let jsonStr = responseString;
        const jsonMatch = responseString.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'CriteriaManagerWorkflow', `JSON Parse Error: ${e.message}`);
            throw new Error(`Failed to parse dimension JSON. AI returned: ${responseString.substring(0, 100)}...`);
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
     * @param {boolean} [deduplicate=false] - Whether to skip duplicate criteria by normalized name.
     * @param {boolean} [isRequired=true] - Whether to mark criteria as required. Set to null to omit the field.
     * @returns {Promise<Array<Object>>} Array of criterion objects with normalizedName, displayName, dimension, embedding, and optionally isRequired.
     * @private
     * 
     * @example
     * const dimensions = { core_competencies: ['Java', 'Python'], soft_skills: ['Communication'] };
     * const criteriaBatch = await this._processDimensionsAndGenerateEmbeddings(dimensions, signal, true, true);
     */
    async _processDimensionsAndGenerateEmbeddings(dimensions, signal, deduplicate = false, isRequired = true, folderPath = null) {
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

                const existingCriterion = criteriaRepo.getCriterionByName(normalizedName);

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
                    const dimRecord = dimensionRepo.getActiveDimensions().find(d => d.name === dimension);
                    const tag = dimRecord ? dimRecord.displayName : dimension.replace(/_/g, ' ');
                    const contextualizedText = `[${tag}] ${criterionName}`;
                    embedding = await AiService.generateEmbedding(contextualizedText, undefined, undefined, signal, { logFolderPath: folderPath });
                }

                // Ensure this remains unchanged so the UI stays clean:
                const criterionObj = {
                    normalizedName,
                    displayName: criterionName,
                    dimension,
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
        if (!AiValidator.validateInputText(text, `Entity #${entityId} extraction`)) {
            return;
        }

        const entity = entityRepo.getEntityById(entityId);

        if (!entity) {
            logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'CriteriaManagerWorkflow', `Entity #${entityId} not found for extraction`);
            return;
        }

        const entityRole = entity.type || ENTITY_ROLES.OFFERING;

        let activeDimensions = [];

        if (entity && entity.blueprintId) {
            activeDimensions = blueprintRepo.getBlueprintDimensions(entity.blueprintId);
        }

        if (activeDimensions.length === 0) {
            logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'CriteriaManagerWorkflow', 'No blueprint dimensions found, falling back to global active dimensions.');
            activeDimensions = dimensionRepo.getActiveDimensions();
        }

        if (activeDimensions.length === 0) {
            logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'CriteriaManagerWorkflow', 'No active dimensions found in database.');
            return;
        }

        // Accumulator for the chunked results
        const combinedDimensions = {};

        // Create an array of concurrent extraction tasks, one for each dimension
        const extractionTasks = activeDimensions.map((dim) => async () => {
            const singleDimArray = [dim];

            try {

                entityService.updateProcessingStep(entityId, `Extracting Criteria from ${dim.displayName}`);

                const messages = PromptBuilder.buildDynamicExtractionMessages(text, singleDimArray, entityRole);
                const extractionSchema = DynamicSchemaBuilder.buildExtractionSchema(singleDimArray, entityRole);

                const { content } = await AiService.generateChatResponse(
                    messages,
                    { format: extractionSchema, logFolderPath: entity.folderPath, logAction: `Extracted dimension '${dim.displayName}' for Entity #${entityId}.` },
                    undefined, undefined, signal
                );

                const parsed = this._parseDimensionResponse(content, singleDimArray);

                // Merge the parsed dimension into our accumulator
                if (parsed.dimensions && parsed.dimensions[dim.name]) {
                    combinedDimensions[dim.name] = parsed.dimensions[dim.name];
                } else {
                    combinedDimensions[dim.name] = [];
                }
            } catch (err) {
                logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'CriteriaManagerWorkflow', `Failed to extract dimension '${dim.name}' for Entity #${entityId}: ${err.message}`);
                logService.logErrorFile('CriteriaManagerWorkflow', `Failed to extract dimension '${dim.name}' for Entity #${entityId}`, err);
                combinedDimensions[dim.name] = [];
            }
        });

        // Execute all chunked requests based on concurrency setting
        const allowConcurrent = SettingsManager.get(SETTING_KEYS.ALLOW_CONCURRENT_AI) === 'true';
        if (allowConcurrent) {
            await Promise.all(extractionTasks.map(t => t()));
        } else {
            for (const task of extractionTasks) {
                await task();
            }
        }

        const dimensions = combinedDimensions;

        if (AiValidator.isEmptyExtraction(dimensions, activeDimensions)) {
            const inputPreview = text.trim().substring(0, 200);
            logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'CriteriaManagerWorkflow', `AI returned completely empty dimensions for Entity #${entityId}. Input text preview: "${inputPreview}"`);
            logService.logErrorFile('CriteriaManagerWorkflow', `AI returned completely empty dimensions for Entity #${entityId}`, null, { entityId, inputLength: text.length, inputPreview });
            return;
        }

        const criteriaByDimension = {};
        for (const dim of activeDimensions) {
            const criteria = dimensions[dim.name] || [];
            criteriaByDimension[dim.name] = criteria;
        }

        try {
            logService.addActivityLog(
                'Entity',
                entityId,
                LOG_LEVELS.INFO,
                `Extracted ${activeDimensions.length}-Dimension criteria from entity text.`,
                entity.folderPath,
                criteriaByDimension
            );
        } catch (err) {
            logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'CriteriaManagerWorkflow', `Failed to log criteria extraction: ${err.message}`);
        }

        // Determine if entity is a requirement (has isRequired=true) or offering (has isRequired=null)
        // Requirements define required criteria, Offerings possess them
        const isRequired = entity && entity.type === ENTITY_ROLES.REQUIREMENT ? true : false;

        entityService.updateProcessingStep(entityId, 'Vectorizing Criteria');

        const criteriaBatch = await this._processDimensionsAndGenerateEmbeddings(dimensions, signal, false, isRequired, entity.folderPath);

        const insertedCount = criteriaRepo.insertEntityCriteriaBatch(entityId, criteriaBatch);

        // We use the private method here to ensure vector embeddings are loaded into memory
        // for the similarity check, adhering to separation of concerns where lightweight
        // methods exclude heavy vector data.
        const allDbCriteria = criteriaRepo._getAllCriteriaWithEmbeddings();

        const threshold = parseFloat(SettingsManager.get(SETTING_KEYS.AUTO_MERGE_THRESHOLD)) || 0.95;

        // State Tracking: Prevents duplicate merge attempts caused by the AI extracting identical criteria across different dimensions.
        const deletedCriteriaIds = new Set();

        /**
         * Auto-merge loop: Compares newly extracted criteria against existing linked criteria
         * using vector similarity to detect near-duplicates.
         * 
         * We load full criteria from allDbCriteria (which includes embeddings) to avoid
         * passing undefined arrays to the cosineSimilarity utility. The linkedCriteria
         * from getCriteriaForEntity() excludes embeddings for performance, so we perform
         * a lookup in the allDbCriteria array before computing similarity scores.
         */
        for (const newCriterion of criteriaBatch) {
            const newCriterionFull = allDbCriteria.find(c => c.normalizedName === newCriterion.normalizedName);
            if (!newCriterionFull) continue;

            // State Management: Skip if this criterion was already merged/deleted in this batch
            if (deletedCriteriaIds.has(newCriterionFull.id)) continue;

            const linkedCriteria = criteriaRepo.getCriteriaForEntity(entityId);
            for (const linked of linkedCriteria) {
                if (linked.id === newCriterionFull.id) continue;
                if (linked.normalizedName === newCriterion.normalizedName) continue;

                // Retrieve the full criterion object containing the vector embedding
                const linkedFull = allDbCriteria.find(c => c.id === linked.id);
                if (!linkedFull || !linkedFull.embedding) continue;

                try {
                    const score = cosineSimilarity(newCriterionFull.embedding, linkedFull.embedding);
                    if (score >= threshold) {
                        const existingTitle = linked.displayName;
                        const newTitle = newCriterionFull.displayName;

                        // --- LLM VERIFICATION GATE ---
                        // Check if AI verification is enabled - if not, trust the vector match
                        const isAiVerificationEnabled = SettingsManager.get(SETTING_KEYS.AI_VERIFY_MERGES) === 'true';

                        let isSynonym = true;

                        if (isAiVerificationEnabled) {
                            const result = await AiValidator.areCriteriaSynonyms(newTitle, existingTitle);
                            isSynonym = result.isSynonym;
                        }

                        if (!isSynonym) {
                            logService.logTerminal(LOG_LEVELS.INFO, LOG_LEVELS.INFO, 'CriteriaManager', `Merge rejected by AI Gate: "${newTitle}" !== "${existingTitle}" (Vector Likeness: ${Math.round(score * 100)}%)`);
                            continue;
                        }

                        await criteriaService.mergeCriteria(linked.id, newCriterionFull.id);
                        // State Management: Track merged criterion to prevent duplicate merge attempts in same batch
                        deletedCriteriaIds.add(newCriterionFull.id);
                        logService.logTerminal(LOG_LEVELS.INFO, LOG_SYMBOLS.CHECKMARK, 'CriteriaManager', `Auto-merged ${newTitle} into ${existingTitle} (Likeness: ${Math.round(score * 100)}%)`);
                        break;
                    }
                } catch (e) {
                    logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'CriteriaManagerWorkflow', `Similarity check failed: ${e.message}`);
                }
            }
        }

        try {
            logService.addActivityLog('Entity', entityId, LOG_LEVELS.INFO, `Stored ${insertedCount} criteria across ${activeDimensions.length} dimensions with embeddings.`, entity.folderPath);
        } catch (err) {
            logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'CriteriaManagerWorkflow', `Failed to log criteria storage: ${err.message}`);
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
        const requirementEntity = entityRepo.getEntityById(requirementEntityId);
        const offeringEntity = entityRepo.getEntityById(offeringEntityId);
        // Use the heavy retrieval method to ensure embeddings are present for the MatchingEngine's vector math
        const requirementCriteria = criteriaRepo.getCriteriaWithEmbeddingsForEntity(requirementEntityId);
        const offeringCriteria = criteriaRepo.getCriteriaWithEmbeddingsForEntity(offeringEntityId);

        if (!requirementEntity || !offeringEntity) {
            throw new Error('Entities not found for match calculation.');
        }

        const activeDimensions = dimensionRepo.getActiveDimensions();

        const minFloorSetting = parseFloat(SettingsManager.get(SETTING_KEYS.MINIMUM_MATCH_FLOOR)) || 0.50;
        const perfectScoreSetting = parseFloat(SettingsManager.get(SETTING_KEYS.PERFECT_MATCH_SCORE)) || 0.85;

        const matchSettings = {
            minimumFloor: minFloorSetting,
            perfectScore: perfectScoreSetting
        };

        const standardResult = MatchingEngine.calculate(requirementCriteria, offeringCriteria);

        const rawComparison = MatchingEngine.buildRawComparison(
            { id: requirementEntity.id, name: requirementEntity.niceName },
            { id: offeringEntity.id, name: offeringEntity.niceName },
            activeDimensions,
            matchSettings,
            requirementCriteria,
            offeringCriteria
        );

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
     * Extracts entity criteria from a specific file in the entity folder.
     * This method allows manual extraction of criteria from a selected file,
     * bypassing the automatic file detection used in the document processor workflow.
     * 
     * @async
     * @method extractEntityCriteriaFromFile
     * @memberof CriteriaManagerWorkflow
     * @param {number} entityId - The entity ID to associate criteria with.
     * @param {string} fileName - The name of the file to extract criteria from.
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<number>} The number of criteria extracted and stored.
     * 
     * @workflow_steps
     * 1. Fetches the entity to get the folder path.
     * 2. Constructs the full file path.
     * 3. Extracts text from the file using FileService.
     * 4. Calls the existing extractAndStoreEntityCriteria method.
     * 5. Clears the queue status (signals completion of async processing).
     * 6. Logs the successful extraction.
     * 
     * @boundary_rules
     * - ✅ Uses FileService to read the file.
     * - ✅ Uses the existing extractAndStoreEntityCriteria method.
     * - ✅ Uses LogService for activity logging.
     * - ✅ Uses EntityService for queue status updates.
     * 
     * @soc_explanation
     * - This workflow is responsible for its own queue status domain updates.
     * - Sets queue status to PROCESSING at start and clears to null upon completion,
     *   keeping the event listener layer completely agnostic of business logic (Separation of Concerns).
     */
    async extractEntityCriteriaFromFile(entityId, fileName, signal) {
        const entity = entityRepo.getEntityById(entityId);
        if (!entity || !entity.folderPath) {
            logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'CriteriaManagerWorkflow', 'Cannot extract criteria: entity not found or has no folder path');
            return 0;
        }

        const filePath = path.join(entity.folderPath, fileName);

        try {
            entityService.updateEntityStatus(entityId, 'processing');
            entityService.updateEntityMetadata(entityId, { processingStartedAt: new Date().toISOString() });

            const text = await FileService.extractTextFromFile(filePath);
            if (!text || text.trim().length === 0) {
                logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'CriteriaManagerWorkflow', `No text content extracted from file: ${fileName}`);
                entityService.updateEntityStatus(entityId, null);
                return 0;
            }

            await this.extractAndStoreEntityCriteria(entityId, text, signal);

            logService.addActivityLog(
                'Entity',
                entityId,
                LOG_LEVELS.INFO,
                `Extracted criteria from file: ${fileName}`,
                entity.folderPath
            );

            entityService.updateEntityStatus(entityId, null);

            return 1;
        } catch (error) {
            logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'CriteriaManagerWorkflow', `Failed to extract criteria from file: ${error.message}`);
            logService.logErrorFile('CriteriaManagerWorkflow', `Failed to extract criteria from file: ${fileName}`, error);
            entityService.updateEntityStatus(entityId, null);
            logService.addActivityLog(
                'Entity',
                entityId,
                LOG_LEVELS.ERROR,
                `Failed to extract criteria from file: ${fileName} - ${error.message}`,
                entity.folderPath
            );
            return 0;
        }
    }
}

module.exports = new CriteriaManagerWorkflow();
