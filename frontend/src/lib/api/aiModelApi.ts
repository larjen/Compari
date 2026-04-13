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
import { fetchWrapper } from './apiClient';

export const aiModelApi = {
  /**
   * Fetches all AI models.
   * @returns {Promise<AiModel[]>} Array of AI models.
   * @throws {Error} If the request fails.
   */
  async getModels(): Promise<AiModel[]> {
    const data = await fetchWrapper<{ success: boolean; models: AiModel[] }>('/ai-models');
    return data.models;
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
  async getActiveModel(role: 'chat' | 'embedding'): Promise<AiModel | null> {
    const data = await fetchWrapper<{ success: boolean; model: AiModel | null }>('/ai-models/active', {
      params: { role },
    });
    return data.model;
  },

  /**
   * Creates a new AI model.
   * @description Creates a new AI model with the provided configuration.
   * @param {Object} modelData - The AI model data.
   * @param {string} modelData.name - Display name for the model.
   * @param {string} modelData.model_identifier - Model identifier/name.
   * @param {string|null} [modelData.api_url] - API endpoint URL (can be null).
   * @param {string|null} [modelData.api_key] - API key (optional, can be null).
   * @param {string} [modelData.role] - Role type ('chat' or 'embedding', default: 'chat').
   * @param {number|null} [modelData.temperature] - Temperature setting (0-2, can be null).
   * @param {number|null} [modelData.contextWindow] - Context window size (min 1024, can be null).
   * @returns {Promise<AiModel>} The created AI model.
   * @throws {Error} If the request fails.
   */
  async createModel(modelData: {
    name: string;
    model_identifier: string;
    api_url?: string | null;
    api_key?: string | null;
    role?: 'chat' | 'embedding';
    temperature?: number | null;
    contextWindow?: number | null;
  }): Promise<AiModel> {
    const data = await fetchWrapper<{ success: boolean; model: AiModel }>('/ai-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelData),
    });
    return data.model;
  },

  /**
   * Updates an existing AI model.
   * @description Updates an AI model's configuration by ID.
   * @param {number} id - The AI model ID to update.
   * @param {Object} modelData - The updated AI model data.
   * @param {string} [modelData.name] - Display name for the model.
   * @param {string} [modelData.model_identifier] - Model identifier/name.
   * @param {string|null} [modelData.api_url] - API endpoint URL (can be null).
   * @param {string|null} [modelData.api_key] - API key (can be null).
   * @param {string} [modelData.role] - Role type ('chat' or 'embedding').
   * @param {number|null} [modelData.temperature] - Temperature setting (0-2, can be null).
   * @param {number|null} [modelData.contextWindow] - Context window size (min 1024, can be null).
   * @returns {Promise<AiModel>} The updated AI model.
   * @throws {Error} If the request fails or model is a system model.
   */
  async updateModel(
    id: number,
    modelData: {
      name?: string;
      model_identifier?: string;
      api_url?: string | null;
      api_key?: string | null;
      role?: 'chat' | 'embedding';
      temperature?: number | null;
      contextWindow?: number | null;
    }
  ): Promise<AiModel> {
    const data = await fetchWrapper<{ success: boolean; model: AiModel }>(`/ai-models/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelData),
    });
    return data.model;
  },

  /**
   * Deletes an AI model by ID.
   * @param {number} id - The AI model ID to delete.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails or model is a system model.
   */
  async deleteModel(id: number): Promise<void> {
    return fetchWrapper(`/ai-models/${id}`, {
      method: 'DELETE',
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
      method: 'POST',
    });
    return data.model;
  },
};
