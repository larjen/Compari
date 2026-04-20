/**
 * @fileoverview Centralized API client with shared fetch logic.
 * @description Provides a standardized fetch wrapper that handles caching, error handling,
 *              and common request patterns across all domain API clients.
 * 
 * @responsibility
 * - Centralizes cache-busting for GET requests
 * - Standardizes error throwing for non-OK responses
 * - Adheres to DRY principle by eliminating duplicate fetch/error handling code
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain domain-specific business logic
 * - ❌ MUST NOT manage state
 * - ✅ MAY be used by all domain API clients
 * 
 * @architectural_notes
 * - GET requests automatically append _t=${Date.now()} to bust browser cache
 * - All responses are checked for !res.ok and throw standardized errors
 * - Error messages are extracted from JSON response when available
 * 
 * @deps
 * - Relies on centralized API_BASE_PATH, HTTP_METHODS, and FETCH_CACHE_MODES from lib/constants.ts
 */

import { API_BASE_PATH, HTTP_METHODS, FETCH_CACHE_MODES } from '../constants';

/**
 * Options for fetch requests.
 */
interface FetchOptions extends RequestInit {
  /** Query parameters for GET requests (automatically cache-busted) */
  params?: Record<string, string | number>;
  /** Whether to skip cache busting (default: false for GET only) */
  skipCacheBust?: boolean;
}

/**
 * Makes a fetch request with standardized error handling and cache busting.
 * 
 * @param endpoint - API endpoint path (e.g., '/users')
 * @param options - Fetch options including method, headers, body, etc.
 * @returns Promise resolving to JSON response
 * @throws Error with extracted message if response is not OK
 * 
 * @example
 * // GET request (auto cache-busted)
 * const users = await fetchWrapper<User[]>('/users');
 * 
 * @example
 * // POST request
 * const result = await fetchWrapper('/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ firstName: 'John' })
 * });
 */
export async function fetchWrapper<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, skipCacheBust, ...fetchOptions } = options;
  
  let url = `${API_BASE_PATH}${endpoint}`;
  
  // Add cache-busting query param for GET requests
  if (fetchOptions.method === undefined || fetchOptions.method === HTTP_METHODS.GET) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}_t=${Date.now()}`;
  }
  
  // Add additional query params
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}${searchParams.toString()}`;
  }

  // Automatically set Content-Type to application/json if body is a string (JSON)
  const defaultHeaders: HeadersInit = 
    typeof fetchOptions.body === 'string' 
      ? { 'Content-Type': 'application/json' } 
      : {};

  const finalHeaders = {
    ...defaultHeaders,
    ...fetchOptions.headers,
  };

  const res = await fetch(url, {
    ...fetchOptions,
    headers: finalHeaders,
    // Set cache: 'no-store' for GET requests to prevent caching
    cache: fetchOptions.method === HTTP_METHODS.GET ? FETCH_CACHE_MODES.NO_STORE : undefined,
  });
  
  if (!res.ok) {
    // Try to extract error message from JSON response
    let errorMessage = `Request failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Response wasn't JSON, use default message
    }
    throw new Error(errorMessage);
  }
  
  return res.json();
}
