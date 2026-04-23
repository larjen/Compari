'use client';

/**
 * @module useEntityOperations
 * @description Centralized hook for entity mutations with standardized UI toast feedback.
 * @responsibility
 * - Consolidates duplicate bulk-file upload loops and toast-wrapped mutation handlers
 * - Provides single source of truth for entity operations across Requirements and Offerings pages
 * - Prevents WET (Write Everything Twice) violations and SoC (Separation of Concerns) breaches
 * @boundary_rules
 * - ❌ MUST NOT contain UI rendering logic (JSX)
 * - ❌ MUST NOT use inline string unions (use EntityType from @/lib/types, TOAST_TYPES from @/lib/constants)
 * - ✅ MUST use useToast hook for all notification feedback
 * - ✅ MUST expose onSuccess callbacks for caller-driven refetch
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { entityApi, CreateEntityData } from '@/lib/api/entityApi';
import { EntityType } from '@/lib/types';
import { TOAST_TYPES } from '@/lib/constants';

interface UseEntityOperationsOptions {
  /** Delete function from useEntities hook (includes refetch internally) */
  deleteEntityFn?: (id: number) => Promise<void>;
}

interface UseEntityOperations {
  bulkCreateFromFiles: (
    files: File[],
    entityType: EntityType,
    blueprintId: number | undefined,
    pluralLabel: string,
    onSuccess: () => void
  ) => Promise<void>;
  deleteWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  retryWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  updateWithToast: (id: number, data: Partial<CreateEntityData>, successMessage?: string) => Promise<void>;
  writeMasterFileWithToast: (id: number, onSuccess: () => void) => Promise<void>;
  openFolderWithToast: (id: number) => Promise<void>;
  fetchMasterFileWithToast: (id: number) => Promise<string>;
}

export function useEntityOperations({ deleteEntityFn }: UseEntityOperationsOptions = {}): UseEntityOperations {
  const { addToast } = useToast();

  const bulkCreateFromFiles = useCallback(
    async (
      files: File[],
      entityType: EntityType,
      blueprintId: number | undefined,
      pluralLabel: string,
      onSuccess: () => void
    ): Promise<void> => {
      let successCount = 0;
      let failCount = 0;
      const labelPlural = pluralLabel.toLowerCase();

      setTimeout(async () => {
        try {
          for (const file of files) {
            try {
              const name = file.name.replace(/\.[^/.]+$/, '');
              const data: CreateEntityData = {
                type: entityType,
                name,
                blueprintId,
              };
              const entityId = await entityApi.createEntity(data);
              await entityApi.uploadFile(entityId, file);
              successCount++;
            } catch (fileErr) {
              failCount++;
            }
          }

          if (successCount > 0) {
            addToast(TOAST_TYPES.SUCCESS, `Successfully created ${successCount} ${labelPlural}`);
          }
          if (failCount > 0) {
            addToast(TOAST_TYPES.ERROR, `Failed to create ${failCount} ${labelPlural}`);
          }

          if (successCount > 0) {
            setTimeout(() => onSuccess(), 1000);
          }
        } catch (err: any) {
          addToast(TOAST_TYPES.ERROR, err.message || 'Failed to create entities');
          throw err;
        }
      }, 300);
    },
    [addToast]
  );

  const deleteWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        if (deleteEntityFn) {
          await deleteEntityFn(id);
        } else {
          await entityApi.deleteEntity(id);
        }
        addToast(TOAST_TYPES.SUCCESS, 'Entity deleted');
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to delete entity');
      }
    },
    [addToast, deleteEntityFn]
  );

  const retryWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        await entityApi.retryProcessing(id);
        addToast(TOAST_TYPES.SUCCESS, 'Task queued for retry');
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to retry task');
      }
    },
    [addToast]
  );

  const updateWithToast = useCallback(
    async (id: number, data: Partial<CreateEntityData>, successMessage = 'Updated successfully'): Promise<void> => {
      try {
        await entityApi.updateEntity(id, data);
        addToast(TOAST_TYPES.SUCCESS, successMessage);
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to update entity');
        throw err;
      }
    },
    [addToast]
  );

  const writeMasterFileWithToast = useCallback(
    async (id: number, onSuccess: () => void): Promise<void> => {
      try {
        await entityApi.writeMasterFile(id);
        addToast(TOAST_TYPES.SUCCESS, 'Master file written');
        onSuccess();
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to write master file');
      }
    },
    [addToast]
  );

  const openFolderWithToast = useCallback(
    async (id: number): Promise<void> => {
      try {
        await entityApi.openFolder(id);
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to open folder on server');
      }
    },
    [addToast]
  );

  const fetchMasterFileWithToast = useCallback(
    async (id: number): Promise<string> => {
      try {
        const content = await entityApi.getMasterFile(id);
        addToast(TOAST_TYPES.SUCCESS, 'Master file refreshed');
        return content || '';
      } catch (err) {
        addToast(TOAST_TYPES.ERROR, 'Failed to fetch master file');
        throw err;
      }
    },
    [addToast]
  );

  return {
    bulkCreateFromFiles,
    deleteWithToast,
    retryWithToast,
    updateWithToast,
    writeMasterFileWithToast,
    openFolderWithToast,
    fetchMasterFileWithToast
  };
}