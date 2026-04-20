/**
 * @module TaskRegistry
 * @description Wiring function to register task handlers with QueueService.
 *
 * @responsibility
 * - Acts as a Composition Root extension to wire domain workflows to infrastructure.
 * - Registers task handlers with QueueService's handler map.
 * - Eliminates circular dependencies between QueueService and domain workflows.
 *
 * @pattern_explanation
 * This module exports a single function `registerAllTasks` that is called during
 * the DI container bootstrap phase. It receives all domain workflow dependencies
 * and registers their handlers with the QueueService instance.
 *
 * This breaks the circular dependency chain:
 * - QueueService -> TaskRegistry (old pattern with class) -> Domain Workflows -> QueueService
 * Instead, we now use:
 * - QueueService (exposes registerTaskHandler method)
 * - registerAllTasks (wiring function called by container.js)
 * - Domain Workflows (no dependency on QueueService)
 *
 * @boundary_rules
 * - ❌ MUST NOT import QueueService directly (would cause circular dependency).
 * - ❌ MUST NOT contain business logic or handler implementations.
 * - ❌ MUST NOT handle HTTP request/response objects.
 * - ❌ MUST NOT emit domain events (handled by domain workflows).
 * - ✅ MUST accept all domain workflow dependencies via function parameters.
 * - ✅ MUST call queueService.registerTaskHandler() for each task type.
 * - ✅ MUST be called during DI container bootstrap (after workflow instantiation).
 *
 * @socexplanation
 * - The Registration pattern decouples task handler definition from infrastructure.
 * - Handlers are registered at startup rather than imported at module load time.
 * - This allows domain workflows to exist without depending on QueueService.
 * - The DI container orchestrates the wiring in the correct order.
 *
 * @dependency_injection
 * This module is NOT a class and does NOT use Constructor Injection.
 * Instead, it uses parameter injection via the registerAllTasks function.
 * This is intentional to avoid circular dependency issues.
 */

const { QUEUE_TASKS } = require('../config/constants');

/**
 * Registers all task handlers with the QueueService instance.
 * This function should be called during the DI container bootstrap phase,
 * after all domain workflow instances have been created.
 *
 * @param {Object} deps - Dependencies object containing all registered services
 * @param {Object} deps.queueService - The QueueService instance
 * @param {Object} deps.entityService - The EntityService instance
 * @param {Object} deps.matchService - The MatchService instance
 * @param {Object} deps.docProcessor - The DocumentProcessorWorkflow instance
 * @param {Object} deps.matchAssessment - The MatchAssessmentWorkflow instance
 * @param {Object} deps.criteriaManagerWorkflow - The CriteriaManagerWorkflow instance
 * @param {Object} deps.fileService - The FileService instance
 *
 * @socexplanation
 * - This function acts as a "wiring script" to connect domain workflows to infrastructure.
 * - It is called once during bootstrap, not on every task execution.
 * - Each task type gets its handler, onError hook, successMessage, and friendlyName registered.
 */
function registerAllTasks({ queueService, entityService, matchService, docProcessor, matchAssessment, criteriaManagerWorkflow, fileService }) {
    /**
     * Task: PROCESS_DOCUMENT
     * Master Orchestrator: Processes a document through the entire pipeline sequentially.
     */
    queueService.registerTaskHandler(QUEUE_TASKS.PROCESS_DOCUMENT, {
        handler: async (payload, signal) => {
            const { entityId, folderPath, fileName } = payload;
            if (!fileName) {
                throw new Error('Missing fileName in payload. Cannot process document without a target file.');
            }
            return await docProcessor.processDocument(
                { entityId, folderPath, fileName },
                signal
            );
        },
        onError: async (payload, errorMsg) => {
            if (payload.entityId) {
                entityService.updateState(payload.entityId, { status: 'failed', error: errorMsg });
            }
        },
        successMessage: 'Document processed successfully.',
        friendlyName: 'Document Processing Pipeline'
    });

    /**
     * Task: ASSESS_ENTITY_MATCH
     * Assesses the match score between two entities.
     */
    queueService.registerTaskHandler(QUEUE_TASKS.ASSESS_ENTITY_MATCH, {
        handler: async (payload, _signal) => {
            const { sourceEntityId, targetEntityId, matchId } = payload;
            if (!sourceEntityId || !targetEntityId) {
                throw new Error('Missing sourceEntityId or targetEntityId in ASSESS_ENTITY_MATCH payload');
            }
            return await matchAssessment.assessMatch(
                sourceEntityId,
                targetEntityId,
                matchId || null
            );
        },
        onError: async (payload, errorMsg) => {
            if (payload.matchId) {
                matchService.updateState(payload.matchId, { status: 'failed', error: errorMsg });
            }
        },
        successMessage: 'Match assessment completed successfully.',
        friendlyName: 'Match Assessment'
    });

    /**
     * Task: EXTRACT_ENTITY_CRITERIA
     * Atomized Step 4: Extracts criteria from an entity's document files.
     */
    queueService.registerTaskHandler(QUEUE_TASKS.EXTRACT_ENTITY_CRITERIA, {
        handler: async (payload, _signal) => {
            const { entityId, fileName, isNewUpload } = payload;
            if (!entityId) {
                throw new Error('Missing entityId in EXTRACT_ENTITY_CRITERIA payload');
            }

            if (fileName) {
                return await criteriaManagerWorkflow.extractEntityCriteria(
                    { entityId, fileName, isNewUpload },
                    _signal
                );
            }

            const entity = entityService.getEntityById(entityId);

            if (entity && entity.folderPath) {
                const entityFiles = fileService.listFilesInFolder(entity.folderPath);
                const markdownFiles = entityFiles.filter(f => f.match(/\.md$/i));
                const pdfFiles = entityFiles.filter(f => f.match(/\.pdf$/i));
                const allMatchingFiles = [...markdownFiles, ...pdfFiles];
                const targetFile = allMatchingFiles.length > 0 ? allMatchingFiles[0] : null;
                if (targetFile) {
                    return await criteriaManagerWorkflow.extractEntityCriteria(
                        { entityId, fileName: targetFile, isNewUpload },
                        _signal
                    );
                }
            }

            return null;
        },
        onError: async (payload, errorMsg) => {
            if (payload.entityId) {
                entityService.updateState(payload.entityId, { status: 'failed', error: errorMsg });
            }
        },
        successMessage: 'Criteria extracted successfully.',
        friendlyName: 'Criteria Extraction'
    });

    }

/**
 * @dependency_injection
 * TaskRegistry exports a single function rather than a class.
 * This enables the DI container to wire handlers during bootstrap without causing circular imports.
 */
module.exports = { registerAllTasks };