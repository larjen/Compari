/**
 * @fileoverview Watchdog hook to prevent UI items from getting stuck in a processing state.
 */
'use client';

import { useEffect } from 'react';

const WATCHDOG_TIMEOUT_MS = 60000;

/**
 * Monitors items for stale processing states and triggers a refetch if a timeout is reached.
 * @param items - Array of domain entities (Matches, Entities, etc.)
 * @param statusField - The key on the item that holds its status (e.g., 'status')
 * @param processingValue - The string value that indicates it is processing (e.g., 'processing')
 * @param refetchFn - The function to call to resync the data
 */
export function useProcessingWatchdog<T>(
  items: T[] | null,
  statusField: keyof T,
  processingValue: string,
  refetchFn: () => Promise<void> | void
) {
  useEffect(() => {
    if (!items || items.length === 0) return;

    const hasProcessingItems = items.some(item => item[statusField] === processingValue);

    if (hasProcessingItems) {
      const timer = setTimeout(() => {
        console.warn(`[Watchdog] Items have been processing for over ${WATCHDOG_TIMEOUT_MS / 1000}s. Triggering safety resync.`);
        refetchFn();
      }, WATCHDOG_TIMEOUT_MS);

      return () => clearTimeout(timer);
    }
  }, [items, statusField, processingValue, refetchFn]);
}
