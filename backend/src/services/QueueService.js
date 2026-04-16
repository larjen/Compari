
/**
 * @module QueueService
 * @description Domain Service orchestration for asynchronous background task processing.
 * @responsibility
 * - Manages the lifecycle of background jobs (enqueue, claim, process, complete, fail).
 * - Emits events (`task:*`) for listeners to execute the actual work.
 * - Handles top-level error catching and timeout detection for background operations.
 * - Emits `task:failed` events for domain listeners to update domain entities on failure.
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (Actors).
 * - ✅ MAY call other Domain Services to coordinate workflows.
 * - ✅ MAY emit events for domain listeners to handle domain-specific updates.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT directly call domain services (JobListingService, MatchService) - this preserves SoC.
 * @socexplanation
 * Domain entity updates (e.g., marking JobListing/Match as errored) on task failure are delegated
 * to event listeners in TaskListeners.js. This keeps the queue infrastructure agnostic of business
 * domains - it only handles task status, while domain-specific updates are handled by listeners.
 * 
 * @separation_of_concerns
 * - Standard info/success events: Use logTerminal() for developer feedback.
 * - Failures/errors: Use logTerminal() with 'ERROR' + logErrorFile() for permanent audit.
 * - Use logSystemFile() for milestones that need historical tracking (non-production only).
 */

const queueRepo = require('../repositories/QueueRepo');
const logService = require('./LogService');
const eventService = require('./EventService');
const { withStaggeredRetry } = require('../utils/retryHelper');
const { APP_EVENTS, LOG_LEVELS: { INFO, WARN, ERROR }, LOG_SYMBOLS, QUEUE_STATUSES } = require('../config/constants');


class QueueService {
    constructor() {
        this.isProcessing = false;
        this.currentAbortController = null;
    }

    isWorkerRunning() {
        return this.isProcessing;
    }

    /**
     * Retrieves the current queue status.
     * @returns {Object} Queue status containing:
     *   - worker_active: Boolean indicating if a worker is currently processing.
     *   - processing: Object with details of the currently processing task (or null).
     *   - pending: Array of pending tasks.
     * @description
     * - Gathers state from the queue repository.
     * - Calculates the duration of the current processing task.
     * - Formats the data for consumers (Domain Services, Controllers, SSE).
     */
    getQueueStatus() {
        const workerActive = this.isWorkerRunning();
        const processingTask = queueRepo.getProcessingTask();
        const pendingTasks = queueRepo.getPendingTasks();

        let processing = null;
        if (processingTask) {
            const startedAt = new Date(processingTask.started_at);
            const now = new Date();
            const durationSeconds = Math.floor((now - startedAt) / 1000);

            processing = {
                id: processingTask.id,
                task_type: processingTask.task_type,
                payload: JSON.parse(processingTask.payload),
                started_at: processingTask.started_at,
                duration_seconds: durationSeconds
            };
        }

        const pending = pendingTasks.map(task => ({
            id: task.id,
            task_type: task.task_type,
            payload: JSON.parse(task.payload),
            created_at: task.created_at
        }));

        return {
            worker_active: workerActive,
            processing,
            pending
        };
    }

    /**
     * Enqueues a new task to the background processing queue.
     * @param {string} taskType - The type/category of the task (e.g., 'generate-pdf').
     * @param {Object} payload - The task payload data to be processed.
     * @returns {number} The ID of the newly created task.
     * @description
     * - Saves the task to the database via the repository.
     * - Triggers queue processing to handle the new task immediately.
     * - Emits a `queueUpdate` event so connected clients can update their UI reactively.
     */
    enqueue(taskType, payload) {
        const taskId = queueRepo.enqueue(taskType, payload);
        logService.logTerminal(INFO, LOG_SYMBOLS.CHECKMARK, 'QueueService.js', `Task #${taskId} (${taskType}) added to queue.`);
        logService.logSystemFile('QueueService.js', `Task #${taskId} (${taskType}) added to queue.`);

        this.processNext();

        // Emit domain event for SSE listeners - provides raw queue state without HTTP formatting.
        // This allows the frontend to receive real-time updates without polling.
        eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());

        return taskId;
    }

    start() {
        const clearedCount = queueRepo.wipeQueue();
        if (clearedCount > 0) {
            logService.logTerminal(WARN, LOG_SYMBOLS.WARNING, 'QueueService.js', `Wiped ${clearedCount} old task(s) and reset statuses on startup.`);
            logService.logSystemFile('QueueService.js', `Wiped ${clearedCount} old task(s) and reset statuses on startup.`);
        }

        logService.logTerminal(INFO, LOG_SYMBOLS.CHECKMARK, 'QueueService.js', `Background worker started. Listening for tasks...`);
        // Store reference to the interval
        this.workerInterval = setInterval(() => this.processNext(), 3000);
        this.processNext();
    }

    /**
     * Stops the background worker interval.
     * Required for clean shutdowns and to prevent open handles in Jest tests.
     */
    stop() {
        if (this.workerInterval) {
            clearInterval(this.workerInterval);
            this.workerInterval = null;
            logService.logTerminal(INFO, LOG_SYMBOLS.NONE, 'QueueService.js', 'Background worker stopped.');
        }
    }

    /**
     * Processes the next available task in the queue.
     * @description
     * - Checks for timed-out tasks and marks them as failed.
     * - Claims the next pending task if the worker is idle.
     * - Emits a `task:*` event for listeners to handle the actual work.
     * - Emits `queueUpdate` events when processing begins so clients see the active task.
     */
    async processNext() {
        if (this.isProcessing) return;

        const timeoutMs = 30 * 60 * 1000;
        
        const processingTask = queueRepo.getProcessingTask();
        if (processingTask && processingTask.started_at) {
            const startedAt = new Date(processingTask.started_at);
            const now = new Date();
            if (now - startedAt > timeoutMs) {
                const payload = JSON.parse(processingTask.payload);
                this.markFailed(processingTask.id, "Processing timed out after 30 minutes", null, payload);
                return;
            }
        }

        const task = queueRepo.claimNextTask();
        if (!task) return;

        this.isProcessing = true;
        this.currentAbortController = new AbortController();
        
        logService.logTerminal(INFO, LOG_SYMBOLS.NONE, 'QueueService.js', `Starting Task #${task.id}: ${task.task_type}`);

        // Emit queueUpdate when task starts processing - this is a critical state change
        // that the frontend needs to know about to show progress indicators.
        eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());

        try {
            const payload = JSON.parse(task.payload);
            const taskId = task.id;
            
            await withStaggeredRetry(
                async () => {
                    eventService.emit(`task:${task.task_type}`, { task, payload, signal: this.currentAbortController.signal });
                    
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const checkResult = queueRepo.getCurrentTaskById(taskId);
                    if (checkResult && checkResult.status === QUEUE_STATUSES.FAILED) {
                        throw new Error(checkResult.error || 'Task failed during processing');
                    }
                },
                [5000, 10000, 30000],
                `Queue Task ${taskId}`
            );
        } catch (error) {
            const failureMessage = error.isConnectionError
                ? 'Connection error.'
                : error.message;

            logService.logTerminal(ERROR, LOG_SYMBOLS.ERROR, 'AiService.js', `Error during AI generation: ${failureMessage}`);
            logService.logErrorFile('QueueService.js', `Task #${task.id} failed`, error);
            this.markFailed(task.id, failureMessage || "Invalid task payload", error);
        }
    }

    /**
     * Marks a task as completed successfully.
     * @param {number} taskId - The ID of the task to mark as completed.
     * @description
     * - Updates the task status in the repository.
     * - Logs the completion.
     * - Resets processing flag and triggers the next task.
     * - Emits a `queueUpdate` event to notify connected clients of the status change.
     * @notes setImmediate is used to prevent stack overflows during unit testing where
     *        AI/File mocks might return synchronously, causing recursive calls to exceed
     *        the call stack limit.
     */
    markCompleted(taskId) {
        queueRepo.markCompleted(taskId);
        logService.logTerminal(INFO, LOG_SYMBOLS.CHECKMARK, 'QueueService.js', `Task #${taskId} completed successfully.`);
        logService.logSystemFile('QueueService.js', `Task #${taskId} completed successfully.`);
        this.isProcessing = false;
        // Break the synchronous recursion loop
        setImmediate(() => this.processNext());

        // Emit domain event - allows frontend to reactively update when a task completes
        // without needing to poll for the new queue state.
        eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());
    }

    /**
     * Marks a task as failed with an error message.
     * @param {number} taskId - The ID of the task to mark as failed.
     * @param {string} errorMsg - The error message describing why the task failed.
     * @param {Object|Error|null} verboseDetails - Optional detailed information for development mode logging.
     * @param {Object|null} payload - Optional task payload for event emission.
     * @description
     * - Updates the task status in the repository.
     * - Adds a system error log entry.
     * - Emits a `task:failed` event with the task ID, error message, and payload so that
     *   domain-specific listeners (in TaskListeners.js) can update domain entities (e.g., JobListing,
     *   Match) with error state. This preserves SoC by keeping the queue infrastructure agnostic
     *   of business domains - it only handles task status, while domain updates are delegated to
     *   event listeners.
     * - Resets processing flag and triggers the next task.
     * - Emits a `queueUpdate` event so clients can reflect the failure state.
     * @notes setImmediate is used to prevent stack overflows during unit testing where
     *        AI/File mocks might return synchronously, causing recursive calls to exceed
     *        the call stack limit.
     */
    markFailed(taskId, errorMsg, verboseDetails = null, payload = null) {
        queueRepo.markFailed(taskId, errorMsg);
        logService.logTerminal(ERROR, LOG_SYMBOLS.ERROR, 'QueueService.js', `Task #${taskId} failed: ${errorMsg}`);
        logService.logErrorFile('QueueService.js', `Task #${taskId} failed: ${errorMsg}`, verboseDetails, payload);

        if (payload) {
            eventService.emit(APP_EVENTS.TASK_FAILED, { taskId, errorMsg, payload });
        }

        this.isProcessing = false;
        // Break the synchronous recursion loop
        setImmediate(() => this.processNext());

        // Emit domain event - enables frontend to reactively display failure status
        // immediately when a task fails, rather than waiting for the next poll.
        eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());
    }

    /**
     * Private helper to abort the current processing task if its payload matches the target ID.
     * @param {string} payloadKey - The key in the payload object to check (e.g., 'entityId').
     * @param {number} targetId - The target ID to match against the payload value.
     * @description
     * - Fetches the current processing task from the repository.
     * - Parses the task payload JSON.
     * - Checks if the payload's specified key matches the target ID.
     * - If matched, aborts the current AbortController to cancel the in-flight task.
     * @private
     */
    _abortIfProcessingMatches(payloadKey, targetId) {
        const currentTask = queueRepo.getProcessingTask();
        if (currentTask && this.currentAbortController) {
            try {
                const payload = JSON.parse(currentTask.payload);
                if (payload[payloadKey] === targetId) {
                    this.currentAbortController.abort();
                }
            } catch (_e) { /* ignored intentionally */ }
        }
    }


    /**
     * Cancels all tasks for a specific entity.
     * @param {number} entityId - The entity ID whose tasks should be cancelled.
     * @description
     * - Uses _abortIfProcessingMatches to abort any in-flight task for this entity.
     * - Deletes pending and processing tasks from the repository.
     * - Emits a queueUpdate event so SSE clients update instantly.
     */
    cancelEntityExtractionTasks(entityId) {
        this._abortIfProcessingMatches('entityId', entityId);

        const deletedCount = queueRepo.deleteEntityExtractionTasks(entityId);
        logService.logTerminal(INFO, LOG_SYMBOLS.NONE, 'QueueService.js', `Cancelled ${deletedCount} background task(s) for entity #${entityId}.`);
        eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());
    }

    /**
     * Sweeps the database on server boot for tasks left in the PROCESSING state due to a server restart.
     * Marks them as FAILED so the frontend accurately reflects the failure reason.
     */
    async sweepOrphanedTasks() {
        logService.logTerminal(INFO, LOG_SYMBOLS.CHECKMARK, 'QueueService.js', 'Sweeping for orphaned processing tasks due to server restart...');
        try {
            const staleTasks = queueRepo.getStaleProcessingTasks();
            
            if (staleTasks.length === 0) {
                logService.logTerminal(INFO, LOG_SYMBOLS.CHECKMARK, 'QueueService.js', 'No orphaned tasks found.');
                return;
            }

            for (const task of staleTasks) {
                const failureMessage = 'Task failed due to unexpected backend server restart.';
                logService.logTerminal(ERROR, LOG_SYMBOLS.ERROR, 'QueueService.js', `Failing orphaned task ${task.id}: ${failureMessage}`);
                
                queueRepo.markFailed(task.id, failureMessage);
                
                eventService.emit(APP_EVENTS.QUEUE_UPDATE, { 
                    id: task.id, 
                    status: QUEUE_STATUSES.FAILED,
                    error: failureMessage 
                });
            }
        } catch (error) {
            logService.logTerminal(ERROR, LOG_SYMBOLS.ERROR, 'QueueService.js', `Failed to execute orphaned task sweep: ${error.message}`, error);
            logService.logErrorFile('QueueService.js', 'Failed to execute orphaned task sweep', error);
        }
    }
}

module.exports = new QueueService();
