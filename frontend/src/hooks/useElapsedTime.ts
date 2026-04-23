/**
 * @fileoverview Custom hook for managing elapsed time display.
 * @description Provides a convenient way to display time elapsed since a given start time.
 * @responsibility
 * - Calculates and updates elapsed time at regular intervals.
 * - Automatically cleans up intervals when the component unmounts or start time changes.
 * - Handles null/undefined start times gracefully.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 * - ✅ Uses the formatElapsedTime utility for time formatting.
 * @example
 * const elapsedTime = useElapsedTime(job.processingStartedAt);
 * // Returns formatted string like "2m 30s" or "1h 5m"
 */
'use client';

import { useState, useEffect } from 'react';
import { formatElapsedTime } from '@/lib/utils';

/**
 * Custom hook for calculating and displaying elapsed time since a start time.
 * @param {string | null | undefined} startedAt - The ISO timestamp string when processing started.
 * @returns {string} The formatted elapsed time string (e.g., "2m 30s", "1h 5m").
 *                  Returns empty string if startedAt is null, undefined, or invalid.
 * @description
 * This hook encapsulates the setInterval pattern commonly used in Card components:
 * - Uses formatElapsedTime to convert the start time to a human-readable format.
 * - Sets up a setInterval to update the displayed time every second.
 * - Automatically cleans up the interval when:
 *   - The component unmounts
 *   - The startedAt parameter changes
 *   - The startedAt becomes falsy (null/undefined)
 * 
 * This avoids duplicating the useEffect + setInterval pattern across multiple Card components,
 * centralizing the elapsed time logic in a reusable hook.
 */
export function useElapsedTime(startedAt: string | null | undefined, endedAt?: string | null | undefined): string {
  const [elapsedTime, setElapsedTime] = useState<string>('');

  useEffect(() => {
    if (!startedAt) {
      setElapsedTime('');
      return;
    }

    if (endedAt) {
      setElapsedTime(formatElapsedTime(startedAt, endedAt));
      return;
    }

    setElapsedTime(formatElapsedTime(startedAt));
    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(startedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, endedAt]);

  return elapsedTime;
}
