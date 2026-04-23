'use client';

/**
 * @module useCriterionOperations
 * @description Centralized hook for criterion mutations with standardized UI toast feedback.
 * @responsibility
 * - Consolidates toast-wrapped mutation handlers for criterion operations.
 * - Provides single source of truth for criterion operations across the app.
 * - Prevents WET violations and SoC breaches in criterion-related components.
 * @boundary_rules
 * - ❌ MUST NOT contain UI rendering logic (JSX)
 * - ✅ MUST use useToast hook for all notification feedback
 * - ✅ MUST expose onSuccess callbacks for caller-driven refetch
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { criteriaApi } from '@/lib/api/criteriaApi';
import { TOAST_TYPES } from '@/lib/constants';

interface UseCriterionOperationsOptions {
  /** Delete function from useCriteria hook (includes refetch internally) */
  deleteCriterionFn?: (id: number) => Promise<void>;
}

interface UseCriterionOperations {
  deleteWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  writeMasterFileWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  fetchMasterFileWithToast: (id: number) => Promise<string>;
  openFolderWithToast: (id: number) => Promise<void>;
}

export function useCriterionOperations({ deleteCriterionFn }: UseCriterionOperationsOptions = {}): UseCriterionOperations {
  const { addToast } = useToast();

  const deleteWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        if (deleteCriterionFn) {
          await deleteCriterionFn(id);
        } else {
          await criteriaApi.deleteCriterion(id);
        }
        addToast(TOAST_TYPES.SUCCESS, 'Criterion deleted');
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to delete criterion');
      }
    },
    [addToast, deleteCriterionFn]
  );

  const writeMasterFileWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        await criteriaApi.writeMasterFile(id);
        addToast(TOAST_TYPES.SUCCESS, 'Master file written');
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to write master file');
      }
    },
    [addToast]
  );

  const fetchMasterFileWithToast = useCallback(
    async (id: number): Promise<string> => {
      try {
        const content = await criteriaApi.getMasterFile(id);
        addToast(TOAST_TYPES.SUCCESS, 'Master file refreshed');
        return content;
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to fetch master file');
        throw err;
      }
    },
    [addToast]
  );

  const openFolderWithToast = useCallback(
    async (id: number): Promise<void> => {
      try {
        await criteriaApi.openFolder(id);
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to open folder on server');
      }
    },
    [addToast]
  );

  return {
    deleteWithToast,
    writeMasterFileWithToast,
    fetchMasterFileWithToast,
    openFolderWithToast
  };
}