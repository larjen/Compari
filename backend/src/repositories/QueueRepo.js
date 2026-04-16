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

const db = require('./Database');
const BaseRepository = require('./BaseRepository');
const { QUEUE_STATUSES } = require('../config/constants');

class QueueRepo extends BaseRepository {
    /**
     * Creates a new QueueRepo instance.
     * @constructor
     */
    constructor() {
        super('job_queue');
    }

    enqueue(taskType, payload) {
        const stmt = db.prepare(`INSERT INTO job_queue (task_type, payload) VALUES (?, ?)`);
        const info = stmt.run(taskType, JSON.stringify(payload));
        return info.lastInsertRowid;
    }

    // Safely claim the next task and immediately mark it as processing
    claimNextTask() {
        const dbTrans = db.transaction(() => {
            const task = db.prepare(`SELECT * FROM job_queue WHERE status = ? ORDER BY id ASC LIMIT 1`).get(QUEUE_STATUSES.PENDING);
            if (task) {
                db.prepare(`UPDATE job_queue SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?`).run(QUEUE_STATUSES.PROCESSING, task.id);
                task.started_at = new Date().toISOString();
                return task;
            }
            return null;
        });
        return dbTrans();
    }

    getProcessingTask() {
        return db.prepare(`SELECT * FROM job_queue WHERE status = ? ORDER BY id ASC LIMIT 1`).get(QUEUE_STATUSES.PROCESSING);
    }

    getPendingTasks() {
        return db.prepare(`SELECT * FROM job_queue WHERE status = ? ORDER BY id ASC`).all(QUEUE_STATUSES.PENDING);
    }

    markCompleted(id) {
        db.prepare(`UPDATE job_queue SET status = ? WHERE id = ?`).run(QUEUE_STATUSES.COMPLETED, id);
    }

    markFailed(id, errorMsg) {
        db.prepare(`UPDATE job_queue SET status = ?, error = ? WHERE id = ?`).run(QUEUE_STATUSES.FAILED, errorMsg, id);
    }

    getCurrentTaskById(id) {
        return db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(id);
    }

    /**
     * Finds tasks that are currently marked as processing.
     * @returns {Array} List of stale processing tasks.
     */
    getStaleProcessingTasks() {
        return db.prepare(`SELECT * FROM job_queue WHERE status = ?`).all(QUEUE_STATUSES.PROCESSING);
    }

    /**
     * Updates the status of a task.
     * @param {number} id - The task ID
     * @param {string} status - The new status
     * @param {string|null} error - Optional error message
     */
    updateStatus(id, status, error = null) {
        if (error) {
            db.prepare(`UPDATE job_queue SET status = ?, error = ? WHERE id = ?`).run(status, error, id);
        } else {
            db.prepare(`UPDATE job_queue SET status = ? WHERE id = ?`).run(status, id);
        }
    }

    /**
     * Deletes all pending or processing tasks associated with a specific entity.
     * Universal catch-all to ensure no orphaned tasks remain in the queue (PROCESS_ENTITY_DOCUMENT, EXTRACT_ENTITY_CRITERIA, etc.)
     * @param {number} entityId - The ID of the entity
     * @returns {number} The number of tasks deleted
     */
    deleteEntityExtractionTasks(entityId) {
        const stmt = db.prepare(`
            DELETE FROM job_queue 
            WHERE (status = ? OR status = ?) 
            AND json_extract(payload, '$.entityId') = ?
        `);
        const info = stmt.run(QUEUE_STATUSES.PENDING, QUEUE_STATUSES.PROCESSING, entityId);
        return info.changes;
    }

    /**
     * Wipes the job queue and gracefully fails interrupted tasks on startup.
     * @returns {number} The number of tasks deleted from the queue.
     * @description
     * Safely clears all tasks from the job_queue table. Since the queue is wiped,
     * any entities or matches that were actively 'processing' or 'pending' are now 
     * orphaned. This safely transitions them to a 'failed' state so users can 
     * manually retry them, while explicitly preserving entities that were already 
     * 'failed' or 'completed'.
     */
    wipeQueue() {
        const dbTrans = db.transaction(() => {
            const deleteResult = db.prepare(`DELETE FROM job_queue`).run();
            
            // Safely fail entities whose background jobs were just destroyed
            db.prepare(`
                UPDATE entities 
                SET status = ?, 
                    error = 'Interrupted by server shutdown. Please retry.' 
                WHERE status = ? OR status = ?
            `).run(QUEUE_STATUSES.FAILED, QUEUE_STATUSES.PENDING, QUEUE_STATUSES.PROCESSING);

            // Safely fail matches whose background jobs were just destroyed
            db.prepare(`
                UPDATE entity_matches 
                SET status = ?,
                    error = 'Interrupted by server shutdown. Please retry.' 
                WHERE status = ? OR status = ?
            `).run(QUEUE_STATUSES.FAILED, QUEUE_STATUSES.PENDING, QUEUE_STATUSES.PROCESSING);
            
            return deleteResult.changes;
        });
        return dbTrans();
    }
}

module.exports = new QueueRepo();