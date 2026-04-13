/**
 * @fileoverview Custom hook for managing Blueprint state with race condition prevention.
 * @description Provides centralized state management for blueprint CRUD operations.
 * @responsibility
 * - Manages blueprint data, loading, and error states.
 * - Provides CRUD methods for blueprint operations.
 * - Uses useSafeFetch for race condition prevention.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT make direct database calls.
 * - All requests go through the blueprintApi.
 * @example
 * const { blueprints, loading, error, addBlueprint, updateBlueprint, deleteBlueprint, refetch } = useBlueprints();
 */
'use client';

import { useCallback } from 'react';
import { useSafeFetch } from './useSafeFetch';
import { useSSE } from './useSSE';
import { blueprintApi, CreateBlueprintData, UpdateBlueprintData } from '@/lib/api/blueprintApi';
import { Blueprint } from '@/lib/types';

export interface UseBlueprintsReturn {
  /** Array of Blueprint objects */
  blueprints: Blueprint[];
  /** Whether a fetch operation is currently in progress */
  loading: boolean;
  /** Error message if the fetch or mutation failed */
  error: string | null;
  /** Function to manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Function to create a new blueprint */
  addBlueprint: (data: CreateBlueprintData) => Promise<number>;
  /** Function to update an existing blueprint */
  updateBlueprint: (id: number, data: UpdateBlueprintData) => Promise<void>;
  /** Function to delete a blueprint */
  deleteBlueprint: (id: number) => Promise<void>;
  /** Function to set a blueprint as active */
  setActiveBlueprint: (id: number) => Promise<void>;
}

/**
 * Custom hook for managing Blueprint state and CRUD operations.
 * @param {('requirement' | 'offering' | null)} [role] - Optional role filter for fetching blueprints.
 * @returns {UseBlueprintsReturn} Object containing blueprints, loading, error states and CRUD functions.
 */
export function useBlueprints(role?: 'requirement' | 'offering'): UseBlueprintsReturn {
  const fetcher = useCallback(() => blueprintApi.getBlueprints(role), [role]);

  const { data, loading, error, execute: refetch } = useSafeFetch<Blueprint[]>(fetcher, true);

  const handleBlueprintUpdate = useCallback(() => {
    refetch();
  }, [refetch]);

  useSSE({
    onBlueprintUpdate: handleBlueprintUpdate
  });

  const addBlueprint = useCallback(async (data: CreateBlueprintData): Promise<number> => {
    const blueprintId = await blueprintApi.createBlueprint(data);
    await refetch();
    return blueprintId;
  }, [refetch]);

  const updateBlueprint = useCallback(async (id: number, data: UpdateBlueprintData): Promise<void> => {
    await blueprintApi.updateBlueprint(id, data);
    await refetch();
  }, [refetch]);

  const deleteBlueprint = useCallback(async (id: number): Promise<void> => {
    await blueprintApi.deleteBlueprint(id);
    await refetch();
  }, [refetch]);

  const setActiveBlueprint = useCallback(async (id: number): Promise<void> => {
    await blueprintApi.setActiveBlueprint(id);
    await refetch();
  }, [refetch]);

  return {
    blueprints: data || [],
    loading,
    error,
    refetch,
    addBlueprint,
    updateBlueprint,
    deleteBlueprint,
    setActiveBlueprint,
  };
}