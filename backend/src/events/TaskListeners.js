// src/events/TaskListeners.js
/**
 * @fileoverview Event-driven task listener registry for background job processing.
 * @description Registers handlers for atomized pipeline tasks (PARSE_DOCUMENT_CONTENT, EXTRACT_VERBATIM_TEXT, EXTRACT_ENTITY_CRITERIA, etc.) and match assessment.
 *
 * @responsibility
 * - Listens for task events from the queue service
 * - Delegates to appropriate domain workflows
 * - Handles error reporting and queue completion marking
 *
 * @boundary_rules
 * - ❌ MUST NOT contain business logic (delegates to Workflows)
 * - ❌ MUST NOT handle HTTP requests/responses
 * - ✅ Uses QUEUE_TASKS and QUEUE_STATUSES constants for strong contracts
 *
 * @separation_of_concerns
 * - Task start/completion: Use logTerminal() for feedback. Use logSystemFile() for milestones.
 * - Task failures/errors: Use logTerminal() with 'ERROR' + logErrorFile() for audit.
 *
 * @dependency_injection
 * This module exports a factory function that uses Parameter Injection.
 * All dependencies are explicitly passed as parameters to enable testability
 * and eliminate the Service Locator anti-pattern.
 * Reasoning: Parameter Injection ensures explicit dependencies and enables isolated unit testing.
 *
 * @socexplanation
 * - Task start/completion: Use logTerminal() for feedback. Use logSystemFile() for milestones.
 * - Task failures/errors: Use logTerminal() with 'ERROR' + logErrorFile() for audit.
 */

const { ENTITY_STATUS, APP_EVENTS, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

module.exports = function setupTaskListeners({
    eventService,
    logService,
    entityService,
    matchService
}) {

function registerTaskListeners() {

    // Listen for task failure events - delegates domain entity updates to EntityService
    // This preserves SoC by keeping QueueService agnostic of business domains
    eventService.on(APP_EVENTS.TASK_FAILED, ({ taskId, errorMsg, payload }) => {
        try {
            if (payload.entityId) {
                entityService.updateState(payload.entityId, { status: ENTITY_STATUS.FAILED, error: errorMsg });
            }
            if (payload.matchId) {
                matchService.updateState(payload.matchId, { status: ENTITY_STATUS.FAILED, error: errorMsg });
            }
        } catch (error) {
            logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'TaskListeners', message: `Failed to update domain entities on task ${taskId} failure: ${error.message}`, errorObj: error });
            logService.logErrorFile({ origin: 'TaskListeners', message: `Failed to update domain entities on task ${taskId} failure: ${error.message}`, errorObj: error });
        }
    });
}

return {
    registerTaskListeners
};

};