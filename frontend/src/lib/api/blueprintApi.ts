// src/lib/api/blueprintApi.ts
/**
 * @fileoverview Blueprint API client for frontend.
 * @description API client for Blueprint CRUD and related operations.
 * @responsibility
 * - Handles all blueprint-related HTTP requests to the backend.
 * - Provides methods for fetching, creating, updating, deleting blueprints and their fields/dimensions.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or state management.
 * - ❌ MUST NOT make direct database calls.
 * - All requests go through the REST API endpoints.
 */
import { Blueprint, BlueprintField } from '../types';
import { fetchWrapper } from './apiClient';

export interface CreateBlueprintData {
  name: string;
  requirementLabelSingular: string;
  requirementLabelPlural: string;
  offeringLabelSingular: string;
  offeringLabelPlural: string;
  requirementDocTypeLabel?: string;
  offeringDocTypeLabel?: string;
  description?: string;
  fields: Array<{
    fieldName: string;
    fieldType: 'string' | 'number' | 'date' | 'boolean';
    description: string;
    isRequired: boolean;
    entityRole: 'requirement' | 'offering';
  }>;
  dimensionIds: number[];
}

export interface UpdateBlueprintData {
  name?: string;
  requirementLabelSingular?: string;
  requirementLabelPlural?: string;
  offeringLabelSingular?: string;
  offeringLabelPlural?: string;
  requirementDocTypeLabel?: string;
  offeringDocTypeLabel?: string;
  description?: string;
  isActive?: boolean;
  fields?: Array<{
    fieldName: string;
    fieldType: 'string' | 'number' | 'date' | 'boolean';
    description: string;
    isRequired: boolean;
    entityRole: 'requirement' | 'offering';
  }>;
  dimensionIds?: number[];
}

export const blueprintApi = {
  /**
   * Fetches all blueprints, optionally filtered by role.
   * @param {('requirement' | 'offering')} [role] - Optional role filter.
   * @returns {Promise<Blueprint[]>} Array of Blueprint objects.
   * @throws {Error} If the request fails.
   */
  async getBlueprints(role?: 'requirement' | 'offering'): Promise<Blueprint[]> {
    const data = await fetchWrapper<{ blueprints: Blueprint[] }>('/blueprints', {
      params: role ? { role } : undefined,
    });
    return data.blueprints;
  },

  /**
   * Fetches a single blueprint by ID with fields and dimensions.
   * @param {number} id - The blueprint ID.
   * @returns {Promise<Blueprint>} The Blueprint object with fields and dimensions.
   * @throws {Error} If the request fails.
   */
  async getBlueprint(id: number): Promise<Blueprint> {
    const data = await fetchWrapper<{ blueprint: Blueprint }>(`/blueprints/${id}`);
    return data.blueprint;
  },

  /**
   * Creates a new blueprint with fields and dimension links.
   * @param {CreateBlueprintData} data - The blueprint data including name, singular/plural labels, fields, and dimension IDs.
   * @returns {Promise<number>} The ID of the newly created blueprint.
   * @throws {Error} If the request fails.
   */
  async createBlueprint(data: CreateBlueprintData): Promise<number> {
    const response = await fetchWrapper<{ blueprintId: number }>('/blueprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.blueprintId;
  },

  /**
   * Updates an existing blueprint with new fields and dimension links.
   * @param {number} id - The blueprint ID.
   * @param {UpdateBlueprintData} data - The partial blueprint data to update.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async updateBlueprint(id: number, data: UpdateBlueprintData): Promise<void> {
    return fetchWrapper(`/blueprints/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  /**
   * Deletes a blueprint by ID.
   * @param {number} id - The blueprint ID.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async deleteBlueprint(id: number): Promise<void> {
    return fetchWrapper(`/blueprints/${id}`, { method: 'DELETE' });
  },

  /**
   * Sets a blueprint as the active one (exclusive active blueprint).
   * @param {number} id - The blueprint ID.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async setActiveBlueprint(id: number): Promise<void> {
    return fetchWrapper(`/blueprints/${id}/set-active`, { method: 'PATCH' });
  },
};
