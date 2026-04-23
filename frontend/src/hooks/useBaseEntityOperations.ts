'use client';

/**
 * @module useBaseEntityOperations
 * @description Centralized base hook for common entity mutations with standardized UI toast feedback.
 * @responsibility
 * - Consolidates duplicate toast-wrapped mutation handlers common to all entity types (Entities, Matches, Criteria)
 * - Provides single source of truth for common operations: delete, retry, writeMasterFile, fetchMasterFile, openFolder
 * - Enforces DRY (Don't Repeat Yourself) principle by centralizing shared logic
 * - Ensures toast notifications fire exactly ONCE per operation
 * @boundary_rules
 * - ❌ MUST NOT contain UI rendering logic (JSX)
 * - ❌ MUST NOT contain entity-specific operations (e.g., bulkCreateFromFiles, downloadPdf)
 * - ✅ MUST use useToast hook for all notification feedback
 * - ✅ MUST expose onSuccess callbacks for caller-driven refetch
 * - ✅ MUST accept an API client and entity label for dynamic toast messages
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { TOAST_TYPES } from '@/lib/constants';

interface ApiClient {
  deleteEntity?: (id: number) => Promise<void>;
  deleteMatch?: (id: number) => Promise<void>;
  deleteCriterion?: (id: number) => Promise<void>;
  retryProcessing?: (id: number) => Promise<void>;
  writeMasterFile?: (id: number) => Promise<void>;
  getMasterFile?: (id: number) => Promise<string>;
  openFolder?: (id: number) => Promise<void>;
}

interface UseBaseEntityOperationsOptions {
  /** The API client instance (entityApi, matchApi, or criteriaApi) */
  apiClient: ApiClient;
  /** The entity type label for toast messages (e.g., 'Entity', 'Match', 'Criterion') */
  entityLabel: string;
  /** Optional custom delete function that includes refetch internally */
  deleteFn?: (id: number) => Promise<void>;
}

interface UseBaseEntityOperations {
  deleteWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  retryWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  writeMasterFileWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  fetchMasterFileWithToast: (id: number) => Promise<string>;
  openFolderWithToast: (id: number) => Promise<void>;
}

export function useBaseEntityOperations({
  apiClient,
  entityLabel,
  deleteFn
}: UseBaseEntityOperationsOptions): UseBaseEntityOperations {
  const { addToast } = useToast();

  const deleteWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        if (deleteFn) {
          await deleteFn(id);
        } else if (apiClient.deleteEntity) {
          await apiClient.deleteEntity(id);
        } else if (apiClient.deleteMatch) {
          await apiClient.deleteMatch(id);
        } else if (apiClient.deleteCriterion) {
          await apiClient.deleteCriterion(id);
        }
        addToast(TOAST_TYPES.SUCCESS, `${entityLabel} deleted`);
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, `Failed to delete ${entityLabel.toLowerCase()}`);
      }
    },
    [addToast, apiClient, entityLabel, deleteFn]
  );

  const retryWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        if (apiClient.retryProcessing) {
          await apiClient.retryProcessing(id);
        }
        addToast(TOAST_TYPES.SUCCESS, `${entityLabel} queued for retry`);
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, `Failed to retry ${entityLabel.toLowerCase()}`);
      }
    },
    [addToast, apiClient, entityLabel]
  );

  const writeMasterFileWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        if (apiClient.writeMasterFile) {
          await apiClient.writeMasterFile(id);
        }
        addToast(TOAST_TYPES.SUCCESS, `${entityLabel} master file written`);
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, `Failed to write ${entityLabel.toLowerCase()} master file`);
      }
    },
    [addToast, apiClient, entityLabel]
  );

  const fetchMasterFileWithToast = useCallback(
    async (id: number): Promise<string> => {
      try {
        if (apiClient.getMasterFile) {
          const content = await apiClient.getMasterFile(id);
          return content || '';
        }
        return '';
      } catch (err) {
        console.error(`Failed to fetch ${entityLabel.toLowerCase()} master file`, err);
        throw err;
      }
    },
    [apiClient, entityLabel]
  );

  const openFolderWithToast = useCallback(
    async (id: number): Promise<void> => {
      try {
        if (apiClient.openFolder) {
          await apiClient.openFolder(id);
        }
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to open folder on server');
      }
    },
    [addToast, apiClient]
  );

  return {
    deleteWithToast,
    retryWithToast,
    writeMasterFileWithToast,
    fetchMasterFileWithToast,
    openFolderWithToast
  };
}