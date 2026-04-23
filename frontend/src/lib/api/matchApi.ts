// src/lib/api/matchApi.ts
/**
 * @fileoverview Match API client for frontend.
 * @description API client for match CRUD operations.
 * 
 * @socexplanation
 * - This module isolates API communication from presentation logic.
 * - The frontend fetches structured JSON data, allowing React to render
 *   the match report dynamically rather than parsing Markdown.
 * - Updated to use requirementEntityId/offeringEntityId.
 */
import { EntityMatch } from '../types';
import { HTTP_METHODS } from '../constants';
import { fetchWrapper } from './apiClient';

export interface MatchFiles {
  files: string[];
}

/**
 * Parameters for querying matches with pagination, search, and status filtering.
 * @responsibility - Defines the contract for match query operations.
 * @boundary_rules - Must align with backend API query parameters.
 */
export interface MatchQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

/**
 * Response structure for paginated match queries.
 * @responsibility - Encapsulates match data with pagination metadata.
 * @boundary_rules - Used by useMatches hook to derive pagination state.
 */
export interface MatchQueryResponse {
  matches: EntityMatch[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const matchApi = {
  /**
   * Fetches matches with pagination, search, and status filtering.
   * @param {MatchQueryParams} params - Query parameters for pagination, search, and filtering.
   * @returns {Promise<MatchQueryResponse>} Matches with pagination metadata.
   * @throws {Error} If the request fails.
   */
  async getMatches(params: MatchQueryParams = {}): Promise<MatchQueryResponse> {
    const { page = 1, limit = 10, search, status } = params;
    
    const queryParams = new URLSearchParams();
    queryParams.set('page', String(page));
    queryParams.set('limit', String(limit));
    
    if (search) {
      queryParams.set('search', search);
    }
    if (status && status !== 'all') {
      queryParams.set('status', status);
    }
    
    const data = await fetchWrapper<MatchQueryResponse>(`/matches?${queryParams.toString()}`);
    return data;
  },

  /**
   * Fetches a specific match by ID.
   * @param {number} id - The match ID.
   * @returns {Promise<EntityMatch>} The match object.
   * @throws {Error} If the request fails.
   */
  async getMatch(id: number): Promise<EntityMatch> {
    const data = await fetchWrapper<{ match: EntityMatch }>(`/matches/${id}`);
    return data.match;
  },

  /**
   * Creates a new match and queues an assessment.
   * @param {number} requirementEntityId - The requirement entity ID.
   * @param {number} offeringEntityId - The offering entity ID.
   * @returns {Promise<number>} The ID of the newly created match.
   * @throws {Error} If the request fails.
   */
  async createMatch(requirementEntityId: number, offeringEntityId: number): Promise<number> {
    const data = await fetchWrapper<{ matchId: number }>('/matches', {
      method: HTTP_METHODS.POST,
      body: JSON.stringify({ requirementEntityId, offeringEntityId }),
    });
    return data.matchId;
  },

  /**
   * Deletes a match by ID.
   * @param {number} id - The match ID.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async deleteMatch(id: number): Promise<void> {
    return fetchWrapper(`/matches/${id}`, { method: HTTP_METHODS.DELETE });
  },

  /**
   * Fetches files in the match folder.
   * @param {number} id - The match ID.
   * @returns {Promise<MatchFiles>} The files in the match folder.
   * @throws {Error} If the request fails.
   */
  async getMatchFiles(id: number): Promise<MatchFiles> {
    return fetchWrapper<MatchFiles>(`/matches/${id}/files`);
  },

  /**
   * Fetches the match report JSON data for a specific match.
   * @param {number} id - The match ID.
   * @param {string} filename - The report filename (e.g., 'match_report.json').
   * @returns {Promise<Object>} The parsed JSON match report data.
   * @throws {Error} If the request fails.
   */
  async getMatchReportData(id: number, filename: string): Promise<any> {
    return fetchWrapper(`/matches/${id}/files/${encodeURIComponent(filename)}`);
  },

  async openFolder(id: number): Promise<void> {
    return fetchWrapper(`/matches/${id}/folder/open`, { method: HTTP_METHODS.POST });
  },

  /**
   * Retries the AI assessment process for a failed match.
   * @param {number} id - The ID of the match to retry.
   * @returns {Promise<void>}
   */
  async retryProcessing(id: number): Promise<void> {
    await fetchWrapper(`/matches/${id}/retry`, { method: HTTP_METHODS.POST });
  },

  /**
   * Downloads the Match Report PDF directly to the user's device.
   * @param {number} id - The match ID.
   * @throws {Error} If the generation or download fails.
   */
  async downloadMatchReportPdf(id: number): Promise<void> {
    const response = await fetch(`/api/matches/${id}/pdf`);
    
    if (!response.ok) {
      let errorMessage = "Failed to generate PDF";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {}
      throw new Error(errorMessage);
    }
    
    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `Compari_Match_Report_${id}.pdf`;
    if (contentDisposition && contentDisposition.includes('filename=')) {
      const matches = /filename="([^"]+)"/.exec(contentDisposition);
      if (matches != null && matches) { 
        filename = matches[1];
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /**
   * Manually regenerates the match master markdown file.
   * @param {number} id - The match ID.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async writeMasterFile(id: number): Promise<void> {
    return fetchWrapper(`/matches/${id}/master-file`, { method: HTTP_METHODS.POST });
  },

  /**
   * Fetches the generated master markdown file content for a match.
   * @param {number} id - The match ID.
   * @returns {Promise<string>} The master file markdown content.
   * @throws {Error} If the master file has not been generated yet.
   */
  async getMasterFile(id: number): Promise<string> {
    const data = await fetchWrapper<{ success: boolean; data: string }>(`/matches/${id}/master-file`);
    return data.data;
  },
};
