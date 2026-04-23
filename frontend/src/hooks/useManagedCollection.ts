/**
 * @fileoverview Generic hook for orchestrating collection lifecycle with fetch, SSE, and watchdog coordination.
 * @description Provides reusable state management for paginated collections that need real-time updates and processing watchdog.
 * @responsibility
 * - Orchestrates useSafeFetch, useSSE, and useProcessingWatchdog into a single cohesive lifecycle.
 * - Prevents WET (Write Everything Twice) implementations by centralizing common collection patterns.
 * - Automatically resolves status query strings using STATUS_GROUPS when a status group is provided.
 * - Provides generic extraction of items from API responses with proper typing.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - ❌ MUST NOT contain domain-specific CRUD operations (those belong in domain hooks).
 * - ✅ MUST provide generic types for API response and item types.
 * - ✅ MUST allow domain hooks to pass their own SSE event handlers.
 * - ✅ MUST allow domain hooks to extend with their specific CRUD operations.
 * @separation_of_concerns
 * This hook implements the "Lifecycle Orchestrator" pattern by:
 * 1. Fetching data via useSafeFetch with optional status resolution
 * 2. Setting up SSE listeners for real-time updates
 * 3. Running a watchdog to prevent stale processing states
 * Domain hooks (useEntities, useMatches) should:
 * - Import useManagedCollection
 * - Define their fetch function wrapper
 * - Define their SSE config
 * - Extend with domain-specific CRUD operations
 * @module useManagedCollection
 */
'use client';

import { useCallback } from 'react';
import { useSafeFetch } from './useSafeFetch';
import { useSSE } from './useSSE';
import { useProcessingWatchdog } from './useProcessingWatchdog';
import { STATUS_GROUPS } from '@/lib/constants';
import { SSEEntityUpdate, SSEMatchUpdate } from '@/lib/types';

/**
 * Configuration for the fetch function.
 */
interface ManagedCollectionFetchConfig {
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Search query string */
  search?: string;
  /** Status filter (can be a status group key or raw status string) */
  status?: string;
  /** Additional params specific to the collection */
  [key: string]: unknown;
}

/**
 * SSE event handlers configuration.
 */
interface ManagedCollectionSSEConfig {
  /** Handler for entity update events */
  onEntityUpdate?: (data: SSEEntityUpdate) => void;
  /** Handler for match update events */
  onMatchUpdate?: (data: SSEMatchUpdate) => void;
}

/**
 * Watchdog configuration options.
 */
interface ManagedCollectionWatchdogConfig {
  /** Whether to enable the processing watchdog (default: true) */
  enabled?: boolean;
}

/**
 * Options for configuring the managed collection hook.
 * @template T - The API response type containing the items array.
 * @template I - The individual item type in the collection.
 */
interface UseManagedCollectionOptions<T, I> {
  /** The fetch function that returns the API response */
  fetchFn: () => Promise<T>;
  /** Function to extract the items array from the API response */
  extractItems: (response: T | null) => I[];
  /** Configuration for SSE event handlers */
  sseConfig?: ManagedCollectionSSEConfig;
  /** Configuration for the processing watchdog */
  watchdogConfig?: ManagedCollectionWatchdogConfig | boolean;
  /** Whether to immediately fetch on mount (default: true) */
  immediate?: boolean;
}

/**
 * Return type for the useManagedCollection hook.
 * @template T - The API response type.
 * @template I - The individual item type.
 */
interface UseManagedCollectionReturn<T, I> {
  /** The raw API response data */
  data: T | null;
  /** The extracted items array */
  items: I[];
  /** Whether a fetch operation is in progress */
  loading: boolean;
  /** Error message if the fetch failed */
  error: string | null;
  /** Function to manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Total number of pages (derived from response metadata) */
  totalPages: number;
}

/**
 * Utility function to resolve status to API query string format.
 * @param status - The status string (can be a group key like 'processing' or raw status)
 * @returns The resolved status string for the API query
 */
function resolveStatus(status?: string): string | undefined {
  if (!status) return undefined;
  if (STATUS_GROUPS[status]) {
    return STATUS_GROUPS[status].join(',');
  }
  return status;
}

/**
 * Custom hook for managing collection lifecycle with integrated fetch, SSE, and watchdog.
 * @template T - The API response type containing the items array.
 * @template I - The individual item type in the collection.
 * @param {UseManagedCollectionOptions<T, I>} options - Configuration options.
 * @returns {UseManagedCollectionReturn<T, I>} Collection data and state.
 * @description
 * This hook orchestrates three lifecycle components:
 * 1. useSafeFetch - Manages HTTP state with race condition prevention
 * 2. useSSE - Handles real-time updates via Server-Sent Events
 * 3. useProcessingWatchdog - Triggers refetch if items stay in processing state too long
 *
 * The hook automatically resolves status group keys (like 'processing') to their
 * constituent status values before passing to the fetch function.
 */
export function useManagedCollection<T extends { meta?: { totalPages?: number } }, I>(
  options: UseManagedCollectionOptions<T, I>
): UseManagedCollectionReturn<T, I> {
  const { fetchFn, extractItems, sseConfig, watchdogConfig, immediate = true } = options;

  const { data, loading, error, execute: refetch } = useSafeFetch<T>(fetchFn, immediate);

  const items = extractItems(data) ?? [];
  const totalPages = data?.meta?.totalPages ?? 0;

  const resolvedWatchdogConfig = watchdogConfig === true
    ? { enabled: true }
    : watchdogConfig === false
      ? { enabled: false }
      : watchdogConfig ?? { enabled: true };

  useSSE({
    onEntityUpdate: sseConfig?.onEntityUpdate,
    onMatchUpdate: sseConfig?.onMatchUpdate,
    onReconnect: fetchFn
  });

  useProcessingWatchdog(
    resolvedWatchdogConfig.enabled ? items : null,
    'status' as keyof I,
    STATUS_GROUPS.processing,
    refetch
  );

  return {
    data,
    items,
    loading,
    error,
    refetch,
    totalPages,
  };
}

/**
 * Utility hook that wraps a fetch function with automatic status resolution.
 * @template T - The API response type.
 * @param fetchFn - The fetch function to wrap.
 * @param params - The parameters including optional status.
 * @returns A new fetch function with status resolution applied.
 * @description
 * This utility handles the common pattern of converting status group keys
 * (like 'processing', 'completed', 'failed') to their constituent status values
 * before making the API call. This prevents duplication across domain hooks.
 */
function createStatusResolvedFetch<T>(
  fetchFn: (params: { status?: string }) => Promise<T>,
  getParams: () => { status?: string }
): () => Promise<T> {
  return useCallback(() => {
    const { status } = getParams();
    const resolvedStatus = resolveStatus(status);
    return fetchFn({ status: resolvedStatus });
  }, [fetchFn, getParams]);
}

export { resolveStatus };