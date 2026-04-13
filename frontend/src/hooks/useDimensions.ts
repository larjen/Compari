/**
 * @fileoverview Custom hook for managing Dimension state with race condition prevention.
 * @description Provides centralized state management for dimension CRUD operations.
 * @responsibility
 * - Manages dimension data, loading, and error states.
 * - Provides CRUD methods for dimension operations.
 * - Uses useSafeFetch for race condition prevention.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT make direct database calls.
 * - All requests go through the dimensionApi.
 * @example
 * const { dimensions, loading, error, addDimension, updateDimension, deleteDimension, toggleDimension, refetch } = useDimensions();
 */
'use client';

import { useCallback } from 'react';
import { useSafeFetch } from './useSafeFetch';
import { dimensionApi, CreateDimensionData, UpdateDimensionData } from '@/lib/api/dimensionApi';
import { Dimension } from '@/lib/types';

export interface UseDimensionsReturn {
  /** Array of Dimension objects */
  dimensions: Dimension[];
  /** Whether a fetch operation is currently in progress */
  loading: boolean;
  /** Error message if the fetch or mutation failed */
  error: string | null;
  /** Function to manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Function to create a new dimension */
  addDimension: (data: CreateDimensionData) => Promise<number>;
  /** Function to update an existing dimension */
  updateDimension: (id: number, data: UpdateDimensionData) => Promise<void>;
  /** Function to delete a dimension */
  deleteDimension: (id: number) => Promise<void>;
  /** Function to toggle dimension active status */
  toggleDimension: (id: number) => Promise<boolean>;
}

/**
 * Custom hook for managing Dimension state and CRUD operations.
 * @returns {UseDimensionsReturn} Object containing dimensions, loading, error states and CRUD functions.
 */
export function useDimensions(): UseDimensionsReturn {
  const fetcher = useCallback(() => dimensionApi.getDimensions(), []);

  const { data, loading, error, execute: refetch } = useSafeFetch<Dimension[]>(fetcher, true);

  const addDimension = useCallback(async (data: CreateDimensionData): Promise<number> => {
    const dimensionId = await dimensionApi.createDimension(data);
    await refetch();
    return dimensionId;
  }, [refetch]);

  const updateDimension = useCallback(async (id: number, data: UpdateDimensionData): Promise<void> => {
    await dimensionApi.updateDimension(id, data);
    await refetch();
  }, [refetch]);

  const deleteDimension = useCallback(async (id: number): Promise<void> => {
    await dimensionApi.deleteDimension(id);
    await refetch();
  }, [refetch]);

  const toggleDimension = useCallback(async (id: number): Promise<boolean> => {
    const newStatus = await dimensionApi.toggleActive(id);
    await refetch();
    return newStatus;
  }, [refetch]);

  return {
    dimensions: data || [],
    loading,
    error,
    refetch,
    addDimension,
    updateDimension,
    deleteDimension,
    toggleDimension,
  };
}