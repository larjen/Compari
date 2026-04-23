'use client';

/**
 * @module useMatchOperations
 * @description Centralized hook for match mutations with standardized UI toast feedback.
 * @responsibility
 * - Consolidates toast-wrapped mutation handlers for match operations.
 * - Provides single source of truth for match operations across the app.
 * - Prevents WET violations and SoC breaches in match-related components.
 * - Inherits common operations from useBaseEntityOperations hook
 * @boundary_rules
 * - ❌ MUST NOT contain UI rendering logic (JSX)
 * - ✅ MUST use useToast hook for all notification feedback
 * - ✅ MUST expose onSuccess callbacks for caller-driven refetch
 * - ✅ MUST use useBaseEntityOperations for common delete, retry, writeMasterFile, fetchMasterFile
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { useBaseEntityOperations } from './useBaseEntityOperations';
import { matchApi } from '@/lib/api/matchApi';
import { TOAST_TYPES } from '@/lib/constants';

interface UseMatchOperationsOptions {
  /** Delete function from useMatches hook (includes refetch internally) */
  deleteMatchFn?: (id: number) => Promise<void>;
}

interface UseMatchOperations {
  deleteWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  retryWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  writeMasterFileWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  downloadPdfWithToast: (id: number) => Promise<void>;
  /** Fetches the generated master markdown file content for a match. */
  fetchMasterFileWithToast: (id: number) => Promise<string>;
}

export function useMatchOperations({ deleteMatchFn }: UseMatchOperationsOptions = {}): UseMatchOperations {
  const { addToast } = useToast();

  const baseOps = useBaseEntityOperations({
    apiClient: matchApi,
    entityLabel: 'Match',
    deleteFn: deleteMatchFn
  });

  const downloadPdfWithToast = useCallback(
    async (id: number): Promise<void> => {
      try {
        await matchApi.downloadMatchReportPdf(id);
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to download match report PDF');
      }
    },
    [addToast]
  );

  return {
    deleteWithToast: baseOps.deleteWithToast,
    retryWithToast: baseOps.retryWithToast,
    writeMasterFileWithToast: baseOps.writeMasterFileWithToast,
    downloadPdfWithToast,
    fetchMasterFileWithToast: baseOps.fetchMasterFileWithToast
  };
}