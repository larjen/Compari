// src/hooks/useCriteria.ts
/**
 * @fileoverview Custom hook for managing criteria with server-side pagination and filtering.
 * @description Provides state management and API interactions for criteria.
 * @responsibility
 * - Fetches criteria with pagination, search, and dimension filtering.
 * - Uses useSafeFetch for HTTP state management (avoids duplicating loading/error/race condition logic).
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - Uses criteriaApi for all data operations.
 * @separation_of_concerns
 * - HTTP layer: useSafeFetch handles race condition prevention, loading/error states.
 * - Domain layer: This hook wraps HTTP layer with domain-specific business logic.
 */
'use client';

import { useCallback, useMemo } from 'react';
import { Criterion } from '@/lib/types';
import { criteriaApi, GetCriteriaParams, PaginatedCriteriaResponse } from '@/lib/api/criteriaApi';
import { useSafeFetch } from './useSafeFetch';

/**
 * Query parameters for the useCriteria hook.
 */
export interface UseCriteriaParams extends GetCriteriaParams {
  /** Whether to automatically fetch on mount. Default: true */
  immediate?: boolean;
}

/**
 * Return type for the useCriteria hook.
 */
export interface UseCriteriaReturn {
  /** Array of criteria for the current page. */
  criteria: Criterion[];
  /** Total number of pages available. */
  totalPages: number;
  /** Total count of criteria matching the filters. */
  totalCount: number;
  /** Whether a fetch operation is in progress. */
  loading: boolean;
  /** Error message if the fetch failed, or null. */
  error: string | null;
  /** Function to manually trigger a refetch. */
  refetch: () => Promise<void>;
  /** Alias for refetch for API compatibility. */
  fetchCriteria: () => Promise<void>;
  /** Function to delete a criterion and refetch. */
  deleteCriterion: (id: number) => Promise<void>;
}

/**
 * Custom hook for fetching criteria with server-side pagination and filtering.
 * 
 * @param {UseCriteriaParams} params - Query parameters including page, limit, search, dimension, and immediate.
 * @returns {UseCriteriaReturn} Object containing criteria, pagination info, loading state, error, and functions.
 * 
 * @critical_sorting_rule
 * This hook relies on server-side sorting by dimension (alphabetically, nulls/uncategorized as last),
 * then by displayName (alphabetically). The grouping logic on the frontend assumes this ordering.
 * 
 * @example
 * const { criteria, totalPages, loading, error } = useCriteria({
 *   page: 1,
 *   limit: 200,
 *   search: 'react',
 *   dimension: 'core_competencies'
 * });
 */
export function useCriteria(params: UseCriteriaParams = {}): UseCriteriaReturn {
  const { page = 1, limit = 200, search, dimension, immediate = true } = params;

  const fetchCriteria = useCallback(async () => {
    return criteriaApi.getAllCriteria({ page, limit, search, dimension });
  }, [page, limit, search, dimension]);

  const { data, loading, error, execute: refetch } = useSafeFetch<PaginatedCriteriaResponse>(fetchCriteria, immediate);

  const deleteCriterion = useCallback(async (id: number) => {
    await criteriaApi.deleteCriterion(id);
    await refetch();
  }, [refetch]);

  const memoizedResult = useMemo(() => ({
    criteria: data?.criteria ?? [],
    totalPages: data?.totalPages ?? 1,
    totalCount: data?.totalCount ?? 0,
    loading,
    error,
    refetch,
    fetchCriteria: refetch,
    deleteCriterion
  }), [data, loading, error, refetch, deleteCriterion]);

  return memoizedResult;
}
