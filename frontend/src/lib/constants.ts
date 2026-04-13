/**
 * Frontend Constants
 * Defines hardcoded values used throughout the frontend application.
 * Mirrors backend ENTITY_STATUS constants for type safety.
 */

/**
 * Entity Status Values
 * @description Centralized status constants for entity processing lifecycle.
 * This is the single source of truth - queue_status has been deprecated.
 */
export const ENTITY_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
} as const;

export type EntityStatus = typeof ENTITY_STATUS[keyof typeof ENTITY_STATUS];