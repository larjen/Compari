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
const { DOCUMENT_TYPES, ENTITY_STATUS, ENTITY_TYPES, AI_TASK_TYPES, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');
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
     * @param {Object} deps.criteriaService - The CriteriaService instance
     * @param {Object} deps.blueprintRepo - The BlueprintRepo instance
     * @param {Object} deps.entityRepo - The EntityRepo instance
     * @param {Object} deps.dynamicSchemaBuilder - The DynamicSchemaBuilder instance
     * @param {Object} deps.promptBuilder - The PromptBuilder instance
     * @param {Object} deps.metadataMapper - The MetadataMapper instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ entityService, fileService, pdfService, settingsManager, aiService, aiValidatorService, eventService, logService, queueService, criteriaManagerWorkflow, criteriaService, blueprintRepo, entityRepo, dynamicSchemaBuilder, promptBuilder, metadataMapper }) {
        this._entityService = entityService;
        this._fileService = fileService;
        this._pdfService = pdfService;
        this._settingsManager = settingsManager;
        this._aiService = aiService;
        this._aiValidatorService = aiValidatorService;
        this._eventService = eventService;
        this._logService = logService;
        this._queueService = queueService;
        this._criteriaManagerWorkflow = criteriaManagerWorkflow;
        this._criteriaService = criteriaService;
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
        const { entityId, fileName } = payload;
        const fileService = this._fileService;
        const pdfService = this._pdfService;

        this._entityService.resetProcessingTimer(entityId);

        let filePath = this._entityService.resolveEntityFilePath(entityId, fileName);
        if (!filePath) {
            throw new Error(`Could not resolve folder path for entity #${entityId}.`);
        }
        if (!fileName || typeof fileName !== 'string') {
            throw new Error(`Invalid fileName provided for entity #${entityId}. Expected string, received ${typeof fileName}.`);
        }

        const fileExists = await fileService.waitForFile(filePath);

        if (!fileExists) {
            filePath = this._entityService.resolveEntityFilePath(entityId, fileName);
            
            if (!filePath || !fileService.validatePath(filePath)) {
                const error = new Error(`File not found at path: ${filePath}. The file was not moved correctly during upload or the folder was moved by a concurrent task.`);
                error.isFatalClientError = true;
                throw error;
            }
        }

        let rawText;
        const ext = path.extname(fileName).toLowerCase();
        if (ext === '.pdf') {
            const dataBuffer = await fileService.readBuffer(filePath);
            rawText = await pdfService.extractTextFromPDF(dataBuffer);
        } else {
            rawText = await fileService.readTextFile(filePath);
        }

        if (!this._aiValidatorService.validateInputText(rawText, `Entity #${entityId} PDF extraction`)) {
            const error = new Error('PDF appears to be empty or unreadable. Cannot proceed with extraction.');
            error.isFatalClientError = true;
            throw error;
        }

        this._entityService.assertExists(entityId);

        const folderPath = this._entityService.getEntityFolderPath(entityId);
        await fileService.saveTextFile(folderPath, 'raw-extraction.txt', rawText);

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
     * @socexplanation Refactored to enforce "Tell, Don't Ask" (ID-First Resolution). Stripped entity data-fetching from the macro-orchestrator to prevent parameter creep and maintain strict boundary encapsulation.
     */
    async extractVerbatimText(payload, signal) {
        const { entityId } = payload;

        const rawTextFilePath = this._entityService.resolveEntityFilePath(entityId, 'raw-extraction.txt');
        if (!rawTextFilePath) {
            throw new Error(`Could not resolve folder path for entity #${entityId}.`);
        }

        const rawText = await this._fileService.readTextFile(rawTextFilePath);
        const folderPath = this._entityService.getEntityFolderPath(entityId);
        const markdownMessages = this._promptBuilder.buildMarkdownExtractionMessages(rawText);

        const { content: verbatimPosting } = await this._aiService.generateChatResponse(
            markdownMessages,
            { taskType: AI_TASK_TYPES.GENERAL, logFolderPath: folderPath, logAction: `Extracted verbatim profile for Entity #${entityId}.`, signal }
        );

        await this._entityService.generateAndSaveVerbatimProfile(entityId, rawText, verbatimPosting);

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
        const { entityId, fileName } = payload;
        const fileService = this._fileService;

        const rawTextFilePath = this._entityService.resolveEntityFilePath(entityId, 'raw-extraction.txt');
        if (!rawTextFilePath) {
            throw new Error(`Could not resolve folder path for entity #${entityId}.`);
        }

        const rawText = await fileService.readTextFile(rawTextFilePath);
        const folderPath = this._entityService.getEntityFolderPath(entityId);

        const entityRole = this._entityService.getEntityRole(entityId);
        const blueprintId = this._entityService.getEntityBlueprintId(entityId);
        const existingMetadata = this._entityService.getEntityMetadata(entityId);

        let blueprintFields = [];
        let blueprintName = 'Entity';

        if (blueprintId) {
            const blueprint = this._blueprintRepo.getBlueprintById(blueprintId);
            if (blueprint) {
                blueprintName = entityRole === ENTITY_TYPES.REQUIREMENT ? blueprint.requirementLabelSingular : blueprint.offeringLabelSingular;
                blueprintFields = this._blueprintRepo.getBlueprintFields(blueprintId, entityRole);
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
                    /** @socexplanation Added errorObj to prevent swallowed stack traces. */
                    this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'DocumentProcessorWorkflow', message: `Failed to extract field '${fieldName}' for Entity #${entityId}`, errorObj: err });
                    throw err;
                }
            });
            tasks.push(...metadataTasks);
        }

        if (tasks.length > 0) {
            await this._aiService.executeParallelTasks(tasks, `Extracted metadata fields for Entity #${entityId}`);
        }

        let assembledMetadata = {
            ...existingMetadata,
            ...dynamicMetadata
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
        const { entityId } = payload;

        try {
            this._entityService.updateState(entityId, { status: ENTITY_STATUS.PARSING_DOCUMENT });
            await this.parseDocumentContent({ entityId, fileName: payload.fileName }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_VERBATIM_TEXT });
            await this.extractVerbatimText({ entityId }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_METADATA });
            await this.extractEntityMetadata({ entityId, fileName: payload.fileName }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.EXTRACTING_CRITERIA });
            await this._criteriaManagerWorkflow.extractEntityCriteria({ entityId, fileName: 'raw-extraction.txt', isNewUpload: true }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.VECTORIZING_CRITERIA });
            await this._criteriaManagerWorkflow.vectorizeEntityCriteria({ entityId, isNewUpload: true }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.MERGING_CRITERIA });
            await this._criteriaManagerWorkflow.mergeEntityCriteria({ entityId, isNewUpload: true }, signal);

            this._entityService.updateState(entityId, { status: ENTITY_STATUS.MOVING_TO_VAULT });
            await this.finalizeEntityWorkspace({ entityId }, signal);

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
     * Includes Wiki Links to associated criteria for Obsidian vault traversal.
     * @socexplanation Refactored to delegate master file I/O and DB updates to BaseEntityService.generateAndSaveMasterDocument, strictly enforcing DRY. Also enforces "Tell, Don't Ask" by using entity from callback.
     */
    async finalizeEntityWorkspace(payload) {
        const { entityId } = payload;

        // 1. Move to permanent vault
        const finalFolderPath = this._entityService.finalizeEntityWorkspace(entityId);

        // 2. NOW fetch associated criteria for Wiki Links
        const criteria = this._criteriaService.getCriteriaForEntity(entityId);
        const criteriaFolderNames = criteria.map(c => this._criteriaService.getCleanLinkName(c));

        const folderName = path.basename(finalFolderPath);
        const masterFileName = `${folderName}.md`;
        const allFiles = this._fileService.listFilesInFolder(finalFolderPath) || [];
        const associatedFiles = allFiles.filter(f => f !== masterFileName);

        let verbatimContent = "";
        if (allFiles.includes('verbatim_extraction.md')) {
            const verbatimPath = path.join(finalFolderPath, 'verbatim_extraction.md');
            verbatimContent = await this._fileService.readTextFile(verbatimPath) || "";
        }

        const blueprintId = this._entityService.getEntityBlueprintId(entityId);
        let blueprintLabel = null;
        if (blueprintId) {
            const blueprint = this._blueprintRepo.getBlueprintById(blueprintId);
            if (blueprint) {
                const entityRole = this._entityService.getEntityRole(entityId);
                blueprintLabel = entityRole === ENTITY_TYPES.REQUIREMENT ? blueprint.requirementLabelSingular : blueprint.offeringLabelSingular;
            }
        }

        // 3. Generate dynamic master document and update database via centralized lifecycle
        const finalFileName = await this._entityService.generateAndSaveMasterDocument(entityId, ({ entity, folderName }) => {
            let parsedMetadata = {};
            if (typeof entity.metadata === 'string') {
                try { 
                    parsedMetadata = JSON.parse(entity.metadata); 
                } catch (parseError) {
                    /**
                     * @socexplanation
                     * Avoids empty block warning and enforces the strict logging policy.
                     * We use logSystemFault to ensure metadata corruption is captured in the 
                     * persistent audit trail, rather than failing silently. The process degrades 
                     * gracefully by leaving parsedMetadata as an empty object.
                     */
                    this._logService.logSystemFault({
                        origin: 'DocumentProcessorWorkflow',
                        message: `Failed to parse metadata JSON for entity ${entity.id} during master document generation.`,
                        errorObj: parseError
                    });
                }
            } else {
                parsedMetadata = entity.metadata || {};
            }

            return MarkdownGenerator.generateEntityMaster({
                entityId: entity.id,
                entityFolderName: folderName,
                entityType: entity.entityType,
                blueprintLabel,
                metadata: parsedMetadata,
                verbatimContent,
                criteriaFolderNames,
                associatedFiles
            });
        });

        // 4. Register document record
        this._entityService.registerDocumentRecord({
            entityId,
            docType: DOCUMENT_TYPES.MASTER_DOCUMENT,
            fileName: finalFileName
        });

        this._entityService.logActivity(entityId, {
            logType: LOG_LEVELS.INFO,
            message: `Entity workspace finalized. Moved to vault: ${finalFolderPath}`
        });

        // 5. Generate/Update Criteria Vaults with the finalized Entity paths
        await this._criteriaManagerWorkflow.generateCriterionVaults(entityId);

        return entityId;
    }
}

module.exports = DocumentProcessorWorkflow;