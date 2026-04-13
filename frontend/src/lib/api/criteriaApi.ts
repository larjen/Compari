// src/lib/api/criteriaApi.ts
/**
 * @fileoverview Criteria API client for frontend.
 * @description Domain-specific API client for criteria operations.
 * @responsibility
 * - Handles criteria-related HTTP requests to the backend.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or state management.
 * - All requests go through the REST API endpoints.
 */
import { Criterion, Entity } from '../types';
import { fetchWrapper } from './apiClient';

/**
 * Query parameters for paginated criteria fetching.
 */
export interface GetCriteriaParams {
  /** Page number (1-indexed). Default: 1 */
  page?: number;
  /** Number of items per page. Default: 300 */
  limit?: number;
  /** Search term to match against displayName (case-insensitive). */
  search?: string;
  /** Optional dimension filter. */
  dimension?: string;
}

/**
 * Paginated response from criteria API.
 */
export interface PaginatedCriteriaResponse {
  criteria: Criterion[];
  totalPages: number;
  totalCount: number;
}

export const criteriaApi = {
  /**
   * Retrieves criteria with server-side pagination and filtering.
   * @param {GetCriteriaParams} params - Query parameters for pagination and filtering.
   * @returns {Promise<PaginatedCriteriaResponse>} Object containing criteria array, totalPages, and totalCount.
   * 
   * @critical_sorting_rule
   * Results are sorted by dimension (alphabetically, nulls/uncategorized as last),
   * then by displayName (alphabetically) on the server BEFORE applying OFFSET/LIMIT.
   * This ensures dimension grouping headers persist correctly across pages.
   */
  async getAllCriteria(params: GetCriteriaParams = {}): Promise<PaginatedCriteriaResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.page !== undefined && params.page !== 1) {
      queryParams.set('page', String(params.page));
    }
    if (params.limit !== undefined && params.limit !== 300) {
      queryParams.set('limit', String(params.limit));
    }
    if (params.search) {
      queryParams.set('search', params.search);
    }
    if (params.dimension) {
      queryParams.set('dimension', params.dimension);
    }

    const queryString = queryParams.toString();
    const url = queryString ? `/criteria?${queryString}` : '/criteria';
    
    const data = await fetchWrapper<PaginatedCriteriaResponse>(url);
    return data;
  },

  /**
   * Retrieves all source and target entities associated with a specific criterion.
   * @param {number} id - The criterion ID.
   * @returns {Promise<{ sources: Entity[], targets: Entity[] }>}
   * @throws {Error} If the request fails.
   */
  async getCriterionAssociations(id: number): Promise<{ sources: Entity[], targets: Entity[] }> {
    return fetchWrapper(`/criteria/${id}/associations`);
  },

  /**
   * Deletes a criterion by ID.
   * @param {number} id - The criterion ID.
   * @returns {Promise<void>}
   */
  async deleteCriterion(id: number): Promise<void> {
    return fetchWrapper(`/criteria/${id}`, { method: 'DELETE' });
  },

  async getSimilarCriteria(id: number): Promise<{ criterion: Criterion, score: number }[]> {
    const data = await fetchWrapper<{ similar: { criterion: Criterion, score: number }[] }>(`/criteria/${id}/similar`);
    return data.similar;
  },

  async mergeCriteria(keepId: number, removeId: number): Promise<void> {
    return fetchWrapper(`/criteria/${keepId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeId })
    });
  },

  async getMergeHistory(id: number): Promise<{ id: number; keep_id: number; merged_display_name: string; merged_at: string }[]> {
    const data = await fetchWrapper<{ history: { id: number; keep_id: number; merged_display_name: string; merged_at: string }[] }>(`/criteria/${id}/history`);
    return data.history;
  },
};
