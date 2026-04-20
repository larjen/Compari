/**
 * @fileoverview Custom hook for managing unified entities.
 * @description Provides state management and API interactions for generic entities.
 * @responsibility
 * - Fetches, creates, deletes entities (supporting both 'source' and 'target' types).
 * - Uses useManagedCollection for unified lifecycle orchestration (fetch + SSE + watchdog).
 * - Supports server-side pagination, search, and status filtering.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - Uses entityApi for all data operations.
 * - ❌ MUST NOT directly manage HTTP state, SSE, or watchdog (delegated to useManagedCollection).
 */
'use client';

import { useCallback, useMemo } from 'react';
import { Entity } from '@/lib/types';
import { entityApi, CreateEntityData, EntityQueryParams, EntityQueryResponse } from '@/lib/api/entityApi';
import { useManagedCollection, resolveStatus } from './useManagedCollection';

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
  const fetchFn = useCallback(async () => {
    const apiStatus = resolveStatus(status);
    return entityApi.getEntities({ type, page, limit, search, status: apiStatus });
  }, [type, page, limit, search, status]);

  const extractItems = useCallback(
    (response: EntityQueryResponse | null): Entity[] => response?.entities ?? [],
    []
  );

  const { items: entities, loading, error, refetch, totalPages } = useManagedCollection<
    EntityQueryResponse,
    Entity
  >({
    fetchFn,
    extractItems,
    sseConfig: listenToSSE
      ? {
          onEntityUpdate: () => {
            refetch();
          },
        }
      : undefined,
    watchdogConfig: { enabled: true },
    immediate,
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