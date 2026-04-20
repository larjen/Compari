/**
 * @module QueueRepo
 * @description Data Access Layer for `job_queue` table.
 * * @responsibility
 * - Executes all SQL CRUD queries related to the job queue.
 * - Maps raw SQLite rows into `JobQueue` Model instances.
 * - Extends BaseRepository for common CRUD operations.
 * * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT interact with the file system or AI.
 */

const BaseRepository = require('./BaseRepository');
const { QUEUE_STATUSES } = require('../config/constants');

class QueueRepo extends BaseRepository {
    /**
     * Creates a new QueueRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     */
    constructor({ db }) {
        super('job_queue', { db });
    }

    enqueue(taskType, payload) {
        const stmt = this.db.prepare(`INSERT INTO job_queue (task_type, payload) VALUES (?, ?)`);
        const info = stmt.run(taskType, JSON.stringify(payload));
        return info.lastInsertRowid;
    }

    // Safely claim the next task and immediately mark it as processing
    // Only claims tasks where status = 'pending' AND (available_at IS NULL OR available_at <= CURRENT_TIMESTAMP)
    // This enables database-backed retries without blocking the worker
    claimNextTask() {
        const dbTrans = this.db.transaction(() => {
            const task = this.db.prepare(`
                SELECT * FROM job_queue 
                WHERE status = ? 
                AND (available_at IS NULL OR available_at <= datetime('now')) 
                ORDER BY id ASC LIMIT 1
            `).get(QUEUE_STATUSES.PENDING);
            if (task) {
                this.db.prepare(`UPDATE job_queue SET status = ?, started_at = datetime('now') WHERE id = ?`).run(QUEUE_STATUSES.PROCESSING, task.id);
                task.started_at = new Date().toISOString();
                return task;
            }
            return null;
        });
        return dbTrans();
    }

    /**
     * Marks a task for retry by pushing it back to the queue with a future visibility timestamp.
     * 
     * @description
     * This method implements database-backed retry mechanics:
     * - Resets status to 'pending' to make the task eligible for re-claiming
     * - Increments the attempts counter to track retry attempts
     * - Sets available_at to a future timestamp using SQLite's datetime() function
     * - Clears the error field so the next run starts fresh
     * 
     * This approach avoids worker starvation by not blocking the worker with setTimeout.
     * The worker can immediately process other tasks while this one awaits its scheduled time.
     * 
     * @param {number} id - The task ID to retry
     * @param {number} delaySeconds - The number of seconds to wait before the task becomes visible
     */
    markForRetry(id, delaySeconds) {
        this.db.prepare(`
            UPDATE job_queue 
            SET status = ?, 
                attempts = attempts + 1, 
                available_at = datetime('now', '+' || ? || ' seconds'),
                error = NULL 
            WHERE id = ?
        `).run(QUEUE_STATUSES.PENDING, delaySeconds, id);
    }

    getProcessingTask() {
        return this.db.prepare(`SELECT * FROM job_queue WHERE status = ? ORDER BY id ASC LIMIT 1`).get(QUEUE_STATUSES.PROCESSING);
    }

    getProcessingTasks() {
        return this.db.prepare(`SELECT * FROM job_queue WHERE status = ? ORDER BY id ASC`).all(QUEUE_STATUSES.PROCESSING);
    }

    getPendingTasks() {
        return this.db.prepare(`SELECT * FROM job_queue WHERE status = ? ORDER BY id ASC`).all(QUEUE_STATUSES.PENDING);
    }

    markCompleted(id) {
        this.db.prepare(`UPDATE job_queue SET status = ? WHERE id = ?`).run(QUEUE_STATUSES.COMPLETED, id);
    }

    markFailed(id, errorMsg) {
        this.db.prepare(`UPDATE job_queue SET status = ?, error = ? WHERE id = ?`).run(QUEUE_STATUSES.FAILED, errorMsg, id);
    }

    getCurrentTaskById(id) {
        return this.db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(id);
    }

    /**
     * Finds tasks that are currently marked as processing.
     * @returns {Array} List of stale processing tasks.
     */
    getStaleProcessingTasks() {
        return this.db.prepare(`SELECT * FROM job_queue WHERE status = ?`).all(QUEUE_STATUSES.PROCESSING);
    }

    /**
     * Updates the status of a task.
     * @param {number} id - The task ID
     * @param {string} status - The new status
     * @param {string|null} error - Optional error message
     */
    updateStatus(id, status, error = null) {
        if (error) {
            this.db.prepare(`UPDATE job_queue SET status = ?, error = ? WHERE id = ?`).run(status, error, id);
        } else {
            this.db.prepare(`UPDATE job_queue SET status = ? WHERE id = ?`).run(status, id);
        }
    }

    /**
     * Deletes all pending or processing tasks associated with a specific entity.
     * Universal catch-all to ensure no orphaned tasks remain in the queue (PROCESS_ENTITY_DOCUMENT, EXTRACT_ENTITY_CRITERIA, etc.)
     * @param {number} entityId - The ID of the entity
     * @returns {number} The number of tasks deleted
     */
    deleteEntityExtractionTasks(entityId) {
        const stmt = this.db.prepare(`
            DELETE FROM job_queue 
            WHERE (status = ? OR status = ?) 
            AND json_extract(payload, '$.entityId') = ?
        `);
        const info = stmt.run(QUEUE_STATUSES.PENDING, QUEUE_STATUSES.PROCESSING, entityId);
        return info.changes;
    }

    /**
     * Wipes the job queue only.
     * @returns {number} The number of tasks deleted from the queue.
     * @description
     * Safely clears all tasks from the job_queue table. This method ONLY deletes
     * from the queue table. Domain-level state transitions for orphaned entities
     * and matches are handled by QueueService to maintain the Repository boundary.
     *
     * @socexplanation
     * - Repository must not directly mutate entities or entity_matches tables.
     * - This maintains the strict boundary where Repositories only manage their own domain.
     * - Service layer handles domain-level state resets via their respective services.
     */
    wipeQueue() {
        const deleteResult = this.db.prepare(`DELETE FROM job_queue`).run();
        return deleteResult.changes;
    }
}

/**
 * @dependency_injection
 * QueueRepo exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * @param {Object} deps - Dependencies object.
 * @param {Object} deps.db - The database instance (injected).
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = QueueRepo;