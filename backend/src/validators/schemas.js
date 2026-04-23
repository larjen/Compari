/**
 * @module validators/schemas
 * @description Centralized Zod validation schemas for request body validation.
 * 
 * @socexplanation
 * - Provides strict type-safe schemas for all domain entities.
 * - Eliminates manual validation logic from controllers.
 * - Enforces DRY principle by centralizing validation rules.
 * - Uses centralized constants from ../config/constants.js to prevent magic strings.
 * - Used by validateZod middleware for request body parsing.
 */

const { z } = require('zod');
const { ENTITY_TYPES, AI_MODEL_ROLES } = require('../config/constants');

/**
 * @typedef {Object} AiModelInput
 * @property {string} name - The display name of the AI model.
 * @property {string} model_identifier - The unique identifier for the model (e.g., 'gpt-4').
 * @property {string|null} [api_url] - Optional API endpoint URL (can be null).
 * @property {string|null} [api_key] - Optional API key for authentication (can be null).
 * @property {'chat'|'embedding'} role - The role of the model.
 * @property {number|null} [temperature] - Optional temperature setting (0-2, can be null).
 * @property {number|null} [contextWindow] - Optional context window size (min 1024, can be null).
 */

/**
 * Schema for validating AI model input.
 * @type {z.ZodSchema<AiModelInput>}
 */
const aiModelSchema = z.object({
    name: z.string().min(1, 'name is required'),
    model_identifier: z.string().min(1, 'model_identifier is required'),
    api_url: z.string().nullable().optional(),
    api_key: z.string().nullable().optional(),
    role: z.enum(Object.values(AI_MODEL_ROLES)),
    temperature: z.number().min(0).max(2).nullable().optional(),
    contextWindow: z.number().int().min(1024).nullable().optional()
});

/**
 * @typedef {Object} BlueprintInput
 * @property {string} name - The name of the blueprint.
 * @property {string} requirementLabelSingular - Singular label for requirements.
 * @property {string} requirementLabelPlural - Plural label for requirements.
 * @property {string} offeringLabelSingular - Singular label for offerings.
 * @property {string} offeringLabelPlural - Plural label for offerings.
 */

/**
 * Schema for validating blueprint input.
 * @type {z.ZodSchema<BlueprintInput>}
 */
const blueprintSchema = z.object({
    name: z.string().min(1, 'name is required'),
    requirementLabelSingular: z.string().min(1, 'requirementLabelSingular is required'),
    requirementLabelPlural: z.string().min(1, 'requirementLabelPlural is required'),
    offeringLabelSingular: z.string().min(1, 'offeringLabelSingular is required'),
    offeringLabelPlural: z.string().min(1, 'offeringLabelPlural is required')
});

/**
 * @typedef {Object} DimensionInput
 * @property {string} name - The unique name/key of the dimension.
 * @property {string} displayName - The display name shown in the UI.
 * @property {string} requirementInstruction - Instructions for requirements in this dimension.
 * @property {string} offeringInstruction - Instructions for offerings in this dimension.
 */

/**
 * Schema for validating dimension input.
 * @type {z.ZodSchema<DimensionInput>}
 */
const dimensionSchema = z.object({
    name: z.string().min(1, 'name is required'),
    displayName: z.string().min(1, 'displayName is required'),
    requirementInstruction: z.string().min(1, 'requirementInstruction is required'),
    offeringInstruction: z.string().min(1, 'offeringInstruction is required'),
    weight: z.number().min(0.2).max(3).optional()
});

/**
 * @typedef {Object} EntityInput
 * @property {'requirement'|'offering'} type - The type of entity.
 * @property {string} name - The name/title of the entity.
 */

/**
 * Schema for validating entity input.
 * @type {z.ZodSchema<EntityInput>}
 */
const entitySchema = z.object({
    type: z.enum([ENTITY_TYPES.REQUIREMENT, ENTITY_TYPES.OFFERING]),
    name: z.string().min(1, 'name is required')
});

/**
 * @typedef {Object} MatchInput
 * @property {number} requirementEntityId - The ID of the requirement entity.
 * @property {number} offeringEntityId - The ID of the offering entity.
 */

/**
 * Schema for validating match input.
 * @type {z.ZodSchema<MatchInput>}
 */
const matchSchema = z.object({
    requirementEntityId: z.number().int('requirementEntityId must be an integer'),
    offeringEntityId: z.number().int('offeringEntityId must be an integer')
});

/**
 * @typedef {Object} ExtractInput
 * @property {string} fileName - The name of the file to extract from.
 */

/**
 * Schema for validating entity extraction input.
 * @type {z.ZodSchema<ExtractInput>}
 */
const extractSchema = z.object({
    fileName: z.string().min(1, 'fileName is required')
});

module.exports = {
    aiModelSchema,
    blueprintSchema,
    dimensionSchema,
    entitySchema,
    matchSchema,
    extractSchema
};
