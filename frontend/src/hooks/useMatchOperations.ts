'use client';

/**
 * @module useMatchOperations
 * @description Centralized hook for match mutations with standardized UI toast feedback.
 * @responsibility
 * - Consolidates toast-wrapped mutation handlers for match operations.
 * - Provides single source of truth for match operations across the app.
 * - Prevents WET violations and SoC breaches in match-related components.
 * @boundary_rules
 * - ❌ MUST NOT contain UI rendering logic (JSX)
 * - ✅ MUST use useToast hook for all notification feedback
 * - ✅ MUST expose onSuccess callbacks for caller-driven refetch
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
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
  /**
   * Fetches the generated master markdown file content for a match.
   * @param id - The match ID.
   * @returns A promise that resolves to the markdown content string.
   */
  fetchMasterFileWithToast: (id: number) => Promise<string>;
}

export function useMatchOperations({ deleteMatchFn }: UseMatchOperationsOptions = {}): UseMatchOperations {
  const { addToast } = useToast();

  const deleteWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        if (deleteMatchFn) {
          await deleteMatchFn(id);
        } else {
          await matchApi.deleteMatch(id);
        }
        addToast(TOAST_TYPES.SUCCESS, 'Match deleted');
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to delete match');
      }
    },
    [addToast, deleteMatchFn]
  );

  const retryWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        await matchApi.retryProcessing(id);
        addToast(TOAST_TYPES.SUCCESS, 'Match assessment queued for retry');
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to retry match assessment');
      }
    },
    [addToast]
  );

  const writeMasterFileWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        await matchApi.writeMasterFile(id);
        addToast(TOAST_TYPES.SUCCESS, 'Match master file written');
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to write match master file');
      }
    },
    [addToast]
  );

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

  const fetchMasterFileWithToast = useCallback(
    async (id: number): Promise<string> => {
      try {
        const content = await matchApi.getMasterFile(id);
        addToast(TOAST_TYPES.SUCCESS, 'Match master file refreshed');
        return content || '';
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to fetch match master file');
        throw err;
      }
    },
    [addToast]
  );

  return {
    deleteWithToast,
    retryWithToast,
    writeMasterFileWithToast,
    downloadPdfWithToast,
    fetchMasterFileWithToast
  };
}