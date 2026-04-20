/**
 * @fileoverview Custom hook for managing prompts with refetch capability.
 * @description Provides state management and API interactions for prompts.
 * @responsibility
 * - Fetches prompts using useSafeFetch (race condition prevention).
 * - Provides updatePrompt function that calls API and refetches.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - Uses promptApi for all data operations.
 * @separation_of_concerns
 * - HTTP layer: useSafeFetch handles race condition prevention, loading/error states.
 * - Domain layer: This hook wraps HTTP layer with prompt-specific operations.
 */
'use client';

import { useCallback } from 'react';
import { Prompt } from '@/lib/types';
import { promptApi } from '@/lib/api/promptApi';
import { useSafeFetch } from './useSafeFetch';

interface UsePromptsReturn {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updatePrompt: (id: number, text: string) => Promise<void>;
}

export function usePrompts(immediate: boolean = true): UsePromptsReturn {
  const fetchPrompts = useCallback(async () => {
    return promptApi.getPrompts();
  }, []);

  const { data, loading, error, execute: refetch } = useSafeFetch<Prompt[]>(fetchPrompts, immediate);

  const updatePrompt = useCallback(async (id: number, text: string) => {
    await promptApi.updatePrompt(id, text);
    await refetch();
  }, [refetch]);

  return {
    prompts: data ?? [],
    loading,
    error,
    refetch,
    updatePrompt
  };
}