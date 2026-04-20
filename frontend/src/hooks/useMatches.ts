/**
 * @fileoverview Custom hook for managing matches.
 * @description Provides state management and API interactions for matches.
 * @responsibility
 * - Fetches, creates, and deletes matches.
 * - Handles real-time updates via SSE.
 * - Uses useManagedCollection for unified lifecycle orchestration (fetch + SSE + watchdog).
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - Uses matchApi for all data operations.
 * - ❌ MUST NOT directly manage HTTP state, SSE, or watchdog (delegated to useManagedCollection).
 */
'use client';

import { useCallback } from 'react';
import { EntityMatch, SSEMatchUpdate } from '@/lib/types';
import { matchApi, MatchQueryParams, MatchQueryResponse } from '@/lib/api/matchApi';
import { useManagedCollection, resolveStatus } from './useManagedCollection';

interface UseMatchesOptions extends MatchQueryParams {
  immediate?: boolean;
}

/**
 * Custom hook for managing matches with pagination, search, and real-time updates.
 * @param {UseMatchesOptions} [options] - Configuration options including pagination, search, status.
 * @returns {Object} Match data, loading state, error state, and CRUD functions.
 */
export function useMatches({ page, limit, search, status, immediate = true }: UseMatchesOptions = {}) {
  const fetchFn = useCallback(async () => {
    const apiStatus = resolveStatus(status);
    return matchApi.getMatches({ page, limit, search, status: apiStatus });
  }, [page, limit, search, status]);

  const extractItems = useCallback(
    (response: MatchQueryResponse | null): EntityMatch[] => response?.matches ?? [],
    []
  );

  const { items: matches, loading, error, refetch, totalPages } = useManagedCollection<
    MatchQueryResponse,
    EntityMatch
  >({
    fetchFn,
    extractItems,
    sseConfig: {
      onMatchUpdate: () => {
        refetch();
      },
    },
    watchdogConfig: { enabled: true },
    immediate,
  });

  const addMatch = async (requirementEntityId: number, offeringEntityId: number) => {
    const matchId = await matchApi.createMatch(requirementEntityId, offeringEntityId);
    await refetch();
    return matchId;
  };

  /**
   * Deletes a match by ID and refreshes the matches list.
   * @param {number} id - The unique identifier of the match to delete.
   * @returns {Promise<void>} Resolves when deletion is complete.
   * @throws {Error} If the API request fails.
   */
  const deleteMatch = async (id: number) => {
    await matchApi.deleteMatch(id);
    await refetch();
  };

  return {
    matches,
    loading,
    error,
    refetch,
    addMatch,
    deleteMatch,
    handleMatchUpdate: () => {
      refetch();
    },
    totalPages,
  };
}