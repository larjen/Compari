'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useSafeFetch } from './useSafeFetch';
import { useSSE } from './useSSE';
import { blueprintApi, CreateBlueprintData, UpdateBlueprintData } from '@/lib/api/blueprintApi';
import { Blueprint } from '@/lib/types';

export interface UseBlueprintsReturn {
  blueprints: Blueprint[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addBlueprint: (data: CreateBlueprintData) => Promise<number>;
  updateBlueprint: (id: number, data: UpdateBlueprintData) => Promise<void>;
  deleteBlueprint: (id: number) => Promise<void>;
  setActiveBlueprint: (id: number) => Promise<void>;
}

const BlueprintContext = createContext<UseBlueprintsReturn | undefined>(undefined);

export function BlueprintProvider({ children }: { children: ReactNode }) {
  const fetcher = useCallback(() => blueprintApi.getBlueprints(), []);
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

  const value = {
    blueprints: data || [],
    loading,
    error,
    refetch,
    addBlueprint,
    updateBlueprint,
    deleteBlueprint,
    setActiveBlueprint,
  };

  return <BlueprintContext.Provider value={value}>{children}</BlueprintContext.Provider>;
}

export function useBlueprints(): UseBlueprintsReturn {
  const context = useContext(BlueprintContext);
  if (!context) {
    throw new Error('useBlueprints must be used within a BlueprintProvider');
  }
  return context;
}
