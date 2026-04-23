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
    RESOURCE_STATE_CHANGED: 'resourceStateChanged',
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
 * Match Category Definitions
 * Replaces magic strings for match categorization in reports.
 */
export const MATCH_CATEGORIES = {
    PERFECT: 'perfect',
    PARTIAL: 'partial',
    MISSED: 'missed'
} as const;

/**
 * @description The single source of truth for entity processing states. All UI lifecycle logic must derive from this object.
 * Entity Status Registry
 * Centralized status constants for entity processing lifecycle.
 * This is the single source of truth - queue_status has been deprecated.
 * @responsibility Provides exhaustive list of all possible entity states for frontend type safety.
 * @reasoning Includes granular processing sub-states to enable UI differentiation between
 *            overall processing and specific pipeline stages (parsing, extraction, vault movement).
 */
const ENTITY_STATUS_REGISTRY = {
    PENDING: { value: 'pending', label: 'Queued for processing', group: 'pending' },
    PARSING_DOCUMENT: { value: 'parsing_document', label: 'Reading document', group: 'processing' },
    EXTRACTING_VERBATIM_TEXT: { value: 'extracting_verbatim_text', label: 'Extracting text', group: 'processing' },
    EXTRACTING_METADATA: { value: 'extracting_metadata', label: 'Extracting metadata', group: 'processing' },
    EXTRACTING_CRITERIA: { value: 'extracting_criteria', label: 'Extracting criteria', group: 'processing' },
    MOVING_TO_VAULT: { value: 'moving_to_vault', label: 'Finalizing', group: 'processing' },
    COMPLETED: { value: 'completed', label: 'Completed', group: 'completed' },
    FAILED: { value: 'failed', label: 'Failed', group: 'failed' },
    VECTORIZING_CRITERIA: { value: 'vectorizing_criteria', label: 'Vectorizing criteria', group: 'processing' },
    MERGING_CRITERIA: { value: 'merging_criteria', label: 'Merging criteria', group: 'processing' },
    CALCULATING_MATCH_SCORES: { value: 'calculating_match_scores', label: 'Calculating match scores', group: 'processing' },
    GENERATING_MATCH_SUMMARY: { value: 'generating_match_summary', label: 'Generating match summary', group: 'processing' },
    GENERATING_MATCH_REPORT: { value: 'generating_match_report', label: 'Generating match report', group: 'processing' }
} as const;

export const ENTITY_STATUS = {
    PENDING: ENTITY_STATUS_REGISTRY.PENDING.value,
    PROCESSING: 'processing',
    PARSING_DOCUMENT: ENTITY_STATUS_REGISTRY.PARSING_DOCUMENT.value,
    EXTRACTING_VERBATIM_TEXT: ENTITY_STATUS_REGISTRY.EXTRACTING_VERBATIM_TEXT.value,
    EXTRACTING_METADATA: ENTITY_STATUS_REGISTRY.EXTRACTING_METADATA.value,
    EXTRACTING_CRITERIA: ENTITY_STATUS_REGISTRY.EXTRACTING_CRITERIA.value,
    MOVING_TO_VAULT: ENTITY_STATUS_REGISTRY.MOVING_TO_VAULT.value,
    COMPLETED: ENTITY_STATUS_REGISTRY.COMPLETED.value,
    FAILED: ENTITY_STATUS_REGISTRY.FAILED.value,
    VECTORIZING_CRITERIA: ENTITY_STATUS_REGISTRY.VECTORIZING_CRITERIA.value,
    MERGING_CRITERIA: ENTITY_STATUS_REGISTRY.MERGING_CRITERIA.value,
    CALCULATING_MATCH_SCORES: ENTITY_STATUS_REGISTRY.CALCULATING_MATCH_SCORES.value,
    GENERATING_MATCH_SUMMARY: ENTITY_STATUS_REGISTRY.GENERATING_MATCH_SUMMARY.value,
    GENERATING_MATCH_REPORT: ENTITY_STATUS_REGISTRY.GENERATING_MATCH_REPORT.value,
} as const;

export const ENTITY_STATUS_LABELS: Record<EntityStatus, string> =
    Object.values(ENTITY_STATUS_REGISTRY).reduce((acc, curr) => ({ ...acc, [curr.value]: curr.label }), {} as any);

export const STATUS_GROUPS: Record<string, string[]> = Object.values(ENTITY_STATUS_REGISTRY).reduce((acc, curr) => {
    if (!acc[curr.group]) acc[curr.group] = [];
    acc[curr.group].push(curr.value);
    return acc;
}, {} as any);

/**
 * Standardized Status Filter Options
 * @description Single source of truth for status filtering dropdowns across the application (Requirements, Offerings, Matches).
 * @responsibility Prevents DRY violations by centralizing the label mapping and order of status filters.
 * If a new lifecycle state is added to ENTITY_STATUS that requires UI filtering, it must be added here.
 */
export const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Queued' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' }
];

/**
 * @constant SETTING_KEYS
 * @description Centralized dictionary for setting payload keys mapped from the backend.
 * Enforces DRY principle and prevents magic string typos in component state logic.
 * @responsibility Acts as the Single Source of Truth for all configurable application thresholds and toggles.
 */
export const SETTING_KEYS = {
    DEBUG_MODE: 'debug_mode',
    AUTO_MERGE_THRESHOLD: 'auto_merge_threshold',
    MINIMUM_MATCH_FLOOR: 'minimum_match_floor',
    PERFECT_MATCH_SCORE: 'perfect_match_score',
    LOG_AI_INTERACTIONS: 'log_ai_interactions',
    AI_VERIFY_MERGES: 'ai_verify_merges',
    ALLOW_CONCURRENT_AI: 'allow_concurrent_ai',
    USE_AI_CACHE: 'use_ai_cache',
} as const;

export type EntityStatus = typeof ENTITY_STATUS[keyof typeof ENTITY_STATUS];
type EntityRole = typeof ENTITY_ROLES[keyof typeof ENTITY_ROLES];
type AiModelRole = typeof AI_MODEL_ROLES[keyof typeof AI_MODEL_ROLES];
type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];
export type MatchCategory = typeof MATCH_CATEGORIES[keyof typeof MATCH_CATEGORIES];
type ToastType = typeof TOAST_TYPES[keyof typeof TOAST_TYPES];
type AppEvent = typeof APP_EVENTS[keyof typeof APP_EVENTS];

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
        ITEMS_PER_PAGE: 12,
        COMBOBOX_LIMIT: 12,
        CRITERIA_LIMIT: 200
    },
    ANIMATION: {
        STAGGER_DELAY: 0.05,
        EXIT_DURATION: 0.1,
        ENTRY_DURATION: 0.3,
        EASING_OUT: "easeOut" as const
    }
} as const;

/**
 * UI Component Variations
 * Centralized options for shared UI components to prevent inline unions.
 */
export const BUTTON_VARIANTS = {
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
    GHOST: 'ghost',
    DANGER: 'danger'
} as const;

export const BUTTON_SIZES = {
    SM: 'sm',
    MD: 'md',
    LG: 'lg',
    ICON: 'icon'
} as const;

/**
 * Queue Task Types
 * Mirrors backend task names for type-safe queue operations.
 */
export const QUEUE_TASKS = {
    PROCESS_ENTITY_DOCUMENT: 'PROCESS_ENTITY_DOCUMENT',
    EXTRACT_ENTITY_CRITERIA: 'EXTRACT_ENTITY_CRITERIA',
    ASSESS_ENTITY_MATCH: 'ASSESS_ENTITY_MATCH'
} as const;

type QueueTaskType = typeof QUEUE_TASKS[keyof typeof QUEUE_TASKS];

/**
 * @description Single Source of Truth (SSoT) for all application constants and domain types.
 * @responsibility Prevents DRY violations and magic strings across the frontend.
 * @boundary_rules
 * - ❌ MUST NOT use inline string or number unions in any component or API client.
 * - ✅ MUST export all application-wide settings, statuses, and roles from here.
 */