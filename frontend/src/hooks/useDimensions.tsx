'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useSafeFetch } from './useSafeFetch';
import { dimensionApi, CreateDimensionData, UpdateDimensionData } from '@/lib/api/dimensionApi';
import { Dimension } from '@/lib/types';

export interface UseDimensionsReturn {
  dimensions: Dimension[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addDimension: (data: CreateDimensionData) => Promise<number>;
  updateDimension: (id: number, data: UpdateDimensionData) => Promise<void>;
  deleteDimension: (id: number) => Promise<void>;
  toggleDimension: (id: number) => Promise<boolean>;
}

const DimensionContext = createContext<UseDimensionsReturn | undefined>(undefined);

export function DimensionProvider({ children }: { children: ReactNode }) {
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

  const value = {
    dimensions: data || [],
    loading,
    error,
    refetch,
    addDimension,
    updateDimension,
    deleteDimension,
    toggleDimension,
  };

  return <DimensionContext.Provider value={value}>{children}</DimensionContext.Provider>;
}

export function useDimensions(): UseDimensionsReturn {
  const context = useContext(DimensionContext);
  if (!context) {
    throw new Error('useDimensions must be used within a DimensionProvider');
  }
  return context;
}