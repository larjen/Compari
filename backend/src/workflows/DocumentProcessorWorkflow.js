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
 */
const FileService = require('../services/FileService');
const eventService = require('../services/EventService');
const entityService = require('../services/EntityService');
const logService = require('../services/LogService');
const queueService = require('../services/QueueService');
const MarkdownGenerator = require('../utils/MarkdownGenerator');
const PromptBuilder = require('../utils/PromptBuilder');
const DynamicSchemaBuilder = require('../utils/DynamicSchemaBuilder');
const MetadataMapper = require('../utils/MetadataMapper');
const NameGenerator = require('../utils/NameGenerator');
const AiService = require('../services/AiService');
const criteriaManagerWorkflow = require('./CriteriaManagerWorkflow');
const blueprintRepo = require('../repositories/BlueprintRepo');
const entityRepo = require('../repositories/EntityRepo');
const { DOCUMENT_TYPES, QUEUE_TASKS, ENTITY_STATUS } = require('../config/constants');
const path = require('path');

class DocumentProcessorWorkflow {

    /**
     * Initiates the document upload process by creating a temporary processing folder,
     * moving the uploaded file to it, and queuing the document for AI processing.
     * 
     * @async
     * @method initiateDocumentUpload
     * @memberof DocumentProcessorWorkflow
     * @param {Object} file - The uploaded file object from multer middleware.
     * @param {string} file.filename - The original filename of the uploaded document.
     * @param {string} file.path - The temporary path where multer stored the file.
     * @returns {Promise<number>} The ID of the newly created entity record.
     * 
     * @workflow_steps
     * 1. Generates a unique temp folder name using timestamp.
     * 2. Creates an entity record with "Processing Document..." status in metadata.
     *    - status is set to ENTITY_STATUS.PENDING
     * 3. Creates the temporary folder in the data directory.
     * 4. Moves the uploaded file from temp location to the processing folder.
     * 5. Enqueues a PROCESS_ENTITY_DOCUMENT task for async AI processing.
     * 6. Logs the upload event.
     * 
     * @boundary_rules
     * - ✅ Creates entity record in EntityService for tracking.
     * - ✅ Queues async work via QueueService (does NOT block on AI processing).
     * - ❌ Does NOT perform AI extraction directly - that happens asynchronously via TaskListeners.
     * 
     * @constant
     * - Uses ENTITY_STATUS.PENDING for status column initialization
     * 
       * @socexplanation
       * Accepts entityType to correctly route files to OFFERINGS_DIR (offerings) or REQUIREMENTS_DIR (requirements).
       * Prevents requirement documents from polluting the offering pool.
      */
    async initiateDocumentUpload(file, entityType = 'offering') {
        // 1. Validate AI health BEFORE creating any DB records or moving files
        try {
            await AiService.isHealthy();
        } catch (error) {
            throw new Error('AI agent is not running, please start it.');
        }

        // 2. Proceed with normal file setup and database creation
        const fileName = file.filename;
        
        const tempFolderName = `processing-${Date.now()}`;
        
        // Dynamically route based on entity type
        const { REQUIREMENTS_DIR, OFFERINGS_DIR } = require('../config/constants');
        const baseDir = entityType === 'requirement' ? REQUIREMENTS_DIR : OFFERINGS_DIR;
        const tempFolderPath = path.join(baseDir, tempFolderName);
        
        const metadata = {
            dateAdded: new Date().toISOString(),
            processingFileName: fileName,
            title: 'Processing Document...',
            organization: 'Please wait...'
        };
        
        const entityId = entityService.createEntity(entityType, 'Processing Document...', 'Please wait...', tempFolderPath, metadata);
        
        entityService.updateEntityStatus(entityId, ENTITY_STATUS.PENDING);
        
        FileService.createDirectory(tempFolderPath);
        
        const filePath = file.path;
        FileService.moveFile(filePath, tempFolderPath, fileName);

        queueService.enqueue(QUEUE_TASKS.PROCESS_ENTITY_DOCUMENT, { 
            entityId, 
            folderPath: tempFolderPath, 
            fileName 
        });

        logService.addActivityLog('Entity', entityId, 'INFO', `Document uploaded: ${fileName}. Queued for AI processing.`, tempFolderPath);

        return entityId;
    }

    /**
     * Extracts entity details from a PDF document using AI services and stores them.
     * This is the core async worker that processes queued documents.
     * 
     * @async
     * @method extractAndStoreEntityFromDocument
     * @memberof DocumentProcessorWorkflow
     * @param {number} entityId - The entity ID to associate extracted data with.
     * @param {string} folderPath - The temporary folder path containing the uploaded document.
     * @param {string} fileName - The name of the uploaded document file.
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<number>} The entity ID.
     * 
     * @workflow_steps
     * 1. Extracts raw text from the PDF file using FileService.
     * 2. Uses AI to extract structured fields concurrently (chunked per field) alongside markdown profile formatting.
     *    - Each blueprint field triggers an individual AI request for maximum extraction accuracy.
     *    - Fault isolation: if one field fails, fallback to safe defaults without stopping the workflow.
     * 3. Uses AI to generate verbatim document text (markdown format).
       * 4. Generates a markdown profile file.
       * 5. Moves the folder from temp location to final named location using FileService.
       * 6. Updates the entity record with extracted details via EntityService.
       * 7. Registers document records for the PDF and markdown files.
       * 8. Delegates criteria extraction to CriteriaManagerWorkflow.
       * 9. Updates status to ENTITY_STATUS.COMPLETED (signals completion of async processing).
       * 10. Emits a success notification event.
      * 
      * @boundary_rules
      * - ✅ Uses AiService for text extraction and structured data parsing.
      * - ✅ Uses MarkdownGenerator to create posting file.
      * - ✅ Uses FileService for file operations (read, move, save) and path generation.
      * - ❌ Does NOT directly write to database - uses EntityService for updates.
      * - ❌ Does NOT extract criteria directly - delegates to CriteriaManagerWorkflow.extractAndStoreEntityCriteria.
      * 
      * @constant
      * - Uses ENTITY_STATUS.COMPLETED to mark successful completion
      * 
       * @soc_explanation
       * - This workflow is responsible for its own status domain updates.
       * - Sets status to ENTITY_STATUS.COMPLETED upon successful completion.
      */
    async extractAndStoreEntityFromDocument(entityId, folderPath, fileName, signal) {
        // Enforce strict type validation to prevent Node.js path.join core crashes
        if (!folderPath || typeof folderPath !== 'string') {
            throw new Error(`Invalid folderPath provided for entity #${entityId}. Expected string, received ${typeof folderPath}.`);
        }
        if (!fileName || typeof fileName !== 'string') {
            throw new Error(`Invalid fileName provided for entity #${entityId}. Expected string, received ${typeof fileName}.`);
        }

        const filePath = path.join(folderPath, fileName);
        const rawText = await FileService.extractTextFromFile(filePath);

        const markdownMessages = PromptBuilder.buildMarkdownExtractionMessages(rawText);

        const entity = entityRepo.getEntityById(entityId);
        if (!entity) {
            throw new Error(`Entity #${entityId} not found.`);
        }

        const entityRole = entity.type || 'offering';
        
        let blueprintFields = [];
        let blueprintName = 'Entity';

        if (entity.blueprintId) {
            const blueprint = blueprintRepo.getBlueprintById(entity.blueprintId);
            if (blueprint) {
                blueprintName = entityRole === 'requirement' ? blueprint.requirementLabelSingular : blueprint.offeringLabelSingular;
                // Filter fields by entity role (requirement or offering)
                blueprintFields = blueprintRepo.getBlueprintFields(entity.blueprintId, entityRole);
            }
        }

        if (blueprintFields.length === 0) {
            logService.logTerminal('WARN', 'WARNING', 'DocumentProcessorWorkflow', 'No blueprint fields found for this entity role, using fallback extraction.');
        }

        entityService.updateProcessingStep(entityId, 'Extracting Profile & Metadata');

        const dynamicMetadata = {};
        const tasks = [];

        // 1. Chunked Metadata Extraction (One task per field)
        if (blueprintFields.length > 0) {
            const metadataTasks = blueprintFields.map(async (field) => {
                const singleFieldArray = [field];
                const fieldName = field.fieldName || field.field_name;
                
                try {
                    const metadataMessages = PromptBuilder.buildEntityMetadataMessages(rawText, blueprintName, singleFieldArray);
                    const metadataSchema = DynamicSchemaBuilder.buildMetadataSchema(singleFieldArray);

                    const responseString = await AiService.generateChatResponse(
                        metadataMessages,
                        { format: metadataSchema, logFolderPath: folderPath },
                        undefined, undefined, signal
                    );

                    const parsed = MetadataMapper.mapAiResponseToBlueprint(responseString, singleFieldArray);
                    
                    if (parsed[fieldName] !== undefined) {
                        dynamicMetadata[fieldName] = parsed[fieldName];
                    }
                } catch (err) {
                    // CRITICAL: Do not swallow abort signals! Re-throw immediately to halt the workflow.
                    if (err.name === 'AbortError' || err.message === 'Task cancelled') {
                        throw err;
                    }
                    
                    logService.logTerminal('ERROR', 'ERROR', 'DocumentProcessorWorkflow', `Failed to extract field '${fieldName}' for Entity #${entityId}: ${err.message}`);
                    logService.logErrorFile('DocumentProcessorWorkflow', `Failed to extract field '${fieldName}' for Entity #${entityId}`, err);
                    dynamicMetadata[fieldName] = field.isRequired ? 'Unknown' : null;
                }
            });
            tasks.push(...metadataTasks);
        }

        // 2. Concurrent Verbatim Markdown Extraction
        let verbatimPosting = "";
        let criticalAiError = null;

        const verbatimTask = (async () => {
            try {
                verbatimPosting = await AiService.generateChatResponse(
                    markdownMessages,
                    { logFolderPath: folderPath },
                    undefined, undefined, signal
                );
            } catch (err) {
                // CRITICAL: Do not swallow abort signals! Re-throw immediately to halt the workflow.
                if (err.name === 'AbortError' || err.message === 'Task cancelled') {
                    throw err;
                }

                logService.logTerminal('ERROR', 'ERROR', 'DocumentProcessorWorkflow', `Failed to extract verbatim profile for Entity #${entityId}: ${err.message}`);
                logService.logErrorFile('DocumentProcessorWorkflow', `Failed to extract verbatim profile for Entity #${entityId}`, err);
                verbatimPosting = "Failed to extract profile content.";
                criticalAiError = err;
            }
        })();
        tasks.push(verbatimTask);

        // Execute all chunked metadata requests and markdown formatting concurrently
        await Promise.all(tasks);

        // Use entity's existing name and description for fallback
        const entityTitle = entity.name || 'Unknown Title';
        const entityDescription = entity.description || 'Unknown Organization';
        const entityRoleForPath = entity.type || 'offering';

        const extractedDetails = {
            rawText,
            verbatimPosting,
            ...dynamicMetadata
        };

        const mdContent = MarkdownGenerator.generateEntityProfile(entityTitle, entityDescription, extractedDetails);
        
        // BUGFIX: Pass entityRole instead of entityTitle as the first argument
        const finalFolderPath = FileService.generateEntityFolderPath(entityRoleForPath, entityTitle);

        FileService.moveDirectory(folderPath, finalFolderPath);
        
        FileService.saveTextFile(finalFolderPath, 'entity-profile.md', mdContent);
        FileService.saveTextFile(finalFolderPath, 'raw-extraction.txt', rawText);

        const finalFilePath = path.join(finalFolderPath, fileName);

        // Update entity metadata with extracted details, preserving existing metadata
        // First assemble the raw metadata, then inject the nice_name for display
        let assembledMetadata = {
            ...(entity.metadata || {}),
            ...dynamicMetadata,
            folderPath: finalFolderPath
        };

        // Inject the nice_name into the metadata using NameGenerator utility.
        // This isolates presentation-layer string manipulation from the AI workflow.
        // Must happen BEFORE EntityRepo.createEntity or EntityService.createEntity is called.
        const finalMetadata = NameGenerator.injectNiceName(assembledMetadata, blueprintFields);

        entityService.updateEntityMetadata(entityId, finalMetadata);

        // BUGFIX: We MUST update the root folderPath column in the database, 
        // otherwise the UI "Open Folder" button will look for the deleted temporary folder.
        if (typeof entityService.updateEntityFolderPath === 'function') {
            entityService.updateEntityFolderPath(entityId, finalFolderPath);
        } else {
            logService.logTerminal('WARN', 'WARNING', 'DocumentProcessorWorkflow', 'entityService.updateEntityFolderPath is missing. Database path is stale.');
        }

        entityService.registerDocumentRecord(entityId, DOCUMENT_TYPES.ENTITY_PROFILE, fileName, finalFilePath);
        entityService.registerDocumentRecord(entityId, DOCUMENT_TYPES.EXTRACTED_DATA, 'entity-profile.md', path.join(finalFolderPath, 'entity-profile.md'));

        if (criticalAiError) {
            throw new Error('AI agent is not running, please start it.');
        }

        // Pass rawText instead of mdContent to prevent cascading data loss.
        // If the AI markdown formatter accidentally dropped a skill bullet point,
        // passing the raw PDF text ensures the criteria extractor still finds it.
        await criteriaManagerWorkflow.extractAndStoreEntityCriteria(entityId, rawText, signal);

        entityService.updateProcessingStep(entityId, null);

        if (entityId) {
            entityService.updateEntityStatus(entityId, ENTITY_STATUS.COMPLETED);
        }

        logService.addActivityLog('Entity', entityId, 'INFO', `AI successfully extracted details for ${entityTitle}.`, finalFolderPath);

        eventService.emit('notification', { type: 'success', message: `AI extracted: ${entityTitle}` });
        return entityId;
    }
}

module.exports = new DocumentProcessorWorkflow();