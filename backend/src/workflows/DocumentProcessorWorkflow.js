/**
 * @module DocumentProcessorWorkflow
 * @description Domain Service for handling document upload and AI-based entity extraction from PDF files.
 *
 * This workflow orchestrates the document lifecycle. It delegates document parsing to PdfService and schema mapping to MetadataMapper.
 *
 * @responsibility
 * - Orchestrates the document upload process: creates temp folder, moves file, queues processing.
 * - Extracts entity details from uploaded documents using AI services.
 * - Generates markdown posting files and registers document records.
 * - Coordinates with FileService, QueueService, EntityService, and AiService.
 *
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (FileService, QueueService) and Domain Services (EntityService, CriteriaManagerWorkflow).
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT write SQL queries (use Repositories).
 * - ❌ MUST NOT handle criteria extraction directly - delegates to CriteriaManagerWorkflow.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */
const MarkdownGenerator = require('../utils/MarkdownGenerator');
const NameGenerator = require('../utils/NameGenerator');
const { processAiTasks } = require('../utils/asyncHandler');
const { DOCUMENT_TYPES, ENTITY_STATUS, ENTITY_ROLES, AI_TASK_TYPES, LOG_LEVELS, LOG_SYMBOLS, SETTING_KEYS } = require('../config/constants');
const path = require('path');

class DocumentProcessorWorkflow {

    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.entityService - The EntityService instance
     * @param {Object} deps.fileService - The FileService instance
     * @param {Object} deps.settingsManager - The SettingsManager instance
     * @param {Object} deps.aiService - The AiService instance
     * @param {Object} deps.aiValidatorService - The AiValidatorService instance
     * @param {Object} deps.eventService - The EventService instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.queueService - The QueueService instance
     * @param {Object} deps.criteriaManagerWorkflow - The CriteriaManagerWorkflow instance
     * @param {Object} deps.blueprintRepo - The BlueprintRepo instance
     * @param {Object} deps.entityRepo - The EntityRepo instance
     * @param {Object} deps.dynamicSchemaBuilder - The DynamicSchemaBuilder instance
     * @param {Object} deps.promptBuilder - The PromptBuilder instance
     * @param {Object} deps.metadataMapper - The MetadataMapper instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ entityService, fileService, settingsManager, aiService, aiValidatorService, eventService, logService, queueService, criteriaManagerWorkflow, blueprintRepo, entityRepo, dynamicSchemaBuilder, promptBuilder, metadataMapper }) {
        this._entityService = entityService;
        this._fileService = fileService;
        this._settingsManager = settingsManager;
        this._aiService = aiService;
        this._aiValidatorService = aiValidatorService;
        this._eventService = eventService;
        this._logService = logService;
        this._queueService = queueService;
        this._criteriaManagerWorkflow = criteriaManagerWorkflow;
        this._blueprintRepo = blueprintRepo;
        this._entityRepo = entityRepo;
        this._dynamicSchemaBuilder = dynamicSchemaBuilder;
        this._promptBuilder = promptBuilder;
        this._metadataMapper = metadataMapper;
    }

    /**
     * Atomized Step 1: Parses document content and extracts raw text.
     * Validates the input, extracts text from PDF, and saves raw-extraction.txt to the staging folder.
     *
     * @async
     * @method parseDocumentContent
     * @memberof DocumentProcessorWorkflow
     * @param {Object} payload - The task payload containing entity identification data.
     * @param {number} payload.entityId - The entity ID to associate extracted data with.
     * @param {string} payload.folderPath - The staging folder path containing the uploaded document (in UPLOADS_DIR).
     * @param {string} payload.fileName - The name of the uploaded document file.
     * @returns {Promise<number>} The entity ID.
     *
     * @responsibility
     * - Extracts raw text from the uploaded document.
     * - Saves raw-extraction.txt to the current staging folder.
     * - The folder REMAINS in staging (UPLOADS_DIR) during this step.
     * - Finalization to the vault happens in finalizeEntityWorkspace.
     *
     * @boundary_rules
     * - ❌ MUST NOT call finalizeEntityDirectory - that happens at END of pipeline.
     * - ✅ Saves raw-extraction.txt to the CURRENT folderPath (staging).
     */
    async parseDocumentContent(payload) {
        const { entityId, folderPath, fileName } = payload;
        const fileService = this._fileService;

        this._entityService.updateMetadata(entityId, { processingStartedAt: new Date().toISOString() });

        if (!folderPath || typeof folderPath !== 'string') {
            throw new Error(`Invalid folderPath provided for entity #${entityId}. Expected string, received ${typeof folderPath}.`);
        }
        if (!fileName || typeof fileName !== 'string') {
            throw new Error(`Invalid fileName provided for entity #${entityId}. Expected string, received ${typeof fileName}.`);
        }

        const filePath = path.join(folderPath, fileName);

        if (!fileService.validatePath(filePath)) {
            const error = new Error(`File not found at path: ${filePath}. The file was not moved correctly during upload.`);
            error.isFatalClientError = true;
            throw error;
        }

        const rawText = await fileService.extractTextFromFile(filePath);

        if (!this._aiValidatorService.validateInputText(rawText, `Entity #${entityId} PDF extraction`)) {
            const error = new Error('PDF appears to be empty or unreadable. Cannot proceed with extraction.');
            error.isFatalClientError = true;
            throw error;
        }

        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity) {
            const error = new Error(`Entity #${entityId} not found.`);
            error.isFatalClientError = true;
            throw error;
        }

        fileService.saveTextFile(folderPath, 'raw-extraction.txt', rawText);

        return entityId;
    }

    /**
     * Atomized Step 2: Extracts verbatim text from the raw extraction file.
     * Uses AI to generate the markdown entity profile.
     *
     * @async
     * @method extractVerbatimText
     * @memberof DocumentProcessorWorkflow
     * @param {Object} payload - The task payload containing entity identification data.
     * @param {number} payload.entityId - The entity ID to associate extracted data with.
     * @param {string} payload.folderPath - The folder path containing the raw extraction file.
     * @param {string} payload.fileName - The name of the original uploaded document file.
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<number>} The entity ID.
     */
    async extractVerbatimText(payload, signal) {
        const { entityId, folderPath } = payload;
        const fileService = this._fileService;

        const rawText = fileService.readTextFile(path.join(folderPath, 'raw-extraction.txt'));
        const markdownMessages = this._promptBuilder.buildMarkdownExtractionMessages(rawText);

        const { content: verbatimPosting } = await this._aiService.generateChatResponse(
            markdownMessages,
            { logFolderPath: folderPath, logAction: `Extracted verbatim profile for Entity #${entityId}.`, signal }
        );

        const entity = this._entityRepo.getEntityById(entityId);
        const entityTitle = entity?.nicename || 'Unknown Title';
        const entityDescription = entity?.description || 'Unknown Organization';

        const mdContent = MarkdownGenerator.generateEntityProfile(entityTitle, entityDescription, {
            rawText,
            verbatimPosting
        });

        // Save the generated profile as verbatim_extraction.md
        fileService.saveTextFile(folderPath, 'verbatim_extraction.md', mdContent);

        return entityId;
    }

    /**
     * Atomized Step 3: Extracts entity metadata from the raw extraction file.
     * Uses AI to extract blueprint fields and updates entity metadata.
     *
     * @async
     * @method extractEntityMetadata
     * @memberof DocumentProcessorWorkflow
     * @param {Object} payload - The task payload containing entity identification data.
     * @param {number} payload.entityId - The entity ID to associate extracted data with.
     * @param {string} payload.folderPath - The folder path containing the raw extraction file.
     * @param {string} payload.fileName - The name of the original uploaded document file.
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<number>} The entity ID.
     */
    async extractEntityMetadata(payload, signal) {
        const { entityId, folderPath, fileName } = payload;
        const fileService = this._fileService;

        const rawText = fileService.readTextFile(path.join(folderPath, 'raw-extraction.txt'));

        const entity = this._entityRepo.getEntityById(entityId);
        const entityRole = entity?.entityType || ENTITY_ROLES.OFFERING;

        let blueprintFields = [];
        let blueprintName = 'Entity';

        if (entity?.blueprintId) {
            const blueprint = this._blueprintRepo.getBlueprintById(entity.blueprintId);
            if (blueprint) {
                blueprintName = entityRole === ENTITY_ROLES.REQUIREMENT ? blueprint.requirementLabelSingular : blueprint.offeringLabelSingular;
                blueprintFields = this._blueprintRepo.getBlueprintFields(entity.blueprintId, entityRole);
            }
        }

        if (blueprintFields.length === 0) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'DocumentProcessorWorkflow', message: 'No blueprint fields found for this entity role, using fallback extraction.' });
        }

        const dynamicMetadata = {};
        const tasks = [];

        if (blueprintFields.length > 0) {
            const metadataTasks = blueprintFields.map((field) => async () => {
                const singleFieldArray = [field];
                const fieldName = field.fieldName || field.field_name;

                try {
                    const metadataMessages = this._promptBuilder.buildEntityMetadataMessages(rawText, blueprintName, singleFieldArray);
                    const metadataSchema = this._dynamicSchemaBuilder.buildMetadataSchema(singleFieldArray);

                    const { content: responseString } = await this._aiService.generateChatResponse(
                        metadataMessages,
                        { format: metadataSchema, logFolderPath: folderPath, taskType: AI_TASK_TYPES.METADATA, temperature: 0.1, logAction: `Extracted field '${fieldName}' for Entity #${entityId}.`, signal }
                    );

                    const parsed = this._metadataMapper.parseAndMapMetadata(responseString, singleFieldArray);

                    if (parsed[fieldName] !== undefined) {
                        dynamicMetadata[fieldName] = parsed[fieldName];
                    }
                } catch (err) {
                    this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'DocumentProcessorWorkflow', message: `Failed to extract field '${fieldName}' for Entity #${entityId}: ${err.message}` });
                    throw err;
                }
            });
            tasks.push(...metadataTasks);
        }

        const allowConcurrent = this._settingsManager.get(SETTING_KEYS.ALLOW_CONCURRENT_AI) === 'true';

        if (tasks.length > 0) {
            await processAiTasks(
                tasks,
                async (task) => await task(),
                allowConcurrent
            );
        }

        let assembledMetadata = {
            ...(entity?.metadata || {}),
            ...dynamicMetadata,
            folderPath
        };

        const finalMetadata = NameGenerator.injectNiceName(assembledMetadata, blueprintFields);

        this._entityService.updateMetadata(entityId, finalMetadata);

        if (typeof this._entityService.updateEntityDetails === 'function') {
            this._entityService.updateEntityDetails(entityId, {
                name: finalMetadata.nicename,
                niceNameLine1: finalMetadata.niceNameLine1,
                niceNameLine2: finalMetadata.niceNameLine2
            });
        }

        this._entityService.updateFolderPath(entityId, folderPath);

        // Register the original uploaded file as a supporting document
        this._entityService.registerDocumentRecord({
            entityId,
            docType: DOCUMENT_TYPES.SUPPORTING_DOC,
            fileName
        });

        // Register the newly generated verbatim extraction
        this._entityService.registerDocumentRecord({
            entityId,
            docType: DOCUMENT_TYPES.ENTITY_VERBATIM_EXTRACT,
            fileName: 'verbatim_extraction.md'
        });

        return entityId;
    }

    /**
     * Master Orchestrator: Processes a document through the entire pipeline sequentially.
     * Executes all processing steps in order: Parse -> Extract Verbatim -> Extract Metadata ->
     * Extract Criteria -> Vectorize Criteria -> Merge Criteria -> Finalize Workspace.
     *
     * This method acts as the central State Machine, catching all bubbled exceptions and handling
     * all UI state transitions. The atomic sub-methods remain pure domain functions without
     * managing their own state updates.
     *
     * @async
     * @method processDocument
     * @memberof DocumentProcessorWorkflow
     * @param {Object} payload - The task payload containing entity identification data.
     * @param {number} payload.entityId - The entity ID.
     * @param {string} payload.folderPath - The folder path containing the uploaded document.
     * @param {string} payload.fileName - The name of the uploaded document file.
     * @param {AbortSignal} [signal] - Optional signal to abort the processing.
     * @returns {Promise<number>} The entity ID.
     *
     * @responsibility
     * - Acts as the central State Machine Orchestrator for the document processing pipeline.
     * - Updates processing step and entity status before each atomic method invocation.
     * - Handles all error states and transitions entity to FAILED on any pipeline failure.
     * - Ensures atomic sub-methods remain pure domain functions without state management.
     *
     * @socexplanation
     * - All state transitions (ENTITY_STATUS) are centralized in this method.
     * - Atomic sub-methods (parseDocumentContent, extractVerbatimText, extractEntityMetadata, finalizeEntityWorkspace)
     *   are pure domain functions that delegate state management to this orchestrator.
     * - Any exceptions from atomic methods are caught here and transformed into FAILED status.
     */
    async processDocument(payload, signal) {
        const { entityId, folderPath } = payload;

        try {
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.PARSING_DOCUMENT });
            await this.parseDocumentContent(payload, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_VERBATIM_TEXT });
            await this.extractVerbatimText(payload, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_METADATA });
            await this.extractEntityMetadata(payload, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_CRITERIA });
            await this._criteriaManagerWorkflow.extractEntityCriteria({ entityId, fileName: 'raw-extraction.txt', isNewUpload: true }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.VECTORIZING_CRITERIA });
            await this._criteriaManagerWorkflow.vectorizeEntityCriteria({ entityId, isNewUpload: true }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.MERGING_CRITERIA });
            await this._criteriaManagerWorkflow.mergeEntityCriteria({ entityId, isNewUpload: true }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.MOVING_TO_VAULT });
            await this.finalizeEntityWorkspace({ entityId, folderPath }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.COMPLETED });

            return entityId;
        } catch (error) {
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.FAILED, error: error.message });
            throw error;
        }
    }

    /**
     * Atomized Step FINAL: Finalizes the entity workspace by moving the folder from staging to the vault.
     * Generates the dynamic master document matching the folder name and injects a UI deeplink.
     */
    async finalizeEntityWorkspace(payload) {
        const { entityId, folderPath } = payload;

        const entity = this._entityRepo.getEntityById(entityId);
        if (!entity) {
            throw new Error(`Entity #${entityId} not found.`);
        }

        const line1 = entity.niceNameLine1 || entity.nicename || 'Unknown';
        const line2 = entity.niceNameLine2 || 'Unknown';
        const entityType = entity.entityType;

        // 1. Move to permanent vault
        const finalFolderPath = this._fileService.finalizeWorkspace({ entityType, line1, line2, currentStagingPath: folderPath });

        this._entityService.updateFolderPath(entityId, finalFolderPath);

        // 2. Generate dynamic master document named after the folder
        const finalFolderName = require('path').basename(finalFolderPath);
        const finalFileName = `${finalFolderName}.md`;
        
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const route = entityType === 'requirement' ? 'requirements' : 'offerings';
        const deeplink = `${baseUrl}/${route}?id=${entityId}`;
        
        const mdContent = `# ${finalFolderName}\n\n**[View Entity in Compari](${deeplink})**\n`;
        this._fileService.saveTextFile(finalFolderPath, finalFileName, mdContent);

        // 3. Register and update DB records
        this._entityService.registerDocumentRecord({
            entityId,
            docType: DOCUMENT_TYPES.MASTER_DOCUMENT,
            fileName: finalFileName
        });

        this._entityService.updateMasterFile(entityId, finalFileName);

        this._logService.addActivityLog({
            entityType: 'Entity',
            entityId,
            logType: LOG_LEVELS.INFO,
            message: `Entity workspace finalized. Moved to vault: ${finalFolderPath}`,
            folderPath: finalFolderPath
        });

        return entityId;
    }
}

module.exports = DocumentProcessorWorkflow;