/**
 * @module DynamicSchemaBuilder
 * @description Utility class for building dynamic JSON Schemas based on active dimensions.
 * @responsibility
 * - Constructs JSON Schema objects dynamically from dimension configurations.
 * - Injects dimension descriptions to guide the LLM during extraction.
 * - Ensures schema compliance while being flexible to dimension changes.
 * @boundary_rules
 * - ✅ MUST be imported by workflows that need dynamic schema generation.
 * - ❌ MUST NOT contain business logic - only schema construction.
 * 
 * @dependency_injection
 * Enforces constructor injection per ARCHITECTURE.md Section 2.
 * logService is received via constructor for validation warnings.
 * 
 * @separation_of_concerns
 * Uses logService.logTerminal for validation warnings. This is infrastructure-level
 * logging (schema validation failures) that doesn't need file persistence.
 */

const { ENTITY_ROLES, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class DynamicSchemaBuilder {
    /**
     * @dependency_injection
     * Enforces constructor injection per ARCHITECTURE.md Section 2.
     * @param {Object} options - Dependency object
     * @param {Object} options.logService - The LogService instance (must be injected)
     */
    constructor({ logService }) {
        this._logService = logService;
    }

    _log(message, level = LOG_LEVELS.WARN, symbol = LOG_SYMBOLS.WARNING) {
        if (this._logService) {
            this._logService.logTerminal(level, symbol, 'DynamicSchemaBuilder', message);
        }
    }

    /**
     * Builds a JSON Schema for extracting criteria across active dimensions.
     * The schema mandates an object where keys are dimension names and values are arrays of strings.
     * Each dimension's description is injected into the schema to guide the LLM.
     * 
     * @method buildExtractionSchema
     * @memberof DynamicSchemaBuilder
     * @param {Array<Object>} activeDimensions - Array of dimension objects from DimensionRepo.getActiveDimensions().
     *                                            Each object should have: { id, name, displayName, description, isActive }
     * @returns {Object} A JSON Schema object for structured LLM output.
     * 
     * @example
     * const activeDimensions = [
     *   { name: 'core_competencies', displayName: 'Core Competencies', description: 'Extract all hard skills...' },
     *   { name: 'experience', displayName: 'Experience', description: 'Extract years of experience...' }
     * ];
     * const schema = DynamicSchemaBuilder.buildExtractionSchema(activeDimensions, 'source');
     * // Returns: { type: 'object', properties: { core_competencies: {...}, experience: {...} }, required: [...] }
     * // Each property description uses the source_instruction or target_instruction based on entityRole.
     */
    buildExtractionSchema(activeDimensions, entityRole = ENTITY_ROLES.OFFERING) {
        if (!Array.isArray(activeDimensions) || activeDimensions.length === 0) {
            throw new Error('Active dimensions array is required and must not be empty.');
        }

        const properties = {};
        const required = [];

        // Chain of Thought: Force the LLM to reason before outputting criteria arrays
        properties['analysis'] = {
            type: 'string',
            description: 'Briefly explain your thought process for extracting criteria for this dimension from the text. Think step-by-step to ensure accuracy, atomicity, and that no fluff is included.'
        };
        required.push('analysis');

        for (const dimension of activeDimensions) {
            if (!dimension.name) {
                this._log(`Skipping dimension with missing name: ${JSON.stringify(dimension)}`);
                continue;
            }

            // Use directional instruction based on entity role
            const instruction = entityRole === ENTITY_ROLES.REQUIREMENT 
                ? dimension.requirementInstruction 
                : dimension.offeringInstruction;
            
            const description = instruction || `Extract ${dimension.name} criteria`;

            properties[dimension.name] = {
                type: 'array',
                items: { type: 'string' },
                description: description
            };

            required.push(dimension.name);
        }

        if (Object.keys(properties).length === 0) {
            throw new Error('No valid dimensions found to build schema.');
        }

        const schema = {
            type: 'object',
            properties,
            required
        };

        return schema;
    }

    /**
     * Builds a JSON Schema that enforces atomic strings (single concept per item).
     * This is useful when strict atomicity rules need to be enforced in the schema.
     * 
     * @method buildAtomicSchema
     * @memberof DynamicSchemaBuilder
     * @param {Array<Object>} activeDimensions - Array of dimension objects.
     * @returns {Object} JSON Schema with atomic item constraints.
     */
    buildAtomicSchema(activeDimensions) {
        const baseSchema = this.buildExtractionSchema(activeDimensions);

        for (const dimension of activeDimensions) {
            if (baseSchema.properties[dimension.name]) {
                baseSchema.properties[dimension.name].items = {
                    type: 'string',
                    minLength: 1,
                    maxLength: 100
                };
            }
        }

        return baseSchema;
    }

    /**
     * Builds a JSON Schema for extracting entity metadata based on blueprint fields.
     * This method dynamically constructs a schema from BlueprintField objects,
     * mapping field types to valid JSON Schema types and including field descriptions
     * to guide the LLM during extraction.
     * 
     * Note: Filtering by entityRole is handled at the database level by BlueprintRepo.getBlueprintFields(),
     * so this method receives only the relevant fields and iterates directly over them.
     * 
     * @method buildMetadataSchema
     * @memberof DynamicSchemaBuilder
     * @param {Array<Object>} blueprintFields - Array of BlueprintField objects from BlueprintRepo.getBlueprintFields().
     *                                           Each object should have: { fieldName, fieldType, description, isRequired, entityRole }
     * @returns {Object} A JSON Schema object for structured LLM metadata output.
     * 
     * @example
     * const fields = [
     *   { fieldName: 'title', fieldType: 'string', description: 'Job title or professional role', isRequired: true },
     *   { fieldName: 'email', fieldType: 'string', description: 'Email address for contact', isRequired: true },
     *   { fieldName: 'postedDate', fieldType: 'date', description: 'Date when job was posted', isRequired: false }
     * ];
     * const schema = DynamicSchemaBuilder.buildMetadataSchema(fields);
     * // Returns: { type: 'object', properties: { title: { type: 'string', description: ... }, ... }, required: ['title', 'email'] }
     */
    buildMetadataSchema(blueprintFields) {
        if (!Array.isArray(blueprintFields) || blueprintFields.length === 0) {
            throw new Error('Blueprint fields array is required and must not be empty.');
        }

        const properties = {};
        const required = [];

        const typeMap = {
            'string': 'string',
            'date': 'string',
            'number': 'number',
            'boolean': 'boolean'
        };

        for (const field of blueprintFields) {
            const fieldName = field.fieldName || field.field_name;
            const fieldType = field.fieldType || field.field_type;
            const description = field.description || field.description;
            const isRequired = field.isRequired || field.is_required;
            
            if (!fieldName || !fieldType) {
                this._log(`Skipping field with missing name or type: ${JSON.stringify(field)}`);
                continue;
            }

            const jsonSchemaType = typeMap[fieldType] || 'string';

            properties[fieldName] = {
                type: jsonSchemaType,
                description: description || `Extract the ${fieldName} field value.`
            };

            if (isRequired) {
                required.push(fieldName);
            }
        }

        if (Object.keys(properties).length === 0) {
            throw new Error('No valid fields found to build metadata schema.');
        }

        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined
        };
    }
}

module.exports = DynamicSchemaBuilder;