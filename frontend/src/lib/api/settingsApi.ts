/**
 * @fileoverview Settings API client for frontend.
 * @description Domain-specific API client for application settings and AI testing.
 * @responsibility
 * - Handles all settings-related HTTP requests to the backend.
 * - Provides methods for fetching/updating settings and testing AI responses.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or state management.
 * - ❌ MUST NOT make direct database calls.
 * - All requests go through the REST API endpoints.
 */

import { Settings } from '../types';
import { HTTP_METHODS } from '../constants';
import { fetchWrapper } from './apiClient';

export const settingsApi = {
  /**
   * Fetches the current application settings.
   * @returns {Promise<Settings>} The settings object.
   * @throws {Error} If the request fails.
   */
  async getSettings(): Promise<Settings> {
    const data = await fetchWrapper<{ settings: Settings }>('/settings');
    return data.settings;
  },

  /**
   * Updates a specific setting by key.
   * @param {string} key - The setting key to update.
   * @param {string} value - The new value for the setting.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async updateSetting(key: string, value: string): Promise<void> {
    return fetchWrapper('/settings', {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  },

  /**
   * Tests the AI connection by sending a test message.
   * @param {string} message - The test message to send to the AI.
   * @returns {Promise<string>} The AI's response.
   * @throws {Error} If the request fails.
   */
  async testAI(message: string): Promise<string> {
    const data = await fetchWrapper<{ reply: string }>('/settings/test-ai', {
      method: HTTP_METHODS.POST,
      body: JSON.stringify({ message }),
    });
    return data.reply;
  },
};
