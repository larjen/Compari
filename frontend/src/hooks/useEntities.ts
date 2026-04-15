// src/hooks/useEntities.ts
/**
 * @fileoverview Custom hook for managing unified entities.
 * @description Provides state management and API interactions for generic entities.
 * @responsibility
 * - Fetches, creates, deletes entities (supporting both 'source' and 'target' types).
 * - Uses useSafeFetch for HTTP state management (avoids duplicating loading/error/race condition logic).
 * - Supports server-side pagination, search, and status filtering.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - Uses entityApi for all data operations.
 */
'use client';

import { useCallback } from 'react';
import { Entity } from '@/lib/types';
import { entityApi, CreateEntityData, EntityQueryParams, EntityQueryResponse } from '@/lib/api/entityApi';
import { useSafeFetch } from './useSafeFetch';
import { useSSE } from './useSSE';

interface UseEntitiesOptions extends EntityQueryParams {
  /** Whether to automatically fetch on mount (default: true) */
  immediate?: boolean;
  /** Whether to listen for SSE entity updates */
  listenToSSE?: boolean;
}

/**
 * Custom hook for managing generic entities with optional type filtering and server-side pagination.
 * @param {UseEntitiesOptions} [options] - Configuration options including pagination, search, status, type.
 * @returns {Object} Entity data, loading state, error state, and CRUD functions.
 */
export function useEntities({
  type,
  page,
  limit,
  search,
  status,
  immediate = true,
  listenToSSE = true,
}: UseEntitiesOptions = {}) {
  const fetchEntities = useCallback(async () => {
    return entityApi.getEntities({ type, page, limit, search, status });
  }, [type, page, limit, search, status]);

  const { data, loading, error, execute: refetch } = useSafeFetch<EntityQueryResponse>(fetchEntities, immediate);

  const entities = data?.entities ?? [];
  const totalPages = data?.meta?.totalPages ?? 0;

  const handleEntityUpdate = useCallback(() => {
    refetch();
  }, [refetch]);

  useSSE({
    onEntityUpdate: listenToSSE ? handleEntityUpdate : undefined,
    onReconnect: fetchEntities
  });

  const addEntity = async (data: CreateEntityData) => {
    await entityApi.createEntity(data);
    await refetch();
  };

  const updateEntity = async (id: number, data: { metadata?: Record<string, unknown> }) => {
    await entityApi.updateEntity(id, data);
    await refetch();
  };

  const deleteEntity = async (id: number) => {
    await entityApi.deleteEntity(id);
    await refetch();
  };

  const getEntityById = (id: number) => {
    return entities.find((entity) => entity.id === id);
  };

  return {
    entities,
    loading,
    error,
    refetch,
    fetchEntities: refetch,
    addEntity,
    updateEntity,
    deleteEntity,
    getEntityById,
    totalPages,
  };
}