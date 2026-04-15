// src/events/TaskListeners.js
/**
 * @fileoverview Event-driven task listener registry for background job processing.
 * @description Registers handlers for queued tasks (document processing, criteria extraction, match assessment).
 * 
 * @responsibility
 * - Listens for task events from the queue service
 * - Delegates to appropriate domain workflows
 * - Handles error reporting and queue completion marking
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business logic (delegates to Workflows)
 * - ❌ MUST NOT handle HTTP requests/responses
 * - ✅ Uses withTaskHandling wrapper for standardized error handling
 * - ✅ Uses QUEUE_TASKS and QUEUE_STATUSES constants for strong contracts
 * 
 * @separation_of_concerns
 * - Task start/completion: Use logTerminal() for feedback. Use logSystemFile() for milestones.
 * - Task failures/errors: Use logTerminal() with 'ERROR' + logErrorFile() for audit.
 */

const eventService = require('../services/EventService');
const logService = require('../services/LogService');
const documentProcessorWorkflow = require('../workflows/DocumentProcessorWorkflow');
const matchAssessmentWorkflow = require('../workflows/MatchAssessmentWorkflow');
const criteriaManagerWorkflow = require('../workflows/CriteriaManagerWorkflow');
const queueService = require('../services/QueueService');
const entityService = require('../services/EntityService');
const matchService = require('../services/MatchService');
const { QUEUE_TASKS, ENTITY_STATUS } = require('../config/constants');

/**
 * Wrapper function that enforces Separation of Concerns by decoupling infrastructure
 * error handling from domain task logic.
 * 
 * @description
 * This wrapper handles the following infrastructure concerns uniformly across all tasks:
 * - try/catch block for synchronous error catching
 * - AbortError detection for cancelled tasks
 * - logService logging for task start/completion/failure
 * - queueService.markCompleted/markFailed calls
 * - Error notification emission
 * 
 * @param {string} taskName - Human-readable name for logging (e.g., 'PROCESS_DOCUMENT')
 * @param {Function} handlerFn - Async handler function receiving {task, payload, signal}
 * @returns {Function} Wrapped handler function
 * 
 * @architectural_notes
 * - Ensures all tasks have consistent error handling behavior
 * - Prevents domain logic from duplicating infrastructure concerns
 * - Allows domain handlers to focus purely on business logic
 * 
 * @example
 * // Before: Each task had duplicate try/catch/error handling
 * eventService.on('task:PROCESS_DOCUMENT', async ({task, payload, signal}) => {
 *   try {
 *     // domain logic
 *   } catch (error) {
 *     // duplicate error handling
 *   }
 * });
 * 
 * // After: Domain handler only contains business logic
 * eventService.on('task:PROCESS_DOCUMENT', withTaskHandling('PROCESS_DOCUMENT', async ({task, payload, signal}) => {
 *   // domain logic only
 * }));
 */
function withTaskHandling(taskName, handlerFn) {
    return async ({ task, payload, signal }) => {
        try {
            logService.logTerminal('INFO', 'LIGHTNING', 'TaskListeners', `Starting ${taskName} for task ${task.id}`);
            logService.logSystemFile('TaskListeners', `Starting ${taskName} for task ${task.id}`);
            await handlerFn({ task, payload, signal });
            queueService.markCompleted(task.id);
            logService.logTerminal('INFO', 'CHECKMARK', 'TaskListeners', `Completed ${taskName} for task ${task.id}`);
            logService.logSystemFile('TaskListeners', `Completed ${taskName} for task ${task.id}`);
        } catch (error) {
            // Handle task cancellation gracefully
            if (error.name === 'AbortError' || error.message === 'Task cancelled') {
                logService.logTerminal('INFO', 'NONE', 'TaskListeners', `Task ${task.id} was aborted by user.`);
                queueService.markFailed(task.id, 'Task cancelled by user');
                return;
            }
            
            // Log the error and mark as failed (Verbose logs for backend)
            logService.logTerminal('ERROR', 'ERROR', 'TaskListeners', `${taskName} failed: ${error.message}`);
            logService.logErrorFile('TaskListeners', `${taskName} failed: ${error.message}`, error, payload);
            
            // Format a user-friendly error message for the UI Toast
            let uiMessage = `${taskName.replace(/_/g, ' ')} failed: ${error.message}`;
            
            // Intercept known AI offline signatures that got wrapped by workflows
            const isOffline = error.message.includes('AI is offline') || 
                              error.message.includes('ECONNREFUSED') || 
                              error.message.includes('fetch failed');
                              
            if (isOffline) {
                uiMessage = 'AI agent is offline. Please check your connection or start the local model.';
            } else if (error.isAiError || error.isOllamaError) {
                uiMessage = error.message;
            } else {
                // If it's a standard error, at least clean up the raw internal TASK_NAME
                // e.g. "PROCESS_ENTITY_DOCUMENT" -> "Process Entity Document"
                const friendlyTaskName = taskName.split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                uiMessage = `${friendlyTaskName} failed. Check logs for details.`;
            }

            // Emit clean notification for UI
            eventService.emit('notification', { type: 'error', message: uiMessage });
            
            queueService.markFailed(task.id, error.message, error, payload);
        }
    };
}

function registerTaskListeners() {

    // Listen for Entity Document Processing tasks
    eventService.on(`task:${QUEUE_TASKS.PROCESS_ENTITY_DOCUMENT}`, withTaskHandling(QUEUE_TASKS.PROCESS_ENTITY_DOCUMENT, async ({ _task, payload, signal }) => {
        const { entityId, folderPath, fileName } = payload;
        
        if (!fileName) {
            throw new Error('Missing fileName in payload. Cannot process document without a target file.');
        }

        if (entityId) {
            // Must use ENTITY_STATUS (lowercase) for entities to maintain
            // compatibility with the frontend state machine expectations.
            entityService.updateEntityStatus(entityId, ENTITY_STATUS.PROCESSING);
            entityService.updateEntityMetadata(entityId, { processingStartedAt: new Date().toISOString() });
        }
        
        await documentProcessorWorkflow.extractAndStoreEntityFromDocument(entityId, folderPath, fileName, signal);
        
        eventService.emit('notification', { type: 'success', message: 'Document processed successfully.' });
    }));

    // Listen for AI Assessment tasks
    eventService.on(`task:${QUEUE_TASKS.ASSESS_ENTITY_MATCH}`, withTaskHandling(QUEUE_TASKS.ASSESS_ENTITY_MATCH, async ({ _task, payload, _signal }) => {
        const { sourceEntityId, targetEntityId, matchId } = payload;
        if (!sourceEntityId || !targetEntityId) {
            throw new Error('Missing sourceEntityId or targetEntityId in ASSESS_ENTITY_MATCH payload');
        }
        await matchAssessmentWorkflow.assessMatch(sourceEntityId, targetEntityId, matchId || null);
        
        eventService.emit('notification', { type: 'success', message: 'Match assessment completed successfully.' });
    }));

    // Listen for Entity Criteria Extraction tasks
    eventService.on(`task:${QUEUE_TASKS.EXTRACT_ENTITY_CRITERIA}`, withTaskHandling(QUEUE_TASKS.EXTRACT_ENTITY_CRITERIA, async ({ _task, payload, signal }) => {
        const { entityId, fileName } = payload;
        if (!entityId) {
            throw new Error('Missing entityId in EXTRACT_ENTITY_CRITERIA payload');
        }

        // If fileName is provided, extract from specific file; otherwise use unified extraction
        if (fileName) {
            await criteriaManagerWorkflow.extractEntityCriteriaFromFile(entityId, fileName, signal);
        } else {
            // Get entity and find appropriate file to extract from
            const entity = entityService.getEntityById(entityId);
            if (entity && entity.folderPath) {
                const FileService = require('../services/FileService');
                const entityFiles = FileService.listFilesInFolder(entity.folderPath);
                const markdownFiles = entityFiles.filter(f => f.match(/\.md$/i));
                const pdfFiles = entityFiles.filter(f => f.match(/\.pdf$/i));
                const allMatchingFiles = [...markdownFiles, ...pdfFiles];
                const targetFile = allMatchingFiles.length > 0 ? allMatchingFiles[0] : null;
                if (targetFile) {
                    await criteriaManagerWorkflow.extractEntityCriteriaFromFile(entityId, targetFile, signal);
                }
            }
        }
        
        const fileMsg = fileName ? `from file: ${fileName}` : 'from entity documents';
        eventService.emit('notification', { type: 'success', message: `Successfully extracted criteria ${fileMsg}.` });
    }));

    // Listen for task failure events - delegates domain entity updates to EntityService
    // This preserves SoC by keeping QueueService agnostic of business domains
    eventService.on('task:failed', ({ taskId, errorMsg, payload }) => {
        try {
            if (payload.entityId) {
                entityService.updateEntityStatus(payload.entityId, ENTITY_STATUS.FAILED);
                entityService.updateEntityError(payload.entityId, errorMsg);
            }
            if (payload.matchId) {
                matchService.updateMatchError(payload.matchId, errorMsg);
                matchService.updateMatchStatus(payload.matchId, ENTITY_STATUS.FAILED);
            }
        } catch (error) {
            logService.logTerminal('ERROR', 'ERROR', 'TaskListeners', `Failed to update domain entities on task ${taskId} failure: ${error.message}`, error);
            logService.logErrorFile('TaskListeners', `Failed to update domain entities on task ${taskId} failure: ${error.message}`, error);
        }
    });
}

module.exports = registerTaskListeners;
