/**
 * @module types
 * @description Central TypeScript type definitions for the Compari frontend.
 * Consolidates all domain types for entities, matches, queues, and criteria.
 * Uses centralized constants from ./constants.ts for type safety and DRY principle.
 */

import { ENTITY_ROLES, AI_MODEL_ROLES, FIELD_TYPES, TOAST_TYPES } from './constants';

/**
 * Entity Type derived from centralized constants.
 * Uses ENTITY_ROLES to ensure runtime type safety and prevent typo-induced bugs.
 */
export type EntityType = typeof ENTITY_ROLES[keyof typeof ENTITY_ROLES];

/**
 * AI Model Role derived from centralized constants.
 * Ensures consistent typing across the application.
 */
export type AiModelRole = typeof AI_MODEL_ROLES[keyof typeof AI_MODEL_ROLES];

/**
 * Blueprint Field Type derived from centralized constants.
 * Prevents magic string errors in field type definitions.
 */
export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES];

export type ToastType = typeof TOAST_TYPES[keyof typeof TOAST_TYPES];

/**
 * Unified Entity interface replacing separate User and JobListing types.
 * Stores type-specific attributes in the metadata JSON column.
 * 
 * Note: The 'status' field is the single source of truth for entity processing state.
 * It must conform to ENTITY_STATUS constants (pending, processing, completed, failed).
 */
export interface Entity {
  id: number;
  type: EntityType;
  name: string;
  description: string | null;
  folder_path: string | null;
  metadata: Record<string, unknown>;
  status: string | null;
  error: string | null;
  blueprint_id: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface EntityFiles {
  files: string[];
}

export interface EntityMatch {
  id: number;
  requirement_id: number;
  offering_id: number;
  match_score: number | null;
  report_path: string | null;
  folder_path: string | null;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  error: string | null;
  created_at: string | null;
  updated_at?: string | null;
  requirement_name?: string;
  offering_name?: string;
  requirement_description?: string;
  offering_description?: string;
  requirement_metadata?: Record<string, unknown> | string | null;
  requirement_blueprint_id?: number | null;
  offering_metadata?: Record<string, unknown> | string | null;
  offering_blueprint_id?: number | null;
}

export interface Settings {
  ollama_host: string;
  ollama_model: string;
  auto_merge_threshold?: string;
  minimum_match_floor?: string;
  perfect_match_score?: string;
  /**
   * Controls whether AI prompts and responses are captured in System Logs for debugging match quality.
   * When set to 'true', detailed AI traffic is logged. When 'false', logging is disabled.
   * @description This setting is stored as a string ('true'/'false') to match backend storage format.
   */
  log_ai_interactions?: string;
  /**
   * Controls whether the AI should verify criteria synonyms before merging them.
   * When set to 'true', AI double-checks if similar criteria are true synonyms before merging.
   * When 'false', merges are based solely on vector similarity.
   */
  ai_verify_merges?: string;
  /**
   * Model ID assigned to general chat tasks (entity extraction, summarization).
   */
  model_routing_general?: string;
  /**
   * Model ID assigned to fast verification tasks (synonym checking).
   */
  model_routing_verification?: string;
/**
    * Model ID assigned to embedding tasks (vectorization).
    */
  model_routing_embedding?: string;
/**
     * Model ID assigned to metadata extraction tasks (simple field extraction).
     */
  model_routing_metadata?: string;
  /**
   * Controls whether AI requests are executed concurrently or sequentially.
   * Enable for cloud AI providers (e.g., OpenAI) for faster extraction.
   * Disable for local models (e.g., Ollama) to prevent queue thrashing.
   */
  allow_concurrent_ai?: string;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export interface SSEEntityUpdate {
  timestamp: number;
}

export interface SSENotification {
  type: ToastType;
  message: string;
}

export interface QueueTask {
  id: number;
  task_type: string;
  payload: Record<string, unknown>;
  started_at?: string;
  created_at?: string;
  duration_seconds?: number;
}

/**
 * Activity Log interface for tracking entity-related activities.
 * Stores log entries for entity operations, processing events, and user actions.
 */
export interface ActivityLog {
  id: number;
  timestamp: string;
  log_type: string;
  message: string;
}

export interface QueueStatus {
  worker_active: boolean;
  processing: QueueTask | null;
  pending: QueueTask[];
}

/**
 * Queue Task Types
 * @description TypeScript union type for generic queue task constants.
 * Updated to match consolidated backend task names.
 */
export const QUEUE_TASKS = {
  PROCESS_ENTITY_DOCUMENT: 'PROCESS_ENTITY_DOCUMENT',
  EXTRACT_ENTITY_CRITERIA: 'EXTRACT_ENTITY_CRITERIA',
  ASSESS_ENTITY_MATCH: 'ASSESS_ENTITY_MATCH'
} as const;

export type QueueTaskType = typeof QUEUE_TASKS[keyof typeof QUEUE_TASKS];

export interface SSEMatchUpdate {
  id: number;
  requirement_id: number;
  offering_id: number;
  match_score: number | null;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  requirement_name?: string;
  offering_name?: string;
  folder_path?: string | null;
  report_path?: string | null;
}

export interface Criterion {
  id: number;
  normalizedName: string;
  displayName: string;
  dimension: string;
  dimensionId?: number;
  embedding?: number[];
  isRequired?: boolean;
}

export interface AiModel {
  id: number;
  name: string;
  modelIdentifier: string;
  apiUrl: string | null;
  apiKey: string | null;
  role: AiModelRole;
  /**
   * Controls response randomness (0.0 to 2.0).
   * Lower values produce more deterministic responses, higher values increase creativity.
   */
  temperature?: number;
  /**
   * Maximum token limit for the model's context window.
   * Determines how much text the model can process in a single request.
   */
  contextWindow?: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dimension interface representing an AI extraction dimension.
 * Used by Blueprints to define which dimensions apply to entities.
 * Contains directional instructions for requirement vs offering extraction.
 */
export interface Dimension {
  id: number;
  name: string;
  displayName: string;
  requirementInstruction: string;
  offeringInstruction: string;
  isActive: boolean;
  weight: number;
}

/**
 * Blueprint Field interface representing a metadata field definition within a Blueprint.
 * Defines the expected metadata fields and their extraction instructions.
 */
export interface BlueprintField {
  id: number;
  blueprint_id: number;
  field_name: string;
  field_type: FieldType;
  description: string;
  is_required: boolean;
  entity_role: EntityType;
}

/**
 * Blueprint interface representing an Entity Blueprint.
 * Defines expected metadata fields and which AI dimensions apply to entities created from it.
 * Contains singular and plural labels for both requirements and offerings.
 */
export interface Blueprint {
  id: number;
  name: string;
  requirementLabelSingular: string;
  requirementLabelPlural: string;
  offeringLabelSingular: string;
  offeringLabelPlural: string;
  requirementDocTypeLabel: string;
  offeringDocTypeLabel: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fields?: BlueprintField[];
  dimensions?: Dimension[];
}

export interface Prompt {
  id: number;
  system_name: string;
  title: string;
  description: string;
  prompt: string;
  updated_at: string;
}
