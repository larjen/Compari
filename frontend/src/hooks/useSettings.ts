/**
 * @fileoverview Custom hook for managing application settings.
 * @description Provides state management and API interactions for application settings.
 * @responsibility
 * - Fetches settings using useSafeFetch (race condition prevention).
 * - Provides updateSetting for persisting settings changes.
 * - Provides refetch capability for manual data refresh.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - Uses settingsApi for all data operations.
 * @separation_of_concerns
 * - HTTP layer: useSafeFetch handles race condition prevention, loading/error states.
 * - Domain layer: This hook wraps HTTP layer with settings-specific operations.
 */
'use client';

import { useCallback } from 'react';
import { Settings } from '@/lib/types';
import { settingsApi } from '@/lib/api/settingsApi';
import { useSafeFetch } from './useSafeFetch';

interface UseSettingsReturn {
  settings: Settings;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
}

export function useSettings(immediate: boolean = true): UseSettingsReturn {
  const fetchSettings = useCallback(async () => {
    return settingsApi.getSettings();
  }, []);

  const { data, loading, error, execute: refetch } = useSafeFetch<Settings>(fetchSettings, immediate);

  const updateSetting = useCallback(async (key: string, value: string) => {
    await settingsApi.updateSetting(key, value);
    await refetch();
  }, [refetch]);

  return {
    settings: data ?? {
      ollama_host: '',
      ollama_model: '',
    },
    loading,
    error,
    refetch,
    updateSetting,
  };
}