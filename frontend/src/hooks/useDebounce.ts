/**
 * @fileoverview Debounce hook for delaying value updates.
 * @description Provides a debounced value that updates after a specified delay.
 * @responsibility
 * - Delays updating a value until a specified time has elapsed since the last change.
 * - Useful for preventing excessive API calls during search or filter operations.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT make API calls directly.
 * - ✅ Returns the debounced value after the delay.
 * @param {T} value - The value to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {T} The debounced value.
 */
'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook that debounces a value.
 * @template T - The type of the value being debounced.
 * @param {T} value - The value to debounce.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {T} The debounced value.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}