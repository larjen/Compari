/**
 * Application Constants
 * Defines directory paths, configuration values, and status enumerations.
 * Centralizes all hardcoded values used throughout the application.
 */
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../../../');

module.exports = {
    // Entity Directories
    /**
     * @socexplanation
     * Renamed from Sources/Targets to Offerings/Requirements to align with 
     * the updated business terminology and entity roles.
     */
    OFFERINGS_DIR: path.join(ROOT_DIR, 'data', 'Offerings'),
    REQUIREMENTS_DIR: path.join(ROOT_DIR, 'data', 'Requirements'),
    TRASHED_DIR: path.join(ROOT_DIR, 'data', 'Trashed'),
    DB_DIR: path.join(ROOT_DIR, 'data', 'Database'),
    LOGS_DIR: path.join(ROOT_DIR, 'data', 'logs'),
    UPLOADS_DIR: path.join(ROOT_DIR, 'data', 'uploads'),
    DATA_DIR: path.join(ROOT_DIR, 'data'),

    // Match Reports
    MATCH_REPORTS_DIR: path.join(ROOT_DIR, 'data', 'Match Reports'),

    // Log Severity Levels
    LOG_LEVELS: {
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR'
    },

    // Statuses
    STATUSES: {
        WAITING: 'Waiting',
        PREPARING: 'Preparing',
        SENT: 'Sent',
        FINISHED: 'Finished'
    },

    // Document Types
    DOCUMENT_TYPES: {
        ENTITY_PROFILE: 'Entity Profile',
        EXTRACTED_DATA: 'Extracted Entity Data',
        TARGET_PROFILE: 'Target Profile',
        SUPPORTING_DOC: 'Supporting Document',
        MATCH_REPORT: 'Match Report',
        OTHER: 'Other'
    },

    /**
     * Queue Task Types
     * @description Centralized task type constants to prevent magic strings.
     * Used by QueueService, TaskListeners, and frontend to enforce strong contracts.
     */
    QUEUE_TASKS: {
        PROCESS_ENTITY_DOCUMENT: 'PROCESS_ENTITY_DOCUMENT',
        EXTRACT_ENTITY_CRITERIA: 'EXTRACT_ENTITY_CRITERIA',
        ASSESS_ENTITY_MATCH: 'ASSESS_ENTITY_MATCH'
    },

    /**
     * Queue Status Values
     * @description Centralized status constants for queue task lifecycle.
     */
    QUEUE_STATUSES: {
        PENDING: 'PENDING',
        PROCESSING: 'PROCESSING',
        COMPLETED: 'COMPLETED',
        ERROR: 'ERROR'
    },

    /**
     * Entity Status Values
     * @description Centralized status constants for entity processing lifecycle.
     * Used by DocumentProcessorWorkflow, TaskListeners, EntityController, and EntityRepo.
     * This is the single source of truth for entity status - queue_status has been deprecated.
     */
    ENTITY_STATUS: {
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed',
    }
};
