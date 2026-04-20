// src/lib/api/dimensionApi.ts
/**
 * @fileoverview Dimension API client for frontend.
 * @description API client for Dimension CRUD and related operations.
 * @responsibility
 * - Handles HTTP requests for dimensions to the backend.
 * - Provides methods for fetching, creating, updating, deleting, and toggling dimensions.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or state management.
 * - ❌ MUST NOT make direct database calls.
 * - All requests go through the REST API endpoints.
 */
import { Dimension } from '../types';
import { HTTP_METHODS } from '../constants';
import { fetchWrapper } from './apiClient';

export interface CreateDimensionData {
  name: string;
  displayName: string;
  requirementInstruction: string;
  offeringInstruction: string;
  isActive?: boolean;
  weight?: number;
}

export interface UpdateDimensionData {
  displayName?: string;
  requirementInstruction?: string;
  offeringInstruction?: string;
  isActive?: boolean;
  weight?: number;
}

export const dimensionApi = {
  /**
   * Fetches all active dimensions.
   * @returns {Promise<Dimension[]>} Array of active Dimension objects.
   * @throws {Error} If the request fails.
   */
  async getActiveDimensions(): Promise<Dimension[]> {
    const data = await fetchWrapper<{ dimensions: Dimension[] }>('/dimensions/active');
    return data.dimensions;
  },

  /**
   * Fetches all dimensions.
   * @returns {Promise<Dimension[]>} Array of all Dimension objects.
   * @throws {Error} If the request fails.
   */
  async getDimensions(): Promise<Dimension[]> {
    const data = await fetchWrapper<{ dimensions: Dimension[] }>('/dimensions');
    return data.dimensions;
  },

  /**
   * Fetches a single dimension by ID.
   * @param {number} id - The dimension ID.
   * @returns {Promise<Dimension>} The Dimension object.
   * @throws {Error} If the request fails.
   */
  async getDimension(id: number): Promise<Dimension> {
    const data = await fetchWrapper<{ dimension: Dimension }>(`/dimensions/${id}`);
    return data.dimension;
  },

  /**
   * Creates a new dimension.
   * @param {CreateDimensionData} data - The dimension data including name, displayName, description, and optional isActive.
   * @returns {Promise<number>} The ID of the newly created dimension.
   * @throws {Error} If the request fails.
   */
  async createDimension(data: CreateDimensionData): Promise<number> {
    const response = await fetchWrapper<{ dimensionId: number }>('/dimensions', {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.dimensionId;
  },

  /**
   * Updates an existing dimension.
   * @param {number} id - The dimension ID.
   * @param {UpdateDimensionData} data - The partial dimension data to update.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async updateDimension(id: number, data: UpdateDimensionData): Promise<void> {
    return fetchWrapper(`/dimensions/${id}`, {
      method: HTTP_METHODS.PUT,
      body: JSON.stringify(data),
    });
  },

  /**
   * Deletes a dimension by ID.
   * @param {number} id - The dimension ID.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async deleteDimension(id: number): Promise<void> {
    return fetchWrapper(`/dimensions/${id}`, { method: HTTP_METHODS.DELETE });
  },

  /**
   * Toggles the active status of a dimension.
   * @param {number} id - The dimension ID.
   * @returns {Promise<boolean>} The new active status.
   * @throws {Error} If the request fails.
   */
  async toggleActive(id: number): Promise<boolean> {
    const data = await fetchWrapper<{ success: boolean; isActive: boolean }>(`/dimensions/${id}/toggle`, {
      method: HTTP_METHODS.PATCH,
    });
    return data.isActive;
  },
};