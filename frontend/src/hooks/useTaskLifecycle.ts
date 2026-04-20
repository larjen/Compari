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
import { ENTITY_STATUS, type EntityStatus } from '@/lib/constants';

interface UseTaskLifecycleProps {
  status: EntityStatus | string | null | undefined;
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
 * @description Derives UI lifecycle states specifically from the centralized ENTITY_STATUS constants
 * to maintain alignment with the document processing pipeline.
 * Custom hook for deriving UI lifecycle states from backend status.
 * @param {EntityStatus | string | null | undefined} status - The current status from the backend (pending, processing, completed, failed)
 * @param {string | null | undefined} startTime - The timestamp when processing started (for elapsed time calculation)
 * @param {string | null | undefined} error - Optional error message string
 * @returns {UseTaskLifecycleReturn} Object containing boolean lifecycle states and elapsed time
 */
export function useTaskLifecycle(
  status: EntityStatus | string | null | undefined,
  startTime: string | null | undefined,
  error?: string | null
): UseTaskLifecycleReturn {
  const s = status?.toLowerCase();

  /**
   * SoC Policy: Strict state separation.
   * - isPending: Specifically waiting in the queue.
   * - isCompleted: Terminal success.
   * - hasError: Terminal failure.
   * - isProcessing: Any non-terminal, non-pending state (granular pipeline stages).
   */
  const isPending = s === ENTITY_STATUS.PENDING;
  const isCompleted = s === ENTITY_STATUS.COMPLETED;
  const hasError = s === ENTITY_STATUS.FAILED || !!error;

  const isProcessing = !!s && !isPending && !isCompleted && !hasError;

  const elapsedTime = useElapsedTime(isProcessing ? startTime : undefined);

  return {
    isPending,
    isProcessing,
    hasError,
    isCompleted,
    elapsedTime
  };
}