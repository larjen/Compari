/**
 * @module useTaskLifecycle
 * @description Single source of truth for translating backend status strings into UI lifecycle states.
 * @responsibility
 * - Calculates boolean lifecycle states (isPending, isProcessing, hasError, isCompleted) from status string.
 * - Invokes useElapsedTime for processing tasks to show elapsed time.
 * - Provides a unified interface for any future entity type to plug into the queue/processing/completed cycle.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT contain API logic.
 * - ✅ Uses ENTITY_STATUS constants from @/lib/constants.
 * @example
 * const { isPending, isProcessing, hasError, isCompleted, elapsedTime } = useTaskLifecycle(
 *   entity.status,
 *   processingStartedAt,
 *   entity.error
 * );
 */
'use client';

import { useElapsedTime } from './useElapsedTime';
import { ENTITY_STATUS } from '@/lib/constants';

/**
 * SoC Note: The database schema includes CHECK constraints that enforce
 * ENTITY_STATUS values (pending, processing, completed, failed).
 * This guarantees we will never receive an unexpected status string,
 * allowing the frontend to safely rely on exhaustive switch/if statements.
 */
type EntityStatusType = 'pending' | 'processing' | 'completed' | 'failed' | null | undefined;

interface UseTaskLifecycleProps {
  status: EntityStatusType;
  startTime: string | null | undefined;
  error?: string | null;
}

interface UseTaskLifecycleReturn {
  isPending: boolean;
  isProcessing: boolean;
  hasError: boolean;
  isCompleted: boolean;
  elapsedTime: string;
}

/**
 * Custom hook for deriving UI lifecycle states from backend status.
 * @param {string | null | undefined} status - The current status from the backend (pending, processing, completed, failed)
 * @param {string | null | undefined} startTime - The timestamp when processing started (for elapsed time calculation)
 * @param {string | null | undefined} error - Optional error message string
 * @returns {UseTaskLifecycleReturn} Object containing boolean lifecycle states and elapsed time
 */
export function useTaskLifecycle(
  status: string | null | undefined,
  startTime: string | null | undefined,
  error?: string | null
): UseTaskLifecycleReturn {
  const isPending = status === ENTITY_STATUS.PENDING;
  const isProcessing = status === ENTITY_STATUS.PROCESSING;
  const hasError = status === ENTITY_STATUS.FAILED || status === 'error' || !!error;
  const isCompleted = status === ENTITY_STATUS.COMPLETED;

  const elapsedTime = useElapsedTime(isProcessing ? startTime : undefined);

  return {
    isPending,
    isProcessing,
    hasError,
    isCompleted,
    elapsedTime
  };
}