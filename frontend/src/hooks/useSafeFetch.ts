/**
 * @fileoverview Generic hook for managing HTTP fetch state with race condition prevention.
 * @description Provides centralized state management for async data fetching operations.
 * @responsibility
 * - Manages `data`, `loading`, and `error` states for any async fetcher function.
 * - Implements useRef-based race condition prevention to ensure only the latest request updates state.
 * - Enforces Separation of Concerns by isolating HTTP state management from domain-specific data hooks.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT make assumptions about the data type being fetched.
 * - ✅ Provides generic state that domain hooks can wrap with their specific business logic.
 * @separation_of_concerns
 * This hook abstracts away the repetitive pattern of:
 *   - Tracking active requests with useRef
 *   - Checking request IDs before updating state
 *   - Handling loading/error states
 * By centralizing this logic, domain hooks (useUsers, useJobListings, etc.) only need to:
 *   - Define their specific data state (users, jobListings, etc.)
 *   - Provide their API fetch function
 *   - Handle domain-specific operations (CRUD, SSE updates, etc.)
 * This keeps the HTTP layer (state management, race conditions) separate from the domain layer
 * (business logic, entity-specific operations).
 * @example
 * const { data, loading, error, execute } = useSafeFetch(fetchUserData);
 */
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Represents the state of a fetch operation.
 * @template T - The type of data being fetched.
 */
interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Represents an async fetcher function.
 * @template T - The type of data to fetch.
 * @returns A Promise that resolves to the fetched data.
 */
type Fetcher<T> = () => Promise<T>;

/**
 * Return type for the useSafeFetch hook.
 * @template T - The type of data being fetched.
 */
interface UseSafeFetchReturn<T> {
  /** The fetched data, or null if not yet loaded. */
  data: T | null;
  /** Whether a fetch operation is currently in progress. */
  loading: boolean;
  /** Error message if the fetch failed, or null if no error. */
  error: string | null;
  /** Function to manually trigger a fetch. Useful for refetching on demand. */
  execute: () => Promise<void>;
  /** Resets the hook state (clears data, loading, and error). */
  reset: () => void;
}

/**
 * Custom hook for managing async fetch operations with race condition prevention.
 * @template T - The type of data being fetched.
 * @param {Fetcher<T>} fetcher - The async function to call for fetching data.
 * @param {boolean} [immediate=true] - Whether to automatically fetch on mount.
 * @returns {UseSafeFetchReturn<T>} Object containing data, loading, error states and execute function.
 * @description
 * This hook implements the "request ID" pattern to prevent race conditions:
 * 1. Uses a useRef to track the latest request ID.
 * 2. Increments the ID before each fetch call.
 * 3. Only updates React state if the current request ID matches the active request ID.
 * 
 * This ensures that if multiple rapid requests are made (e.g., user clicks a button multiple times),
 * only the response from the most recent request will update the UI, preventing stale data display.
 */
export function useSafeFetch<T>(
  fetcher: Fetcher<T>,
  immediate: boolean = true
): UseSafeFetchReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);

  /**
   * useRef to track the latest request ID.
   * This enables race condition prevention by comparing the current request's ID
   * against the active request ID when the response comes back.
   */
  const activeRequestRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const pendingRefetchRef = useRef<boolean>(false);

  /**
   * Executes the fetcher function with race condition protection.
   * @returns {Promise<void>} A promise that resolves when the fetch completes (or fails).
   * @description
   * - Deduplication guard prevents redundant network calls when request is in-flight.
   * - Increments the request ID before fetching.
   * - Sets loading state and clears any previous errors.
   * - Calls the provided fetcher function.
   * - Only updates state if this is still the most recent request (checked via request ID comparison).
   * - Executes catch-up fetch if SSE events fired during network wait.
   */
  const execute = useCallback(async () => {
    if (isFetchingRef.current) {
      pendingRefetchRef.current = true;
      return;
    }

    isFetchingRef.current = true;
    const currentRequestId = ++activeRequestRef.current;

    try {
      setError(null);
      setLoading(true);

      const result = await fetcher();

      if (currentRequestId === activeRequestRef.current) {
        setData(result);
      }
    } catch (err) {
      if (currentRequestId === activeRequestRef.current) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    } finally {
      isFetchingRef.current = false;

      if (currentRequestId === activeRequestRef.current) {
        setLoading(false);
      }

      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        execute();
      }
    }
  }, [fetcher]);

  /**
   * Resets all state values to their initial state.
   * @description Useful when you need to clear fetched data and start fresh.
   */
  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    activeRequestRef.current = 0;
    isFetchingRef.current = false;
    pendingRefetchRef.current = false;
  }, []);

  /**
   * Effect to trigger initial fetch on mount if immediate is true.
   */
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}
