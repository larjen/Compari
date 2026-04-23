/**
 * @module useEntityData
 * @description Custom hooks for fetching entity-related data (files, logs, criteria).
 * 
 * @socexplanation
 * - Encapsulates state management and data fetching logic to enforce Separation of Concerns.
 * - Uses the unified entityApi for all entity data operations.
 * - Keeps UI components focused on presentation while hooks handle data fetching lifecycle.
 * - Refactored to use useSafeFetch for standardized race-condition prevention across all data hooks.
 */
import { useCallback, useEffect, useState } from 'react';
import { Criterion } from '@/lib/types';
import { entityApi } from '@/lib/api/entityApi';
import { matchApi } from '@/lib/api/matchApi';
import { criteriaApi } from '@/lib/api/criteriaApi';
import { useSafeFetch } from './useSafeFetch';

type FileEntityType = 'entity' | 'match' | 'criterion';

/**
 * Hook for fetching files for any entity type.
 * @param id - The ID of the entity (undefined when not loaded).
 * @param type - The type of entity ('entity' | 'match' | 'criterion').
 * @returns Object containing files array, loading state, error state, and loadFiles function.
 */
export function useFiles(id: number | undefined, type: FileEntityType) {
  const fetcher = useCallback(async () => {
    if (!id) return { files: [] };
    if (type === 'match') return matchApi.getMatchFiles(id);
    if (type === 'criterion') return criteriaApi.getFiles(id);
    return entityApi.getFiles(id);
  }, [id, type]);

  const { data, loading, error, execute: loadFiles } = useSafeFetch<{ files: string[] }>(fetcher, !!id);

  return { 
    files: data?.files || [], 
    loadFiles, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching criteria for an entity.
 * @param entityId - The ID of the entity (undefined when not loaded).
 * @returns Object containing criteria array, loading state, and error state.
 * @description Uses useSafeFetch to inherit standardized race-condition prevention.
 */
export function useEntityCriteria(entityId: number | undefined) {
  const fetcher = useCallback(async () => {
    if (!entityId) return [];
    return entityApi.getCriteria(entityId);
  }, [entityId]);

  const { data: criteria, loading, error } = useSafeFetch<Criterion[]>(fetcher, !!entityId);

  return { criteria: criteria || [], loading, error };
}

/**
 * Hook for fetching files for a criterion.
 * @param criterionId - The ID of the criterion (undefined when not loaded).
 * @returns Object containing files array, loading state, error state, and loadFiles function.
 */
export function useCriteriaFiles(criterionId: number | undefined) {
  const fetcher = useCallback(async () => {
    if (!criterionId) return { files: [] };
    return criteriaApi.getFiles(criterionId);
  }, [criterionId]);

  const { data, loading, error, execute: loadFiles } = useSafeFetch<{ files: string[] }>(fetcher, !!criterionId);

  return { 
    files: data?.files || [], 
    loadFiles, 
    loading, 
    error 
  };
}

/**
 * Hook for recursively fetching and maintaining top matches using chunked evaluation.
 * @param entityId - The ID of the base entity to find matches for.
 * @param isOpen - Boolean flag indicating if the modal/tab is open.
 * @returns Object containing topMatches array, loading state, processedCount, totalCount, isComplete, and error.
 * 
 * @architectural_reasoning
 * - Uses chunked polling: fetches paginated chunks from the backend until all entities are processed.
 * - Maintains a running top-20 list that updates dynamically as chunks arrive.
 * - Sorts all accumulated matches by score descending and keeps only top 20.
 * - Uses setTimeout between chunks to yield to the main thread, preventing UI freezes.
 * - Progress tracking (processedCount/totalCount) enables the UI to show evaluation progress.
 * 
 * @chunked_polling_model
 * 1. Fetch chunk 0..limit -> accumulate -> sort -> slice(0,20)
 * 2. If more entities remain, recurse with offset+limit
 * 3. Between chunks, setTimeout(0) yields to main thread
 * 4. When all processed, set isComplete=true
 * 
 * @socexplanation
 * - Encapsulates all pagination and state management logic, keeping the UI component focused on presentation.
 * - The hook handles the recursive fetching lifecycle; the UI renders progress and dynamic results.
 */
export function useTopMatches(entityId: number | undefined, isOpen: boolean) {
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const CHUNK_SIZE = 20;

  useEffect(() => {
    if (!entityId || !isOpen) return;

    let isMounted = true;
    setTopMatches([]);
    setProcessedCount(0);
    setTotalCount(0);
    setIsComplete(false);
    setError(null);
    setLoading(true);

    const fetchNextChunk = async (currentOffset: number) => {
      if (!isMounted) return;

      try {
        const result = await entityApi.getTopMatches(entityId, currentOffset, CHUNK_SIZE);
        
        if (!isMounted) return;

        setTopMatches(prev => {
          const combined = [...prev, ...result.evaluatedChunk];
          return combined
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);
        });

        const newProcessedCount = currentOffset + result.evaluatedChunk.length;
        setProcessedCount(newProcessedCount);
        setTotalCount(result.totalOpposites);

        if (currentOffset + CHUNK_SIZE < result.totalOpposites) {
          setTimeout(() => {
            if (isMounted) {
              fetchNextChunk(currentOffset + CHUNK_SIZE);
            }
          }, 0);
        } else {
          setIsComplete(true);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    fetchNextChunk(0);

    return () => { isMounted = false; };
  }, [entityId, isOpen]);

  return { topMatches, loading, processedCount, totalCount, isComplete, error };
}
