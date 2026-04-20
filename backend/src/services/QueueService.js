/**
 * @module QueueService
 * @description Domain Service orchestration for asynchronous background task processing.
 *
 * @responsibility
 * - Manages the lifecycle of background jobs (enqueue, claim, process, complete, fail).
 * - Executes tasks directly via registered task handlers (no event emission to listeners).
 * - Handles native retry loop with staggered delays.
 * - Handles top-level error catching and timeout detection.
 * - Emits `task:failed` events for domain listeners to update domain entities on failure.
 * - Handles orphaned entities/matches when queue is wiped on server restart.
 *
 * @concurrency_model
 * - Uses a configurable concurrency limit (default: 3) via QUEUE_CONCURRENCY env var.
 * - Tracks active workers via `this.activeWorkers` counter.
 * - Each task gets its own AbortController stored in `this.abortControllers` Map.
 * - Memory is managed by cleaning up abort controllers after task completion.
 *
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (QueueRepo, EventService, LogService).
 * - ✅ MAY call registered task handlers via dynamically populated handler map.
 * - ✅ MAY emit APP_EVENTS for frontend state sync.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT call domain services directly - this preserves SoC.
 * - ❌ MUST NOT emit "Retrying..." toast notifications (frontend relies on processing state).
 *
 * @socexplanation
 * - Retry logic is handled natively in processNext() to keep retry behavior centralized.
 * - Task execution uses a dynamically populated handler map (`this.taskHandlers`) to avoid
 *   circular dependencies with domain workflows. Handlers are registered via DI container.
 * - Success/failure notifications are emitted after the retry loop completes.
 * - Orphaned task handling uses domain services to update entity/match states.
 *
 * @separation_of_concerns
 * - Standard info/success events: Use logTerminal() for developer feedback.
 * - Failures/errors: Use logTerminal() with 'ERROR' + logErrorFile() for permanent audit.
 * - Use logSystemFile() for milestones that need historical tracking (non-production only).
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const { APP_EVENTS, LOG_LEVELS: { INFO, WARN, ERROR }, LOG_SYMBOLS, QUEUE_STATUSES, ENTITY_STATUS, SETTING_KEYS } = require('../config/constants');

const RETRY_DELAYS = [5000, 10000, 30000];
const INTERRUPTION_ERROR = 'Interrupted by server shutdown. Please retry.';

/**
 * @class QueueService
 * @description Manages asynchronous background task processing with concurrency control and retry logic.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */
class QueueService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.settingsManager - The SettingsManager instance
     * @param {Object} deps.queueRepo - The QueueRepo instance
     * @param {Object} deps.entityService - The EntityService instance
     * @param {Object} deps.matchService - The MatchService instance
     * @param {Object} deps.baseEntityRepo - The BaseEntityRepo instance
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.eventService - The EventService instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ settingsManager, queueRepo, entityService, matchService, baseEntityRepo, logService, eventService }) {
        this._settingsManager = settingsManager;
        this._queueRepo = queueRepo;
        this._entityService = entityService;
        this._matchService = matchService;
        this._baseEntityRepo = baseEntityRepo;
        this._logService = logService;
        this._eventService = eventService;
        this.activeWorkers = 0;
        this.maxConcurrency = parseInt(process.env.QUEUE_CONCURRENCY) || 3;
        this.abortControllers = new Map();
        /**
         * @member {Map<string, Object>} taskHandlers
         * @description Dynamically populated map of task type to handler configuration.
         * Registered by the DI container during composition root phase to avoid circular dependencies.
         */
        this.taskHandlers = new Map();
    }

    /**
     * Registers a task handler for a given task type.
     * This method is used by the DI container (via TaskRegistry wiring function) to attach
     * domain workflow handlers to the queue service infrastructure.
     *
     * @param {string} taskType - The task type constant (e.g., QUEUE_TASKS.PROCESS_ENTITY_DOCUMENT)
     * @param {Object} handlerConfig - The handler configuration object
     * @param {Function} handlerConfig.handler - Async function to execute for this task type
     * @param {Function} handlerConfig.onError - Optional async function to execute on task failure
     * @param {string} handlerConfig.successMessage - Success message for UI feedback
     * @param {string} handlerConfig.friendlyName - Human-readable task name for logs
     *
     * @socexplanation
     * - This method enables loose coupling between infrastructure (QueueService) and domain workflows.
     * - The DI container calls this method during bootstrap to wire handlers without causing
     *   circular imports between QueueService and domain workflow modules.
     */
    registerTaskHandler(taskType, handlerConfig) {
        this.taskHandlers.set(taskType, handlerConfig);
    }

    /**
     * Parses a SQLite timestamp string into a valid JavaScript Date object.
     * SQLite outputs UTC timestamps as `YYYY-MM-DD HH:MM:SS` (space-separated, no timezone suffix).
     * Node.js interprets such strings as local time, causing timezone mismatches.
     * This helper converts them to ISO-8601 format `YYYY-MM-DDTHH:MM:SSZ` before parsing.
     *
     * @param {string} sqliteDateStr - The raw timestamp string from SQLite
     * @returns {Date} A valid Date object interpreted as UTC
     *
     * @socexplanation
     * - This method bridges an infrastructure gap: SQLite stores timezone-less UTC strings,
     *   but Node.js Date parser assumes local time for space-separated datetime strings.
     * - Centralizing this logic in one private helper ensures DRY compliance and prevents
     *   timezone-related bugs across the service.
     */
    _parseSqliteDate(sqliteDateStr) {
        if (!sqliteDateStr) return new Date();
        if (sqliteDateStr.includes('Z')) {
            return new Date(sqliteDateStr);
        }
        const isoStr = sqliteDateStr.replace(' ', 'T') + 'Z';
        return new Date(isoStr);
    }

    /**
     * Checks if there are any active workers processing tasks.
     *
     * @returns {boolean} True if there are active workers
     */
    isWorkerRunning() {
        return this.activeWorkers > 0;
    }

    /**
     * Gets the current queue status including processing and pending tasks.
     *
     * @returns {Object} Queue status object with worker_active, processing, and pending arrays
     */
    getQueueStatus() {
        const workerActive = this.isWorkerRunning();
        const processingTasks = this._queueRepo.getProcessingTasks();
        const pendingTasks = this._queueRepo.getPendingTasks();

        const processing = processingTasks.map(task => {
            const startedAt = this._parseSqliteDate(task.started_at);
            const now = new Date();
            const durationSeconds = Math.floor((now - startedAt) / 1000);

            return {
                id: task.id,
                task_type: task.task_type,
                payload: JSON.parse(task.payload),
                started_at: task.started_at,
                duration_seconds: durationSeconds
            };
        });

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
     * Enqueues a new task for background processing.
     *
     * @param {string} taskType - The task type constant
     * @param {Object} payload - Task payload data
     * @returns {number} The enqueued task ID
     */
    enqueue(taskType, payload) {
        const taskId = this._queueRepo.enqueue(taskType, payload);
        this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'QueueService.js', message: `Task #${taskId} (${taskType}) added to queue.` });
        this._logService.logSystemFile('QueueService.js', `Task #${taskId} (${taskType}) added to queue.`);

        this.processNext();

        this._eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());

        return taskId;
    }

    /**
     * Starts the background worker to process queued tasks.
     * Clears any stale tasks from a previous server run.
     */
    start() {
        const clearedCount = this._queueRepo.wipeQueue();
        if (clearedCount > 0) {
            this._logService.logTerminal({ status: WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'QueueService.js', message: `Wiped ${clearedCount} old task(s) on startup.` });
            this._logService.logSystemFile('QueueService.js', `Wiped ${clearedCount} old task(s) on startup.`);
        }

        this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'QueueService.js', message: `Background worker started. Listening for tasks...` });
        this.workerInterval = setInterval(() => this.processNext(), 3000);
        this.processNext();
    }

    /**
     * Stops the background worker and aborts all in-progress tasks.
     */
    stop() {
        if (this.workerInterval) {
            clearInterval(this.workerInterval);
            this.workerInterval = null;
            this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.NONE, origin: 'QueueService.js', message: 'Background worker stopped.' });
        }

        for (const [, controller] of this.abortControllers) {
            controller.abort();
        }
        this.abortControllers.clear();
    }

    /**
     * Claims and processes the next available task from the queue.
     * Implements concurrency control, retry logic, and error handling.
     *
     * @async
     */
    async processNext() {
        const allowConcurrentAi = this._settingsManager.get(SETTING_KEYS.ALLOW_CONCURRENT_AI) === 'true';
        const effectiveConcurrency = allowConcurrentAi ? this.maxConcurrency : 1;

        if (this.activeWorkers >= effectiveConcurrency) return;

        const timeoutMs = 30 * 60 * 1000;

        const processingTasks = this._queueRepo.getProcessingTasks();
        for (const processingTask of processingTasks) {
            if (processingTask.started_at) {
                const startedAt = this._parseSqliteDate(processingTask.started_at);
                const now = new Date();
                if (now - startedAt > timeoutMs) {
                    const payload = JSON.parse(processingTask.payload);
                    this.markFailed(processingTask.id, { errorMsg: "Processing timed out after 30 minutes", payload });
                }
            }
        }

        const task = this._queueRepo.claimNextTask();
        if (!task) return;

        this.activeWorkers++;

        const controller = new AbortController();
        this.abortControllers.set(task.id, controller);

        this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.NONE, origin: 'QueueService.js', message: `Starting Task #${task.id}: ${task.task_type} (Active workers: ${this.activeWorkers}/${effectiveConcurrency})` });

        this._eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());

        const taskType = task.task_type;
        const taskEntry = this.taskHandlers.get(taskType);

        if (!taskEntry) {
            this._logService.logTerminal({ status: ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'QueueService.js', message: `No handler registered for task type: ${taskType}` });
            this.markFailed(task.id, { errorMsg: `Unknown task type: ${taskType}` });
            return;
        }

        const payload = JSON.parse(task.payload);
        const handler = taskEntry.handler;
        const successMessage = taskEntry.successMessage;
        const friendlyName = taskEntry.friendlyName;

        let lastError = null;
        let success = false;

        try {
            for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
                try {
                    await handler(payload, controller.signal);
                    success = true;
                    break;
                } catch (error) {
                    lastError = error;

                    if (error.name === 'AbortError' || error.message === 'Task cancelled') {
                        this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.NONE, origin: 'QueueService.js', message: `Task ${task.id} was aborted by user.` });
                        this.markFailed(task.id, { errorMsg: 'Task cancelled by user' });
                        return;
                    }

                    if (error.isFatalClientError) {
                        this._logService.logTerminal({ status: WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'QueueService.js', message: `Halting retries for Task #${task.id}: Fatal Client Error.` });
                        break;
                    }

                    if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) {
                        this._logService.logTerminal({ status: WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'QueueService.js', message: `Halting retries for Task #${task.id}: Fatal Programming Error (${error.name}).` });
                        break;
                    }

                    if (attempt === RETRY_DELAYS.length) {
                        break;
                    }

                    const delayMs = RETRY_DELAYS[attempt];
                    const delaySec = delayMs / 1000;

                    if (error.isConnectionError) {
                        this._logService.logTerminal({ status: WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'QueueService.js', message: `Task #${task.id} connection lost. Retrying in ${delaySec}s...` });
                    } else {
                        this._logService.logTerminal({ status: WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'QueueService.js', message: `${friendlyName} failed. Retrying in ${delaySec}s...` });
                    }

                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }

            if (success) {
                this.markCompleted(task.id);
                this._eventService.emit(APP_EVENTS.NOTIFICATION, { type: 'success', message: successMessage });
            } else {
                const failureMessage = lastError
                    ? lastError.message
                    : 'Task failed after all retries';

                let uiMessage = `${friendlyName} failed: ${failureMessage}`;

                const isOffline = failureMessage.includes('AI is offline') ||
                    failureMessage.includes('ECONNREFUSED') ||
                    failureMessage.includes('fetch failed');

                if (isOffline) {
                    uiMessage = 'AI agent is offline. Please check your connection or start the local model.';
                } else if (lastError && (lastError.isAiError || lastError.isOllamaError)) {
                    uiMessage = lastError.message;
                }

                if (taskEntry.onError) {
                    try {
                        await taskEntry.onError(payload, failureMessage);
                    } catch (err) {
                        this._logService.logTerminal({ status: ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'QueueService.js', message: `onError hook failed for task ${task.id}: ${err.message}` });
                    }
                }

                this._eventService.emit(APP_EVENTS.NOTIFICATION, { type: 'error', message: uiMessage });
                this.markFailed(task.id, { errorMsg: failureMessage, verboseDetails: lastError, payload });
            }
        } finally {
            this.abortControllers.delete(task.id);
            this.activeWorkers--;
            setImmediate(() => this.processNext());

            this._eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());
        }
    }

    /**
     * Marks a task as completed successfully.
     *
     * @param {number} taskId - The task ID
     */
    markCompleted(taskId) {
        this._queueRepo.markCompleted(taskId);
        this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'QueueService.js', message: `Task #${taskId} completed successfully.` });
        this._logService.logSystemFile('QueueService.js', `Task #${taskId} completed successfully.`);
    }

    /**
     * Marks a task as failed.
     *
     * @param {number} taskId - The task ID
     * @param {Object} [failureDto={}] - Failure details object.
     * @param {string} failureDto.errorMsg - The error message.
     * @param {Error} [failureDto.verboseDetails=null] - Optional detailed error object.
     * @param {Object} [failureDto.payload=null] - Optional task payload.
     */
    markFailed(taskId, failureDto = {}) {
        const { errorMsg, verboseDetails, payload } = failureDto;
        this._queueRepo.markFailed(taskId, errorMsg);
        this._logService.logTerminal({ status: ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'QueueService.js', message: `Task #${taskId} failed: ${errorMsg}` });
        this._logService.logErrorFile({ origin: 'QueueService.js', message: `Task #${taskId} failed: ${errorMsg}`, errorObj: verboseDetails, details: payload });

        if (payload) {
            this._eventService.emit(APP_EVENTS.TASK_FAILED, { taskId, errorMsg, payload });
        }
    }

    /**
     * Marks a task for retry after a delay.
     *
     * @param {number} taskId - The task ID
     * @param {Object} [retryDto={}] - Retry details object.
     * @param {string} retryDto.errorMsg - The error message.
     * @param {number} retryDto.delaySeconds - Delay in seconds before retry.
     * @param {Object} [retryDto.payload=null] - Optional task payload.
     */
    markForRetry(taskId, retryDto = {}) {
        const { errorMsg, delaySeconds, payload } = retryDto;
        this._queueRepo.markForRetry(taskId, delaySeconds);
        this._logService.logTerminal({ status: WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'QueueService.js', message: `Task #${taskId} failed but will retry in ${delaySeconds}s. Reason: ${errorMsg}` });

        if (payload) {
            this._eventService.emit(APP_EVENTS.TASK_FAILED, { taskId, errorMsg, payload });
        }
    }

    /**
     * Aborts any processing tasks matching a specific payload key value.
     *
     * @param {string} payloadKey - The payload key to match
     * @param {*} targetId - The target ID value
     * @private
     */
    _abortIfProcessingMatches(payloadKey, targetId) {
        const processingTasks = this._queueRepo.getProcessingTasks();

        for (const task of processingTasks) {
            try {
                const payload = JSON.parse(task.payload);
                if (payload[payloadKey] === targetId) {
                    const controller = this.abortControllers.get(task.id);
                    if (controller) {
                        controller.abort();
                    }
                }
            } catch (_e) { /* ignored intentionally */ }
        }
    }

    /**
     * Cancels all extraction tasks for a specific entity.
     *
     * @param {number} entityId - The entity ID
     */
    cancelEntityExtractionTasks(entityId) {
        this._abortIfProcessingMatches('entityId', entityId);

        const deletedCount = this._queueRepo.deleteEntityExtractionTasks(entityId);
        this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.NONE, origin: 'QueueService.js', message: `Cancelled ${deletedCount} background task(s) for entity #${entityId}.` });
        this._eventService.emit(APP_EVENTS.QUEUE_UPDATE, this.getQueueStatus());
    }

    /**
     * Sweeps for orphaned tasks and entities/matches from unexpected server restarts.
     * Processes and fails them appropriately.
     *
     * @async
     */
    async sweepOrphanedTasks() {
        this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'QueueService.js', message: 'Sweeping for orphaned processing tasks due to server restart...' });
        try {
            const staleTasks = this._queueRepo.getStaleProcessingTasks();

            if (staleTasks.length === 0) {
                this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'QueueService.js', message: 'No orphaned queue tasks found.' });
            } else {
                for (const task of staleTasks) {
                    const failureMessage = 'Task failed due to unexpected backend server restart.';
                    this._logService.logTerminal({ status: ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'QueueService.js', message: `Failing orphaned task ${task.id}: ${failureMessage}` });

                    this._queueRepo.markFailed(task.id, failureMessage);

                    const taskEntry = this.taskHandlers.get(task.task_type);
                    if (taskEntry && taskEntry.onError) {
                        try {
                            const payload = JSON.parse(task.payload);
                            await taskEntry.onError(payload, failureMessage);
                        } catch (err) {
                            this._logService.logTerminal({ status: ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'QueueService.js', message: `Failed to execute onError for orphaned task ${task.id}: ${err.message}` });
                        }
                    }

                    this._eventService.emit(APP_EVENTS.QUEUE_UPDATE, {
                        id: task.id,
                        status: QUEUE_STATUSES.FAILED,
                        error: failureMessage
                    });
                }
            }

            // Generic sweep across ALL entity types using the inherited CTI base method
            const stuckEntities = this._entityService.getStuckEntities();

            if (stuckEntities.length > 0) {
                this._logService.logTerminal({ status: WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'QueueService.js', message: `Found ${stuckEntities.length} orphaned entity(ies) stuck in processing.` });
                
                for (const entity of stuckEntities) {
                    // Route the failure update based on the CTI entity_type
                    if (entity.entity_type === 'match') {
                        this._matchService.updateState(entity.id, { status: ENTITY_STATUS.FAILED, error: INTERRUPTION_ERROR });
                    } else {
                        this._entityService.updateState(entity.id, { status: ENTITY_STATUS.FAILED, error: INTERRUPTION_ERROR });
                        this._logService.addActivityLog({
                            entityType: 'Entity',
                            entityId: entity.id,
                            logType: ERROR,
                            message: INTERRUPTION_ERROR,
                            folderPath: entity.folder_path || 'Unknown' // Note: SQL returns snake_case folder_path
                        });
                    }
                }
            } else {
                this._logService.logTerminal({ status: INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'QueueService.js', message: 'No orphaned domain entities found.' });
            }
        } catch (error) {
            this._logService.logTerminal({ status: ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'QueueService.js', message: `Failed to execute orphaned task sweep: ${error.message}`, errorObj: error });
            this._logService.logErrorFile({ origin: 'QueueService.js', message: 'Failed to execute orphaned task sweep', errorObj: error });
        }
    }
}

/**
 * @dependency_injection
 * QueueService exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = QueueService;