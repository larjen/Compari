// src/lib/api/entityApi.ts
/**
 * @fileoverview Entity API client for frontend.
 * @description Generic API client for unified Entity CRUD and related operations.
 * @responsibility
 * - Handles all entity-related HTTP requests to the backend.
 * - Provides methods for fetching, creating, updating, deleting entities and their files/logs/criteria.
 * - Supports both 'requirement' and 'offering' entity types.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or state management.
 * - ❌ MUST NOT make direct database calls.
 * - All requests go through the REST API endpoints.
 */
import { Entity, EntityFiles, EntityMatch, Criterion, EntityType, EntityStatus } from '../types';
import { ENTITY_ROLES, HTTP_METHODS } from '../constants';
import { fetchWrapper } from './apiClient';

export interface CreateEntityData {
  type: EntityType;
  name: string;
  description?: string;
  folderPath?: string;
  metadata?: Record<string, unknown>;
  blueprintId?: number;
  entityRole?: EntityType;
}

interface UpdateEntityData {
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for querying entities with pagination, search, and status filtering.
 */
export interface EntityQueryParams {
  type?: EntityType;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

/**
 * Response structure for paginated entity queries.
 */
export interface EntityQueryResponse {
  entities: Entity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const entityApi = {
  /**
   * Fetches entities with pagination, search, and status filtering.
   * @param {EntityQueryParams} params - Query parameters for pagination, search, and filtering.
   * @returns {Promise<EntityQueryResponse>} Entities with pagination metadata.
   * @throws {Error} If the request fails.
   */
  async getEntities(params: EntityQueryParams = {}): Promise<EntityQueryResponse> {
    const { type, page = 1, limit = 12, search, status } = params;

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(page));
    queryParams.set('limit', String(limit));

    if (type) {
      queryParams.set('type', type);
    }
    if (search) {
      queryParams.set('search', search);
    }
    if (status && status !== 'all') {
      queryParams.set('status', status);
    }

    const data = await fetchWrapper<EntityQueryResponse>(`/entities?${queryParams.toString()}`);
    return data;
  },

  /**
   * Fetches a single entity by ID.
   * @param {number} id - The entity ID.
   * @returns {Promise<Entity>} The Entity object.
   * @throws {Error} If the request fails.
   */
  async getEntityById(id: number): Promise<Entity> {
    const data = await fetchWrapper<{ entity: Entity }>(`/entities/${id}`);
    return data.entity;
  },

  /**
   * Creates a new entity.
   * @param {CreateEntityData} data - The entity data including type, name, and optional description.
   * @returns {Promise<number>} The ID of the newly created entity.
   * @throws {Error} If the request fails.
   */
  async createEntity(data: CreateEntityData): Promise<number> {
    const response = await fetchWrapper<{ entityId: number }>('/entities', {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.entityId;
  },

  /**
   * Updates an entity's metadata.
   * @param {number} id - The entity ID.
   * @param {UpdateEntityData} data - The partial metadata to merge.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async updateEntity(id: number, data: UpdateEntityData): Promise<void> {
    return fetchWrapper(`/entities/${id}`, {
      method: HTTP_METHODS.PUT,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  /**
   * Deletes an entity by ID.
   * @param {number} id - The entity ID.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async deleteEntity(id: number): Promise<void> {
    return fetchWrapper(`/entities/${id}`, { method: HTTP_METHODS.DELETE });
  },

  /**
   * Uploads a single file for an entity.
   * @param {number} entityId - The entity ID.
   * @param {File} file - The file to upload.
   * @returns {Promise<string>} The path where the file was moved.
   * @throws {Error} If the request fails.
   */
  async uploadFile(entityId: number, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('document', file);
    const data = await fetchWrapper<{ path: string }>(`/entities/${entityId}/upload`, {
      method: HTTP_METHODS.POST,
      body: formData,
    });
    return data.path;
  },

  /**
   * Uploads multiple files for an entity.
   * @param {number} entityId - The entity ID.
   * @param {File[]} files - The files to upload.
   * @returns {Promise<string[]>} The paths where the files were moved.
   * @throws {Error} If the request fails.
   */
  async uploadFiles(entityId: number, files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach(f => formData.append('documents', f));
    const data = await fetchWrapper<{ paths: string[] }>(`/entities/${entityId}/upload`, {
      method: HTTP_METHODS.POST,
      body: formData,
    });
    return data.paths;
  },

  /**
   * Fetches all files in an entity's folder.
   * @param {number} entityId - The entity ID.
   * @returns {Promise<EntityFiles>} Object containing array of file names.
   * @throws {Error} If the request fails.
   */
  async getFiles(entityId: number): Promise<EntityFiles> {
    return fetchWrapper<EntityFiles>(`/entities/${entityId}/files`);
  },

  /**
   * Fetches criteria for a specific entity.
   * @param {number} entityId - The entity ID.
   * @returns {Promise<Criterion[]>} Array of Criterion objects.
   * @throws {Error} If the request fails.
   */
  async getCriteria(entityId: number): Promise<Criterion[]> {
    const data = await fetchWrapper<{ criteria: Criterion[] }>(`/entities/${entityId}/criteria`);
    return data.criteria;
  },

  /**
   * Fetches matches for a specific entity.
   * @param {number} entityId - The entity ID.
   * @param {EntityType} [role] - Optional role filter.
   * @returns {Promise<EntityMatch[]>} Array of EntityMatch objects.
   * @throws {Error} If the request fails.
   */
  async getMatches(entityId: number, role?: EntityType): Promise<EntityMatch[]> {
    const data = await fetchWrapper<{ matches: EntityMatch[] }>(`/entities/${entityId}/matches`, {
      params: role ? { role } : undefined,
    });
    return data.matches;
  },

  /**
   * Opens the entity's folder in the native OS file manager.
   * @param {number} id - The entity ID.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async openFolder(id: number): Promise<void> {
    return fetchWrapper(`/entities/${id}/folder/open`, { method: HTTP_METHODS.POST });
  },

  /**
   * Triggers AI criteria extraction on a specific file for an entity.
   * @param {number} entityId - The entity ID.
   * @param {string} fileName - The name of the file to extract criteria from.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async extractCriteria(entityId: number, fileName: string): Promise<void> {
    return fetchWrapper(`/entities/${entityId}/extract`, {
      method: HTTP_METHODS.POST,
      body: JSON.stringify({ fileName }),
    });
  },

  /**
   * Cancels all pending or processing extraction tasks for an entity.
   * @param {number} entityId - The entity ID.
   * @returns {Promise<void>}
   * @throws {Error} If the request fails.
   */
  async cancelExtraction(entityId: number): Promise<void> {
    return fetchWrapper(`/entities/${entityId}/extract`, { method: HTTP_METHODS.DELETE });
  },

  /**
   * Fetches a paginated chunk of evaluated matches for an entity.
   * @param {number} entityId - The entity ID.
   * @param {number} offset - The offset for pagination (0-indexed).
   * @param {number} limit - The number of entities to evaluate in this chunk.
   * @returns {Promise<{ evaluatedChunk: any[], totalOpposites: number }>} Chunk of evaluated matches with total count.
   * @throws {Error} If the request fails.
   */
  async getTopMatches(entityId: number, offset: number, limit: number): Promise<{ evaluatedChunk: { entity: Entity; score: number; existingMatchId: number | null; existingMatchStatus: EntityStatus | 'error' | null }[], totalOpposites: number }> {
    const data = await fetchWrapper<{ evaluatedChunk: any[], totalOpposites: number }>(
      `/entities/${entityId}/top-matches?offset=${offset}&limit=${limit}`
    );
    return data;
  },

  /**
   * Retries the AI extraction process for a failed entity.
   * @param {number} id - The ID of the entity to retry.
   * @returns {Promise<void>}
   */
  retryProcessing: async (id: number): Promise<void> => {
    await fetchWrapper(`/entities/${id}/retry`, { method: HTTP_METHODS.POST });
  },

  /**
   * Triggers the generation of the master file for an entity (Debug).
   * @param {number} id - The entity ID.
   * @returns {Promise<void>}
   */
  async writeMasterFile(id: number): Promise<void> {
    return fetchWrapper(`/entities/${id}/master-file`, { method: HTTP_METHODS.POST });
  },

  /**
   * Fetches the generated master markdown file content for an entity.
   * @param {number} id - The entity ID.
   * @returns {Promise<string>} The master file markdown content.
   * @throws {Error} If the master file has not been generated yet.
   */
  async getMasterFile(id: number): Promise<string> {
    const data = await fetchWrapper<{ success: boolean; data: string }>(`/entities/${id}/master-file`);
    return data.data;
  },
};
