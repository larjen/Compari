/**
 * Application Constants
 * Defines directory paths, configuration values, and status enumerations.
 * Centralizes all hardcoded values used throughout the application.
 */
const path = require('path');

/**
 * Application Event Names
 * Enforces strict contracts between the EventService (emitter) and TaskListeners/SSE clients (subscribers).
 * This prevents silent failures caused by typos in string literals across the codebase.
 */
const APP_EVENTS = Object.freeze({
    ENTITY_UPDATE: 'entityUpdate',
    MATCH_UPDATE: 'matchUpdate',
    QUEUE_UPDATE: 'queueUpdate',
    BLUEPRINT_UPDATE: 'blueprintUpdate',
    NOTIFICATION: 'notification',
    TASK_FAILED: 'task:failed'
});

/**
 * Log Symbols for Terminal Output
 * Standardizes visual markers in the terminal logs.
 * Ensures consistent log symbol usage across the application.
 */
const LOG_SYMBOLS = Object.freeze({
    CHECKMARK: 'CHECKMARK',
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    LIGHTNING: 'LIGHTNING',
    NONE: 'NONE'
});

const ROOT_DIR = path.join(__dirname, '../../../');

/**
 * Entity Role Definitions
 * Replaces hardcoded 'requirement' and 'offering' strings.
 * Ensures type safety and prevents typo-induced bugs across the application.
 */
const ENTITY_ROLES = Object.freeze({
    REQUIREMENT: 'requirement',
    OFFERING: 'offering'
});

/**
 * AI Model Role Definitions
 * Replaces hardcoded 'chat' and 'embedding' strings.
 * Used by AiModelRepo, AiService, and frontend components.
 */
const AI_MODEL_ROLES = Object.freeze({
    CHAT: 'chat',
    EMBEDDING: 'embedding'
});

/**
 * AI Task Type Definitions
 * Replaces hardcoded task routing strings in AiService.
 * Centralizes task type routing logic for maintainability.
 */
const AI_TASK_TYPES = Object.freeze({
    GENERAL: 'general',
    VERIFICATION: 'verification',
    EMBEDDING: 'embedding',
    METADATA: 'metadata'
});

/**
 * Blueprint Field Type Definitions
 * Replaces hardcoded field type strings used in DynamicSchemaBuilder and BlueprintRepo.
 */
const FIELD_TYPES = Object.freeze({
    STRING: 'string',
    NUMBER: 'number',
    DATE: 'date',
    BOOLEAN: 'boolean'
});

/**
 * System Setting Keys
 * Enforces strict key matching for database-driven application settings.
 */
const SETTING_KEYS = Object.freeze({
    AUTO_MERGE_THRESHOLD: 'auto_merge_threshold',
    MINIMUM_MATCH_FLOOR: 'minimum_match_floor',
    PERFECT_MATCH_SCORE: 'perfect_match_score',
    LOG_AI_INTERACTIONS: 'log_ai_interactions',
    AI_VERIFY_MERGES: 'ai_verify_merges',
    MODEL_ROUTING_GENERAL: 'model_routing_general',
    MODEL_ROUTING_VERIFICATION: 'model_routing_verification',
    MODEL_ROUTING_EMBEDDING: 'model_routing_embedding',
    MODEL_ROUTING_METADATA: 'model_routing_metadata',
    ALLOW_CONCURRENT_AI: 'allow_concurrent_ai',
    OLLAMA_HOST: 'ollama_host',
    OLLAMA_MODEL: 'ollama_model'
});

/**
 * Prompt System Names
 * Strictly binds AI prompt fetching to the seeded database identifiers.
 */
const PROMPT_SYSTEM_NAMES = Object.freeze({
    MARKDOWN_EXTRACTION: 'markdown_extraction',
    ENTITY_METADATA: 'entity_metadata',
    DYNAMIC_EXTRACTION: 'dynamic_extraction',
    MATCH_SUMMARY: 'match_summary',
    EXECUTIVE_SUMMARY: 'executive_summary',
    SYNONYM_VALIDATOR: 'synonym_validator'
});

/**
 * Standardized HTTP Status Codes
 * Eliminates magic numbers across controllers, middlewares, and error handlers.
 * Improves API reliability by ensuring consistent status code usage.
 */
const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
});

/**
 * Standardized Application Error Messages
 * Ensures consistent API error responses across the application.
 * Centralizes error string literals to prevent typos and inconsistencies.
 */
const ERROR_MESSAGES = Object.freeze({
    VALIDATION_FAILED: 'Validation failed',
    RESOURCE_NOT_FOUND: 'Requested resource was not found',
    INTERNAL_ERROR: 'An internal server error occurred'
});

module.exports = {
    // HTTP Status Codes (NEW)
    HTTP_STATUS,

    // Error Messages (NEW)
    ERROR_MESSAGES,

    // Event Names (NEW)
    APP_EVENTS,

    // Log Symbols (NEW)
    LOG_SYMBOLS,

    // Entity Roles (NEW)
    ENTITY_ROLES,
    AI_MODEL_ROLES,
    AI_TASK_TYPES,
    FIELD_TYPES,

    // System Setting Keys (NEW)
    SETTING_KEYS,

    // Prompt System Names (NEW)
    PROMPT_SYSTEM_NAMES,

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
    /**
     * Document Types
     * @description Centralized document type constants for entity and match documents.
     * Uses consistent casing to match database seeded values.
     */
    DOCUMENT_TYPES: {
        ENTITY_PROFILE: 'Entity Profile',
        EXTRACTED_DATA: 'Extracted Entity Data',
        TARGET_PROFILE: 'Target Profile',
        SUPPORTING_DOC: 'Supporting Document',
        MATCH_REPORT: 'Match Report',
        MATCH_REPORT_PDF: 'Match Report PDF',
        AI_DEBUG_LOG: 'AI Debug Log',
        ACTIVITY_LOG: 'Activity Log',
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
     * Uses lowercase to match actual database values.
     */
    QUEUE_STATUSES: {
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed'
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
    },

    /**
     * Standard HTTP Headers
     * Prevents case-sensitivity bugs and typos when setting response headers.
     */
    HTTP_HEADERS: Object.freeze({
        CONTENT_TYPE: 'Content-Type',
        CONTENT_DISPOSITION: 'Content-Disposition'
    }),

    /**
     * Supported MIME Types Map
     * Centralized mapping for file downloads, uploads, and AI document processing.
     */
    MIME_TYPES: Object.freeze({
        PDF: 'application/pdf',
        TXT: 'text/plain',
        MD: 'text/markdown',
        PNG: 'image/png',
        JPG: 'image/jpeg',
        JPEG: 'image/jpeg',
        JSON: 'application/json',
        JSONL: 'application/json',
        OCTET_STREAM: 'application/octet-stream'
    })
};
