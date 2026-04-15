// src/hooks/useMatches.ts
/**
 * @fileoverview Custom hook for managing matches.
 * @description Provides state management and API interactions for matches.
 * @responsibility
 * - Fetches, creates, and deletes matches.
 * - Handles real-time updates via SSE.
 * - Uses useSafeFetch for HTTP state management (avoids duplicating loading/error/race condition logic).
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - Uses matchApi for all data operations.
 */
'use client';

import { useCallback } from 'react';
import { EntityMatch, SSEMatchUpdate } from '@/lib/types';
import { matchApi, MatchQueryParams, MatchQueryResponse } from '@/lib/api/matchApi';
import { useSafeFetch } from './useSafeFetch';
import { useSSE } from './useSSE';

export interface UseMatchesOptions extends MatchQueryParams {
  immediate?: boolean;
}

export function useMatches({ page, limit, search, status, immediate = true }: UseMatchesOptions = {}) {
  const fetchMatches = useCallback(async () => {
    return matchApi.getMatches({ page, limit, search, status });
  }, [page, limit, search, status]);

  const { data, loading, error, execute: refetch } = useSafeFetch<MatchQueryResponse>(fetchMatches, immediate);

  const matches = data?.matches ?? [];
  const totalPages = data?.meta?.totalPages ?? 0;

  const handleMatchUpdate = useCallback((update: SSEMatchUpdate) => {
    refetch();
  }, [refetch]);

  useSSE({
    onMatchUpdate: handleMatchUpdate,
    onReconnect: fetchMatches
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
    handleMatchUpdate,
    totalPages,
  };
}
