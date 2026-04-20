/**
 * @fileoverview Prompt API client for frontend.
 * @description Domain-specific API client for prompt CRUD operations.
 * @responsibility
 * - Handles all prompt-related HTTP requests to the backend.
 * - Provides methods for fetching and updating prompts.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or state management.
 * - ❌ MUST NOT make direct database calls.
 * - All requests go through the REST API endpoints.
 */

import { Prompt } from '../types';
import { HTTP_METHODS } from '../constants';
import { fetchWrapper } from './apiClient';

export const promptApi = {
  async getPrompts(): Promise<Prompt[]> {
    const data = await fetchWrapper<{ prompts: Prompt[] }>('/prompts');
    return data.prompts;
  },

  async updatePrompt(id: number, prompt: string): Promise<Prompt> {
    const data = await fetchWrapper<{ prompt: Prompt }>(`/prompts/${id}`, {
      method: HTTP_METHODS.PUT,
      body: JSON.stringify({ prompt }),
    });
    return data.prompt;
  },
};