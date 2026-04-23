'use client';

/**
 * @module useCriterionOperations
 * @description Centralized hook for criterion mutations with standardized UI toast feedback.
 * @responsibility
 * - Consolidates toast-wrapped mutation handlers for criterion operations.
 * - Provides single source of truth for criterion operations across the app.
 * - Prevents WET violations and SoC breaches in criterion-related components.
 * - Inherits common operations from useBaseEntityOperations hook
 * @boundary_rules
 * - ❌ MUST NOT contain UI rendering logic (JSX)
 * - ✅ MUST use useToast hook for all notification feedback
 * - ✅ MUST expose onSuccess callbacks for caller-driven refetch
 * - ✅ MUST use useBaseEntityOperations for common delete, writeMasterFile, fetchMasterFile, openFolder
 */

import { useBaseEntityOperations } from './useBaseEntityOperations';
import { useToast } from './useToast';
import { criteriaApi } from '@/lib/api/criteriaApi';
import { TOAST_TYPES } from '@/lib/constants';

interface UseCriterionOperationsOptions {
  /** Delete function from useCriteria hook (includes refetch internally) */
  deleteCriterionFn?: (id: number) => Promise<void>;
  /** Callback to invoke on successful operations */
  onSuccess?: () => void;
}

interface UseCriterionOperations {
  deleteWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  writeMasterFileWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  fetchMasterFileWithToast: (id: number) => Promise<string>;
  openFolderWithToast: (id: number) => Promise<void>;
  createWithToast: (displayName: string, dimension: string, requirementId?: number, offeringId?: number, onSuccess?: () => void) => Promise<void>;
}

export function useCriterionOperations({ deleteCriterionFn, onSuccess }: UseCriterionOperationsOptions = {}): UseCriterionOperations {
  const baseOps = useBaseEntityOperations({
    apiClient: criteriaApi,
    entityLabel: 'Criterion',
    deleteFn: deleteCriterionFn
  });

  const { addToast } = useToast();

  const createWithToast = async (
    displayName: string,
    dimension: string,
    requirementId?: number,
    offeringId?: number,
    onSuccess?: () => void
  ) => {
    try {
      await criteriaApi.create(displayName, dimension, requirementId, offeringId);
      addToast(TOAST_TYPES.SUCCESS, 'Criterion created successfully');
      onSuccess?.();
    } catch (error) {
      addToast(TOAST_TYPES.ERROR, 'Failed to create criterion');
      throw error;
    }
  };

  return {
    deleteWithToast: baseOps.deleteWithToast,
    writeMasterFileWithToast: baseOps.writeMasterFileWithToast,
    fetchMasterFileWithToast: baseOps.fetchMasterFileWithToast,
    openFolderWithToast: baseOps.openFolderWithToast,
    createWithToast
  };
}