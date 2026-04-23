/**
 * @description Custom hook to resolve deep-linked resources (Entities, Matches, Criteria).
 * @responsibility Consolidates the fallback fetching logic when a user navigates directly to a URL with an ID parameter.
 * @boundary_rules
 * - ✅ MUST manage its own fetching lifecycle and cleanup.
 * - ✅ MUST be resilient to parent re-renders (e.g. from useCriteria list updates).
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { TOAST_TYPES } from '@/lib/constants';

export function useDeepLinkedResource<T>(
  idParam: string | null,
  localCollection: T[],
  idField: keyof T,
  fetchResource: (id: number) => Promise<T>
): T | null {
  const { addToast } = useToast();
  const [deepLinkedItem, setDeepLinkedItem] = useState<T | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const fetchingIdRef = useRef<number | null>(null);

  const id = idParam ? parseInt(idParam, 10) : null;

  // Type-resilient finder: handles cases where item.id might be string or number
  const localItem = id
    ? localCollection.find((item) => Number(item[idField]) === id)
    : null;

  /**
   * Effect 1: State Reset
   * Clears the previous deep-linked item immediately when the ID in the URL changes.
   */
  useEffect(() => {
    setDeepLinkedItem(null);
    fetchingIdRef.current = null;
  }, [idParam]);

  /**
   * Effect 2: Resource Fetching
   * Fetches the resource if it's not found in the local paginated collection.
   */
  useEffect(() => {
    if (!id || localItem || deepLinkedItem || isFetching || fetchingIdRef.current === id) {
      return;
    }

    let isMounted = true;
    fetchingIdRef.current = id;
    setIsFetching(true);

    fetchResource(id)
      .then((data) => {
        if (isMounted && fetchingIdRef.current === id) {
          setDeepLinkedItem(data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          addToast(TOAST_TYPES.ERROR, "Failed to fetch deep-linked resource");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsFetching(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // SoC: localItem and deepLinkedItem removed from dependencies to prevent fetch-interruptions 
    // during parent re-renders. We rely on internal guards instead.
  }, [id, fetchResource, addToast]);

  // Return local item as priority, then deep-linked item
  return (localItem || deepLinkedItem || null) as T | null;
}