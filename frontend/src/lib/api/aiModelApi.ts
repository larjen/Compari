/**
 * @fileoverview AI Model API client for frontend.
 * @description Domain-specific API client for AI model CRUD operations.
 * @responsibility
 * - Handles all AI model-related HTTP requests to the backend.
 * - Provides methods for fetching, creating, updating, deleting, and activating models.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or state management.
 * - ❌ MUST NOT make direct database calls.
 * - All requests go through the REST API endpoints.
 */

import { AiModel } from '../types';
import { AI_MODEL_ROLES, HTTP_METHODS } from '../constants';
import { fetchWrapper } from './apiClient';

export const aiModelApi = {
  /**
   * Fetches all AI models.
   * @returns {Promise<AiModel[]>} Array of AI models.
   * @throws {Error} If the request fails or if the API contract is violated.
   */
  async getModels(): Promise<AiModel[]> {
    const data = await fetchWrapper<{ success: boolean; models?: AiModel[] }>('/ai-models');
    
    if (!data || !data.models) {
      throw new Error("API Contract Violation [getModels]: Expected 'models' array in response.");
    }
    
    return data.models;
  },

  /**
   * Creates a new AI model.
   * @description Creates a new AI model with the provided configuration.
   * @param {Object} modelData - The AI model data.
   * @returns {Promise<number>} The ID of the created AI model.
   * @throws {Error} If the request fails or if the API contract is violated.
   */
  async createModel(modelData: {
    name: string;
    model_identifier: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: typeof AI_MODEL_ROLES.CHAT | typeof AI_MODEL_ROLES.EMBEDDING;
    temperature?: number | null;
    contextWindow?: number | null;
  }): Promise<number> {
    const data = await fetchWrapper<{ success: boolean; modelId?: number }>('/ai-models', {
      method: HTTP_METHODS.POST,
      body: JSON.stringify(modelData),
    });

    if (!data || typeof data.modelId !== 'number') {
      throw new Error("API Contract Violation [createModel]: Expected numeric 'modelId' in response.");
    }

    return data.modelId;
  },

  /**
   * Fetches a single AI model by ID.
   * @param {number} id - The AI model ID.
   * @returns {Promise<AiModel>} The AI model.
   * @throws {Error} If the request fails or model not found.
   */
  async getModelById(id: number): Promise<AiModel> {
    const data = await fetchWrapper<{ success: boolean; model: AiModel }>(`/ai-models/${id}`);
    return data.model;
  },

  /**
   * Fetches the currently active AI model for a specific role.
   * @param {string} role - The role ('chat' or 'embedding').
   * @returns {Promise<AiModel | null>} The active AI model or null.
   * @throws {Error} If the request fails.
   */
  async getActiveModel(role: typeof AI_MODEL_ROLES.CHAT | typeof AI_MODEL_ROLES.EMBEDDING): Promise<AiModel | null> {
    const data = await fetchWrapper<{ success: boolean; model: AiModel | null }>('/ai-models/active', {
      params: { role },
    });
    return data.model;
  },

  /**
   * Updates an existing AI model.
   * @param {number} id - The AI model ID.
   * @param {Object} modelData - The updated model data.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async updateModel(id: number, modelData: {
    name?: string;
    model_identifier?: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: typeof AI_MODEL_ROLES.CHAT | typeof AI_MODEL_ROLES.EMBEDDING;
    temperature?: number | null;
    contextWindow?: number | null;
  }): Promise<void> {
    await fetchWrapper<{ success: boolean; message: string }>(`/ai-models/${id}`, {
      method: HTTP_METHODS.PUT,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelData),
    });
  },

  /**
   * Deletes an AI model by ID.
   * @param {number} id - The AI model ID to delete.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails or model is a system model.
   */
  async deleteModel(id: number): Promise<void> {
    return fetchWrapper(`/ai-models/${id}`, {
      method: HTTP_METHODS.DELETE,
    });
  },

  /**
   * Sets a model as the active model within its role.
   * @param {number} id - The AI model ID to set as active.
   * @returns {Promise<AiModel>} The activated AI model.
   * @throws {Error} If the request fails.
   */
  async setActiveModel(id: number): Promise<AiModel> {
    const data = await fetchWrapper<{ success: boolean; model: AiModel }>(`/ai-models/${id}/set-active`, {
      method: HTTP_METHODS.POST,
    });
    return data.model;
  },

  /**
   * Tests AI model connectivity using transient/unsaved credentials.
   * @param {Object} data - The model configuration to test.
   * @param {string} data.model_identifier - Model identifier/name.
   * @param {string} [data.api_url] - API endpoint URL.
   * @param {string} [data.api_key] - API key (optional).
   * @param {string} [data.role] - Role type ('chat' or 'embedding', default: 'chat').
   * @returns {Promise<{success: boolean, message?: string}>} Success status.
   * @throws {Error} If the connection test fails.
   */
  async testConnection(data: {
    model_identifier: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: typeof AI_MODEL_ROLES.CHAT | typeof AI_MODEL_ROLES.EMBEDDING;
  }): Promise<{ success: boolean; message?: string }> {
    return fetchWrapper<{ success: boolean; message?: string }>('/ai-models/test', {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
};
