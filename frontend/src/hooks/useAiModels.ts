/**
 * @fileoverview Custom hook for managing AI models.
 * @description Provides state management and API interactions for AI models.
 * @responsibility
 * - Fetches AI models using useSafeFetch (race condition prevention).
 * - Provides CRUD and operational functions (createModel, updateModel, deleteModel, setActiveModel, testConnection).
 * - Provides refetch capability for manual data refresh.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - Uses aiModelApi for all data operations.
 * @separation_of_concerns
 * - HTTP layer: useSafeFetch handles race condition prevention, loading/error states.
 * - Domain layer: This hook wraps HTTP layer with AI model-specific operations.
 */
'use client';

import { useCallback } from 'react';
import { AiModel, AiModelRole } from '@/lib/types';
import { aiModelApi } from '@/lib/api/aiModelApi';
import { useSafeFetch } from './useSafeFetch';
import { AI_MODEL_ROLES } from '@/lib/constants';

interface UseAiModelsReturn {
  models: AiModel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createModel: (modelData: {
    name: string;
    model_identifier: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: AiModelRole;
    temperature?: number | null;
    contextWindow?: number | null;
  }) => Promise<void>;
  updateModel: (id: number, modelData: {
    name?: string;
    model_identifier?: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: AiModelRole;
    temperature?: number | null;
    contextWindow?: number | null;
  }) => Promise<void>;
  deleteModel: (id: number) => Promise<void>;
  setActiveModel: (id: number) => Promise<void>;
  testConnection: (data: {
    model_identifier: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: typeof AI_MODEL_ROLES.CHAT | typeof AI_MODEL_ROLES.EMBEDDING;
  }) => Promise<{ success: boolean; message?: string }>;
}

export function useAiModels(immediate: boolean = true): UseAiModelsReturn {
  const fetchModels = useCallback(async () => {
    return aiModelApi.getModels();
  }, []);

  const { data, loading, error, execute: refetch } = useSafeFetch<AiModel[]>(fetchModels, immediate);

  const createModel = useCallback(async (modelData: {
    name: string;
    model_identifier: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: AiModelRole;
    temperature?: number | null;
    contextWindow?: number | null;
  }) => {
    await aiModelApi.createModel(modelData);
    await refetch();
  }, [refetch]);

  const updateModel = useCallback(async (id: number, modelData: {
    name?: string;
    model_identifier?: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: AiModelRole;
    temperature?: number | null;
    contextWindow?: number | null;
  }) => {
    await aiModelApi.updateModel(id, modelData);
    await refetch();
  }, [refetch]);

  const deleteModel = useCallback(async (id: number) => {
    await aiModelApi.deleteModel(id);
    await refetch();
  }, [refetch]);

  const setActiveModel = useCallback(async (id: number) => {
    await aiModelApi.setActiveModel(id);
    await refetch();
  }, [refetch]);

  const testConnection = useCallback(async (data: {
    model_identifier: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: typeof AI_MODEL_ROLES.CHAT | typeof AI_MODEL_ROLES.EMBEDDING;
  }) => {
    return aiModelApi.testConnection(data);
  }, []);

  return {
    models: data ?? [],
    loading,
    error,
    refetch,
    createModel,
    updateModel,
    deleteModel,
    setActiveModel,
    testConnection,
  };
}