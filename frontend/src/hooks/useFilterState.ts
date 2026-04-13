/**
 * @fileoverview Unified filter and pagination state management hook.
 * @description Provides a standardized pattern for managing search, status filter, and pagination state.
 * @responsibility
 * - Manages search, status, and page state with proper debouncing.
 * - Automatically resets pagination when search or filter changes.
 * - Ensures consistency across all list/table pages.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT make API calls directly.
 * - ✅ Uses useDebounce for search debouncing.
 * @param {string} initialStatus - The initial status filter value (e.g., 'all').
 * @returns {Object} Object containing search, debouncedSearch, status, page, and their setters.
 */
'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from './useDebounce';

export interface UseFilterStateOptions {
  /** Initial status filter value (default: 'all') */
  initialStatus?: string;
  /** Debounce delay for search input in milliseconds (default: 500) */
  debounceDelay?: number;
}

/**
 * Custom hook for unified filter and pagination state management.
 * @param {string} [initialStatus='all'] - The initial status filter value.
 * @returns {Object} Filter state object with search, status, page, and their setters plus debounced search.
 * @example
 * const { search, setSearch, debouncedSearch, status, setStatus, page, setPage } = useFilterState('all');
 */
export function useFilterState(initialStatus: string = 'all'): {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  debouncedSearch: string;
  status: string;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
} {
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>(initialStatus);
  const [page, setPage] = useState<number>(1);

  const debouncedSearch = useDebounce(search, 500);

  /**
   * Resets page to 1 when debouncedSearch or status changes.
   * This ensures users see the first page of results when filtering.
   */
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  return {
    search,
    setSearch,
    debouncedSearch,
    status,
    setStatus,
    page,
    setPage,
  };
}