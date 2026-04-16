/**
 * Frontend Constants
 * Defines hardcoded values used throughout the frontend application.
 * Mirrors backend constants for type safety and DRY principle.
 */

/**
 * Application Event Names (SSE)
 * Mirrors the backend APP_EVENTS to ensure reliable real-time updates.
 * Enforces strict contracts between the SSE service and React components.
 */
export const APP_EVENTS = {
    ENTITY_UPDATE: 'entityUpdate',
    MATCH_UPDATE: 'matchUpdate',
    QUEUE_UPDATE: 'queueUpdate',
    BLUEPRINT_UPDATE: 'blueprintUpdate',
    NOTIFICATION: 'notification'
} as const;

/**
 * Toast Notification Types
 * Standardizes toast notification message types for consistent UI feedback.
 */
export const TOAST_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info'
} as const;

/**
 * Global Modal Types
 * Centralized modal type constants to prevent magic string errors.
 */
export const MODAL_TYPES = {
    CREATE_REQUIREMENT: 'create-requirement',
    CREATE_OFFERING: 'create-offering',
    CREATE_MATCH: 'create-match',
    CREATE_CRITERION: 'create-criterion',
    CREATE_BLUEPRINT: 'create-blueprint',
    CREATE_DIMENSION: 'create-dimension',
    SETTINGS: 'settings',
    NONE: null
} as const;

/**
 * Entity Role Definitions
 * Replaces hardcoded 'requirement' and 'offering' strings.
 * Used throughout frontend for entity type selection and display logic.
 */
export const ENTITY_ROLES = {
    REQUIREMENT: 'requirement',
    OFFERING: 'offering'
} as const;

/**
 * AI Model Role Definitions
 * Replaces hardcoded 'chat' and 'embedding' strings.
 * Used by AI model configuration and validation.
 */
export const AI_MODEL_ROLES = {
    CHAT: 'chat',
    EMBEDDING: 'embedding'
} as const;

/**
 * Blueprint Field Type Definitions
 * Replaces hardcoded field type strings used in DynamicSchemaBuilder and forms.
 */
export const FIELD_TYPES = {
    STRING: 'string',
    NUMBER: 'number',
    DATE: 'date',
    BOOLEAN: 'boolean'
} as const;

/**
 * Entity Status Values
 * Centralized status constants for entity processing lifecycle.
 * This is the single source of truth - queue_status has been deprecated.
 */
export const ENTITY_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
} as const;

/**
 * System Setting Keys
 * Enforces strict key matching for API interactions regarding settings.
 */
export const SETTING_KEYS = {
    AUTO_MERGE_THRESHOLD: 'auto_merge_threshold',
    MINIMUM_MATCH_FLOOR: 'minimum_match_floor',
    PERFECT_MATCH_SCORE: 'perfect_match_score',
    LOG_AI_INTERACTIONS: 'log_ai_interactions',
    AI_VERIFY_MERGES: 'ai_verify_merges',
    ALLOW_CONCURRENT_AI: 'allow_concurrent_ai'
} as const;

export type EntityStatus = typeof ENTITY_STATUS[keyof typeof ENTITY_STATUS];
export type EntityRole = typeof ENTITY_ROLES[keyof typeof ENTITY_ROLES];
export type AiModelRole = typeof AI_MODEL_ROLES[keyof typeof AI_MODEL_ROLES];
export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];
export type ToastType = typeof TOAST_TYPES[keyof typeof TOAST_TYPES];
export type AppEvent = typeof APP_EVENTS[keyof typeof APP_EVENTS];

/**
 * Base path for API requests.
 */
export const API_BASE_PATH = '/api' as const;

/**
 * Standard HTTP Methods
 */
export const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE'
} as const;

/**
 * Fetch Cache Control Modes
 */
export const FETCH_CACHE_MODES = {
    NO_STORE: 'no-store',
    FORCE_CACHE: 'force-cache'
} as const;

/**
 * Global UI Configurations and Animation Timings
 * Enforces a consistent design language and interaction speed across the app.
 * Centralizes magic numbers for pagination, animations, and easing curves.
 */
export const UI_CONFIG = {
    PAGINATION: {
        ITEMS_PER_PAGE: 12
    },
    ANIMATION: {
        STAGGER_DELAY: 0.05,
        EXIT_DURATION: 0.1,
        ENTRY_DURATION: 0.3,
        EASING_OUT: "easeOut" as const
    }
} as const;