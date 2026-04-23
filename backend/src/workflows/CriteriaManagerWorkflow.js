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
const { ENTITY_TYPES, LOG_LEVELS, LOG_SYMBOLS, SETTING_KEYS, ENTITY_STATUS, QUEUE_TASKS, HTTP_STATUS, AI_TASK_TYPES } = require('../config/constants');
const AppError = require('../utils/AppError');
const path = require('path');

/**
  * @socexplanation
  * Error handling was refactored to explicitly catch and log data corruption/math failures
  * via injected LogService, eliminating silent failures while maintaining graceful degradation.
  */
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
         * @param {Object} deps.dimensionService - The DimensionService instance
         * @param {Object} deps.blueprintRepo - The BlueprintRepo instance
         * @param {Object} deps.dynamicSchemaBuilder - The DynamicSchemaBuilder instance
         * @param {Object} deps.promptBuilder - The PromptBuilder instance
         * @param {Object} deps.criteriaMergeService - The CriteriaMergeService instance
         * @param {Object} deps.matchingEngine - The MatchingEngine instance
         * @param {Object} deps.markdownGenerator - The MarkdownGenerator instance
         * @dependency_injection Dependencies are injected strictly via the constructor.
         * Defensive getters are not required as instantiation guarantees dependency presence.
         * Reasoning: Constructor Injection ensures all services are available immediately after construction.
         */
    constructor({ settingsManager, aiService, aiValidatorService, fileService, pdfService, logService, entityService, criteriaService, entityRepo, criteriaRepo, dimensionRepo, dimensionService, blueprintRepo, dynamicSchemaBuilder, promptBuilder, queueService, criteriaMergeService, matchingEngine, markdownGenerator }) {
        this._settingsManager = settingsManager;
        this._aiService = aiService;
        this._aiValidatorService = aiValidatorService;
        this._fileService = fileService;
        this._pdfService = pdfService;
        this._logService = logService;
        this._entityService = entityService;
        this._criteriaService = criteriaService;
        this._entityRepo = entityRepo;
        this._criteriaRepo = criteriaRepo;
        this._dimensionRepo = dimensionRepo;
        this._dimensionService = dimensionService;
        this._blueprintRepo = blueprintRepo;
        this._dynamicSchemaBuilder = dynamicSchemaBuilder;
        this._promptBuilder = promptBuilder;
        this._queueService = queueService;
        this._criteriaMergeService = criteriaMergeService;
        this._matchingEngine = matchingEngine;
        this._markdownGenerator = markdownGenerator;
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
      * Creates a manual criterion with AI-generated vector embedding.
      * Orchestrates validation, embedding generation, and database persistence.
      *
      * @async
      * @method createManualCriterion
      * @memberof CriteriaManagerWorkflow
      * @param {Object} criterionDto - The criterion data transfer object.
      * @param {string} criterionDto.displayName - The display name for the criterion.
      * @param {string} criterionDto.dimension - The dimension/category for the criterion.
      * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
      * @returns {Promise<Object>} The fully hydrated criterion object for API response.
      * @throws {Error} With status 400 if displayName or dimension is missing.
      * @throws {Error} With status 409 if criterion already exists.
      *
      * @socexplanation
      * This method belongs in the Workflow layer because it coordinates cross-domain operations:
      * - Validates business rules (displayName, dimension presence)
      * - Coordinates AI embedding generation (requires AiService)
      * - Persists to database using CriteriaService.createStagedCriterion (unified staging lifecycle)
      * - Returns fully hydrated API response (requires CriteriaService)
      * Separating this into the Workflow ensures the Controller remains thin and focused on HTTP handling.
      */
    async createManualCriterion(criterionDto, signal) {
        const { displayName, dimension, requirementId, offeringId } = criterionDto;

        const normalizedName = this._normalizeCriterionName(displayName);

        const existingCriterion = this._criteriaRepo.getCriterionByName(normalizedName);
        if (existingCriterion) {
            throw new AppError('Criterion already exists', HTTP_STATUS.CONFLICT);
        }

        const tag = this._dimensionService.getDimensionTag(dimension);

        const contextualizedText = `[${tag}] ${displayName}`;
        const embedding = await this._aiService.generateEmbedding(contextualizedText, { taskType: AI_TASK_TYPES.EMBEDDING, signal });

        const id = await this._criteriaService.createStagedCriterion({
            displayName,
            normalizedName,
            dimension,
            dimensionDisplayName: tag,
            embeddingArray: embedding
        });

        if (requirementId != null) {
            this._criteriaRepo.linkCriterionToEntity(requirementId, id, true);
            const createdCriterionObject = [{
                id,
                normalizedName,
                displayName,
                dimension,
                isRequired: true
            }];
            await this._criteriaMergeService.executeAutoMerge(requirementId, createdCriterionObject);
        }

        if (offeringId != null) {
            this._criteriaRepo.linkCriterionToEntity(offeringId, id, false);
            const createdCriterionObject = [{
                id,
                normalizedName,
                displayName,
                dimension,
                isRequired: false
            }];
            await this._criteriaMergeService.executeAutoMerge(offeringId, createdCriterionObject);
        }

        await this.writeMasterFileForCriterion(id);

        return id;
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
            /** @socexplanation Added errorObj to prevent swallowed stack traces. */
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: 'JSON Parse Error', errorObj: e });
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

                const tag = this._dimensionService.getDimensionTag(dimension);

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
                    embedding = await this._aiService.generateEmbedding(contextualizedText, { taskType: AI_TASK_TYPES.EMBEDDING, signal, logFolderPath: folderPath });
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
     *
     * @socexplanation
     * Error handling has been consolidated to the logSystemFault method to enforce DRY principles
     * and maintain terminal stack trace visibility. This replaces the previous pattern of calling
     * logTerminal followed by logErrorFile separately.
     */
    async extractAndStoreEntityCriteria(entityId, text, signal) {
        if (!this._aiValidatorService.validateInputText(text, `Entity #${entityId} extraction`)) {
            return;
        }

        const entityRole = this._entityService.getEntityRole(entityId);
        const blueprintId = this._entityService.getEntityBlueprintId(entityId);
        const activeDimensions = this._dimensionService.resolveDimensionsByBlueprintId(blueprintId);

        if (activeDimensions.length === 0) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'No active dimensions found in database.' });
            return;
        }

        const isRequired = entityRole === ENTITY_TYPES.REQUIREMENT;

        if (activeDimensions.length === 0) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'No active dimensions found in database.' });
            return;
        }

        const combinedDimensions = {};
        for (const dim of activeDimensions) {
            const singleDimArray = [dim];
            try {
                const messages = this._promptBuilder.buildDynamicExtractionMessages(text, singleDimArray, entityRole);
                const extractionSchema = this._dynamicSchemaBuilder.buildExtractionSchema(singleDimArray, entityRole);
                const { content } = await this._aiService.generateChatResponse(messages, { 
                    taskType: AI_TASK_TYPES.METADATA, 
                    format: extractionSchema, 
                    logFolderPath: this._entityService.getEntityFolderPath(entityId), 
                    logAction: `Extracted dimension '${dim.displayName}' for Entity #${entityId}.`, 
                    signal 
                });
                const parsed = this._parseDimensionResponse(content, singleDimArray);
                combinedDimensions[dim.name] = (parsed.dimensions && parsed.dimensions[dim.name]) ? parsed.dimensions[dim.name] : [];
            } catch (err) {
                this._logService.logSystemFault({ origin: 'CriteriaManagerWorkflow', message: `Failed to extract dimension '${dim.name}'`, errorObj: err });
                combinedDimensions[dim.name] = [];
            }
        }

        const dimensions = combinedDimensions;

        if (this._aiValidatorService.isEmptyExtraction(dimensions, activeDimensions)) {
            const inputPreview = text.trim().substring(0, 200);
            this._logService.logSystemFault({
                origin: 'CriteriaManagerWorkflow',
                message: `AI returned completely empty dimensions for Entity #${entityId}. Input text preview: "${inputPreview}"`,
                errorObj: null,
                details: { entityId, inputLength: text.length, inputPreview }
            });
            return;
        }

        const criteriaByDimension = {};
        for (const dim of activeDimensions) {
            const criteria = dimensions[dim.name] || [];
            criteriaByDimension[dim.name] = criteria;
        }

        try {
            this._entityService.logActivity(entityId, {
                logType: LOG_LEVELS.INFO,
                message: `Extracted ${activeDimensions.length}-Dimension criteria from entity text.`,
                verboseDetails: criteriaByDimension
            });
        } catch (err) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: 'Failed to log criteria extraction', errorObj: err });
        }

        const createdCriteria = [];
        for (const [dimension, criteriaList] of Object.entries(dimensions)) {
            const dimensionDisplayName = this._dimensionService.getDimensionTag(dimension);
            for (const criterionName of criteriaList) {
                const normalizedName = this._normalizeCriterionName(criterionName);
                
                let existing = this._criteriaRepo.getCriterionByName(normalizedName);
                let criterionId;

                if (existing) {
                    criterionId = existing.id;
                } else {
                    const contextualizedText = `[${dimensionDisplayName}] ${criterionName}`;
                    const embedding = await this._aiService.generateEmbedding(contextualizedText, { taskType: AI_TASK_TYPES.EMBEDDING, signal });
                    
                    criterionId = await this._criteriaService.createStagedCriterion({
                        normalizedName,
                        displayName: criterionName,
                        dimension,
                        dimensionDisplayName,
                        embeddingArray: embedding
                    }, true); // Suppress event flood
                }

                this._criteriaRepo.linkCriterionToEntity(entityId, criterionId, isRequired);
                
                createdCriteria.push({
                    id: criterionId,
                    normalizedName,
                    displayName: criterionName,
                    dimension,
                    isRequired
                });
            }
        }

        await this._criteriaMergeService.executeAutoMerge(entityId, createdCriteria);

        await this.generateCriterionVaults(entityId);

        try {
            this._entityService.logActivity(entityId, {
                logType: LOG_LEVELS.INFO,
                message: `Stored ${createdCriteria.length} criteria across ${activeDimensions.length} dimensions with embeddings.`
            });
        } catch (err) {
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: 'Failed to log criteria storage', errorObj: err });
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
    calculateCriteriaMatch(requirementEntityId, offeringEntityId) {
        const reqName = this._entityService.getEntityName(requirementEntityId);
        const offName = this._entityService.getEntityName(offeringEntityId);

        this._entityService.assertExists(requirementEntityId);
        this._entityService.assertExists(offeringEntityId);

        const requirementCriteria = this._criteriaRepo.getCriteriaWithEmbeddingsForEntity(requirementEntityId);
        const offeringCriteria = this._criteriaRepo.getCriteriaWithEmbeddingsForEntity(offeringEntityId);

        const activeDimensions = this._dimensionRepo.getActiveDimensions();

        const minFloorSetting = parseFloat(this._settingsManager.get(SETTING_KEYS.MINIMUM_MATCH_FLOOR)) || 0.50;
        const perfectScoreSetting = parseFloat(this._settingsManager.get(SETTING_KEYS.PERFECT_MATCH_SCORE)) || 0.85;

        const matchSettings = {
            minimumFloor: minFloorSetting,
            perfectScore: perfectScoreSetting
        };

        const standardResult = this._matchingEngine.calculate(requirementCriteria, offeringCriteria, matchSettings);

        const rawComparison = this._matchingEngine.buildRawComparison({
            entities: {
                requirement: { id: requirementEntityId, name: reqName },
                offering: { id: offeringEntityId, name: offName }
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
     * Private helper method to prepare file extraction.
     * Handles: fetching entity, verifying folderPath, constructing file path,
     * updating state to EXTRACTING_CRITERIA, reading the file, and validating text content.
     * @method _prepareFileExtraction
     * @memberof CriteriaManagerWorkflow
     * @param {number} entityId - The entity ID.
     * @param {string} fileName - The name of the file to extract criteria from.
     * @returns {Promise<{entity: Object, filePath: string, text: string}|number>} Object with entity, filePath, and text, or 0 on failure.
     * @private
     */
    async _prepareFileExtraction(entityId, fileName) {
        const folderPath = this._entityService.getEntityFolderPath(entityId);

        if (!folderPath) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'Cannot extract criteria: entity not found or has no folder path' });
            return 0;
        }

        const filePath = path.join(folderPath, fileName);

        this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_CRITERIA });
        this._entityService.resetProcessingTimer(entityId);

        let text;
        const ext = path.extname(fileName).toLowerCase();
        if (ext === '.pdf') {
            const dataBuffer = await this._fileService.readBuffer(filePath);
            text = await this._pdfService.extractTextFromPDF(dataBuffer);
        } else {
            text = await this._fileService.readTextFile(filePath);
        }

        if (!text || text.trim().length === 0) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `No text content extracted from file: ${fileName}` });
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.COMPLETED });
            return 0;
        }

        return { filePath, text, folderPath };
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
     *
     * @socexplanation
     * Error handling has been consolidated to the logSystemFault method to enforce DRY principles
     * and maintain terminal stack trace visibility. This replaces the previous pattern of calling
     * logTerminal followed by logErrorFile separately.
     */
    async extractEntityCriteria(payload, signal) {
        const { entityId, fileName } = payload;

        const prepared = await this._prepareFileExtraction(entityId, fileName);
        if (!prepared) return 0;
        const { text } = prepared;

        try {
            await this._extractCriteriaWithoutEmbeddings(entityId, text, signal);

            this._entityService.logActivity(entityId, {
                logType: LOG_LEVELS.INFO,
                message: `Extracted criteria from file: ${fileName}`
            });

            return entityId;
        } catch (error) {
            this._logService.logSystemFault({ origin: 'CriteriaManagerWorkflow', message: `Failed to extract criteria from file: ${fileName}`, errorObj: error });
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

        const entityRole = this._entityService.getEntityRole(entityId);
        const blueprintId = this._entityService.getEntityBlueprintId(entityId);
        const activeDimensions = this._dimensionService.resolveDimensionsByBlueprintId(blueprintId);

        if (activeDimensions.length === 0) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: 'No active dimensions found in database.' });
            return;
        }

        const combinedDimensions = {};
        for (const dim of activeDimensions) {
            const singleDimArray = [dim];
            try {
                const messages = this._promptBuilder.buildDynamicExtractionMessages(text, singleDimArray, entityRole);
                const extractionSchema = this._dynamicSchemaBuilder.buildExtractionSchema(singleDimArray, entityRole);
                const { content } = await this._aiService.generateChatResponse(messages, { 
                    taskType: AI_TASK_TYPES.METADATA, 
                    format: extractionSchema, 
                    logFolderPath: this._entityService.getEntityFolderPath(entityId), 
                    logAction: `Extracted dimension '${dim.displayName}' for Entity #${entityId}.`, 
                    signal 
                });
                const parsed = this._parseDimensionResponse(content, singleDimArray);
                combinedDimensions[dim.name] = (parsed.dimensions && parsed.dimensions[dim.name]) ? parsed.dimensions[dim.name] : [];
            } catch (err) {
                this._logService.logTerminal({ status: 'ERROR', symbolKey: 'ERROR', origin: 'CriteriaManagerWorkflow', message: `Failed to extract dimension '${dim.name}'`, errorObj: err });
                combinedDimensions[dim.name] = [];
            }
        }

        const dimensions = combinedDimensions;
        if (this._aiValidatorService.isEmptyExtraction(dimensions, activeDimensions)) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'CriteriaManagerWorkflow', message: `AI returned completely empty dimensions for Entity #${entityId}.` });
            return;
        }

        const isRequired = entityRole === ENTITY_TYPES.REQUIREMENT;

        for (const [dimension, criteriaList] of Object.entries(dimensions)) {
            const dimensionDisplayName = this._dimensionService.getDimensionTag(dimension);
            for (const criterionName of criteriaList) {
                const normalizedName = this._normalizeCriterionName(criterionName);
                
                let existing = this._criteriaRepo.getCriterionByName(normalizedName);
                let criterionId;

                if (existing) {
                    criterionId = existing.id;
                } else {
                    criterionId = await this._criteriaService.createStagedCriterion({
                        normalizedName,
                        displayName: criterionName,
                        dimension,
                        dimensionDisplayName,
                        embeddingArray: null 
                    }, true); // Suppress event flood
                }

                this._criteriaRepo.linkCriterionToEntity(entityId, criterionId, isRequired);
            }
        }
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

        this._entityService.assertExists(entityId);

        const absoluteFolderPath = this._entityService.getEntityFolderPath(entityId);

        try {
            const criteriaWithoutEmbeddings = this._criteriaRepo.getCriteriaWithoutEmbeddingsForEntity(entityId);

            if (!criteriaWithoutEmbeddings || criteriaWithoutEmbeddings.length === 0) {
                this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_LEVELS.INFO, origin: 'CriteriaManagerWorkflow', message: `No criteria to vectorize for Entity #${entityId}.` });
            } else {
                for (const criterion of criteriaWithoutEmbeddings) {
                    const tag = this._dimensionService.getDimensionTag(criterion.dimension);
                    const contextualizedText = `[${tag}] ${criterion.displayName}`;

                    const embedding = await this._aiService.generateEmbedding(contextualizedText, { taskType: AI_TASK_TYPES.EMBEDDING, signal, logFolderPath: absoluteFolderPath });

                    this._criteriaRepo.updateCriterionEmbedding(criterion.id, embedding);
                }
            }

            return entityId;
        } catch (error) {
            /** @socexplanation Added errorObj to prevent swallowed stack traces. */
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: 'Failed to vectorize criteria', errorObj: error });
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

        this._entityService.assertExists(entityId);

        try {
            const linkedCriteria = this._criteriaRepo.getCriteriaForEntity(entityId);

            await this._criteriaMergeService.executeAutoMerge(entityId, linkedCriteria);

            if (isNewUpload) {
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.MOVING_TO_VAULT });
            } else {
                // Entity is already in vault, safe to generate criteria links now
                await this.generateCriterionVaults(entityId);
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.COMPLETED });
            }

            this._entityService.logActivity(entityId, {
                logType: LOG_LEVELS.INFO,
                message: `Criteria merged and vaults generated for entity #${entityId}`
            });

            return entityId;
        } catch (error) {
            /** @socexplanation Added errorObj to prevent swallowed stack traces. */
            this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'CriteriaManagerWorkflow', message: 'Failed to merge criteria', errorObj: error });
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
     *
     * @socexplanation
     * Error handling has been consolidated to the logSystemFault method to enforce DRY principles
     * and maintain terminal stack trace visibility. This replaces the previous pattern of calling
     * logTerminal followed by logErrorFile separately.
     */
    async extractEntityCriteriaFromFile(payload, signal) {
        const { entityId, fileName, isNewUpload } = payload;

        const prepared = await this._prepareFileExtraction(entityId, fileName);
        if (!prepared) return 0;
        const { text, folderPath } = prepared;

        try {
            await this.extractAndStoreEntityCriteria(entityId, text, signal);

            if (isNewUpload) {
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.MOVING_TO_VAULT });
                this._queueService.enqueue(QUEUE_TASKS.FINALIZE_ENTITY_WORKSPACE, {
                    entityId,
                    folderPath: folderPath
                });
            } else {
                this._entityService.updateState(entityId, { status: ENTITY_STATUS.COMPLETED });
            }

            this._entityService.logActivity(entityId, {
                logType: LOG_LEVELS.INFO,
                message: `Extracted criteria from file: ${fileName}`
            });

            return 1;
        } catch (error) {
            this._logService.logSystemFault({ origin: 'CriteriaManagerWorkflow', message: `Failed to extract criteria from file: ${fileName}`, errorObj: error });
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.FAILED, error: error.message });
            this._entityService.logActivity(entityId, {
                logType: LOG_LEVELS.ERROR,
                message: `Failed to extract criteria from file: ${fileName} - ${error.message}`
            });
            throw error;
        }
    }

    /**
     * Generates vault folders and master markdown files for criteria linked to an entity.
     * Always regenerates the markdown file to ensure Wiki Links to new entities are added.
     *
     * @async
     * @method generateCriterionVaults
     * @memberof CriteriaManagerWorkflow
     * @param {number} entityId - The entity ID.
     * @returns {Promise<void>}
     */
    async generateCriterionVaults(entityId) {
        const linkedCriteria = this._criteriaRepo.getCriteriaForEntity(entityId);

        for (const criterion of linkedCriteria) {
            await this.writeMasterFileForCriterion(criterion.id, true);
        }
    }

    /**
     * Manually regenerates the master markdown file for a single criterion.
     * Generates/updates the vault folder and master file for the specified criterion.
     *
     * @async
     * @method writeMasterFileForCriterion
     * @memberof CriteriaManagerWorkflow
     * @param {number} criterionId - The criterion ID.
     * @param {boolean} [suppressEvent=false] - If true, suppresses the RESOURCE_STATE_CHANGED event.
     * @returns {Promise<void>}
     *
     * @workflow_steps
     * 1. Delegates to CriteriaService.writeMasterFile(criterionId).
     *
     * @socexplanation
     * - Single-criterion version of generateCriterionVaults.
     * - Allows manual regeneration without processing all entity criteria.
     * - Delegates all logic to CriteriaService.
     */
    async writeMasterFileForCriterion(criterionId, suppressEvent = false) {
        return this._criteriaService.writeMasterFile(criterionId, suppressEvent);
    }
}

module.exports = CriteriaManagerWorkflow;
