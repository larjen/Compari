/**
 * @description Custom hook to resolve deep-linked resources (Entities, Matches, Criteria).
 * @responsibility Consolidates the fallback fetching logic when a user navigates directly to a URL with an ID parameter, ensuring the item is fetched if not already in the local paginated list.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ✅ MUST manage its own fetching lifecycle and cleanup.
 */
'use client';

import { useState, useEffect } from 'react';

export function useDeepLinkedResource<T>(
  idParam: string | null,
  localCollection: T[],
  idField: keyof T,
  fetchResource: (id: number) => Promise<T>
): T | null {
  const [deepLinkedItem, setDeepLinkedItem] = useState<T | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const id = idParam ? parseInt(idParam, 10) : null;
  const localItem = id ? localCollection.find((item) => (item[idField] as unknown as number) === id) : null;

  useEffect(() => {
    if (id && !localItem && !deepLinkedItem && !isFetching) {
      let isMounted = true;
      setIsFetching(true);
      fetchResource(id)
        .then((data) => {
          if (isMounted) setDeepLinkedItem(data);
        })
        .catch((err) => console.error("Failed to fetch deep-linked resource:", err))
        .finally(() => {
          if (isMounted) setIsFetching(false);
        });
      return () => { isMounted = false; };
    }
  }, [id, localItem, deepLinkedItem, isFetching, fetchResource]);

  useEffect(() => {
    if (!id && deepLinkedItem) {
      setDeepLinkedItem(null);
    }
  }, [id, deepLinkedItem]);

  return (localItem || deepLinkedItem || null) as T | null;
}