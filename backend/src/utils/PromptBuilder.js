/**
 * @module PromptBuilder
 * @description Domain Layer utility for constructing LLM prompts.
 *
 * @responsibility
 * - Builds message arrays for entity extraction, markdown conversion, and dynamic extraction.
 * - Contains all business rules for prompt engineering.
 *
 * @boundary_rules
 * - ✅ MUST know about Entities and Assessments.
 * - ❌ MUST NOT directly call infrastructure services (AiService).
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor.
 * Defensive getters are not required as instantiation guarantees dependency presence.
 * Reasoning: Constructor Injection ensures promptRepo is available immediately after construction.
 */

const { ENTITY_ROLES, PROMPT_SYSTEM_NAMES } = require('../config/constants');

class PromptBuilder {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.promptRepo - The PromptRepo instance
     * @dependency_injection Dependencies are injected strictly via the constructor.
     * Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ promptRepo }) {
        this._promptRepo = promptRepo;
    }

    getPromptBySystemName(systemName) {
        return this._promptRepo.getPromptBySystemName(systemName);
    }

    _inject(template, vars) {
        let result = template;
        for (const key of Object.keys(vars)) {
            result = result.replace(new RegExp('{{' + key + '}}', 'g'), vars[key]);
        }
        return result;
    }

    _buildMessages(systemName, templateVars, userContent) {
        const template = this._promptRepo.getPromptBySystemName(systemName).prompt;
        const systemPrompt = this._inject(template, templateVars);
        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ];
    }

    buildMarkdownExtractionMessages(rawText) {
        const template = this._promptRepo.getPromptBySystemName(PROMPT_SYSTEM_NAMES.MARKDOWN_EXTRACTION).prompt;
        return [
            { role: 'system', content: template },
            { role: 'user', content: rawText }
        ];
    }

    /**
     * Builds message array for extracting entity metadata as structured JSON.
     * Uses a single LLM call with structured output to extract all metadata fields at once.
     * This method is dynamic - it constructs the schema and instructions based on
     * the provided blueprint fields rather than using hardcoded fields.
     * 
     * @method buildEntityMetadataMessages
     * @memberof PromptBuilder
     * @param {string} rawText - The raw text extracted from the source document.
     * @param {string} blueprintName - The name of the blueprint (e.g., "Job Posting", "Candidate Profile").
     * @param {Array<Object>} blueprintFields - Array of BlueprintField objects from BlueprintRepo.getBlueprintFields().
     *                                           Each should have: { fieldName, fieldType, description, isRequired }
     * @returns {Array} Array of message objects for the LLM with system and user roles.
     */
    buildEntityMetadataMessages(rawText, blueprintName, blueprintFields) {
        if (!Array.isArray(blueprintFields) || blueprintFields.length === 0) {
            throw new Error('Blueprint fields are required to build metadata extraction messages.');
        }

        const fieldsList = blueprintFields.map(field => {
            const required = field.isRequired ? ' (required)' : ' (optional)';
            return `- ${field.fieldName} (${field.fieldType})${required}: ${field.description}`;
        }).join('\n');

        return this._buildMessages(PROMPT_SYSTEM_NAMES.ENTITY_METADATA, { blueprintName, fieldsList }, rawText);
    }

    /**
     * Builds message array for dynamic extraction based on active dimensions from the database.
     * Instead of hardcoded 5 dimensions, this method dynamically constructs the system prompt
     * by iterating through the active dimensions and formatting them into a numbered list.
     * 
     * @method buildDynamicExtractionMessages
     * @memberof PromptBuilder
     * @param {string} rawText - The raw text from source document or target profile.
     * @param {Array<Object>} activeDimensions - Array of dimension objects from DimensionRepo.getActiveDimensions().
     *                                            Each should have: { id, name, displayName, description, isActive }
     * @returns {Array<Object>} Array of message objects for the LLM with system and user roles.
     * 
     * @example
     * const activeDimensions = [
     *   { name: 'core_competencies', displayName: 'Core Competencies', description: 'Extract all hard skills...' },
     *   { name: 'experience', displayName: 'Experience', description: 'Extract years of experience...' }
     * ];
     * const messages = PromptBuilder.buildDynamicExtractionMessages(text, activeDimensions, 'source');
     */
    buildDynamicExtractionMessages(rawText, activeDimensions, entityRole = ENTITY_ROLES.OFFERING) {
        if (!Array.isArray(activeDimensions) || activeDimensions.length === 0) {
            throw new Error('Active dimensions array is required and must not be empty.');
        }

        const getInstruction = (dim) => {
            return entityRole === ENTITY_ROLES.REQUIREMENT ? dim.requirementInstruction : dim.offeringInstruction;
        };

        const dimensionList = activeDimensions.map((dim, index) => {
            const instruction = getInstruction(dim);
            return `${index + 1}. ${dim.displayName}: ${instruction}`;
        }).join('\n');

        const exampleOutput = {
            analysis: "The text mentions requiring a React developer with Node.js backend experience. I will split these into two atomic criteria.",
        };
        for (const dim of activeDimensions) {
            exampleOutput[dim.name] = ['React', 'Node.js'];
        }
        const exampleJsonString = JSON.stringify(exampleOutput, null, 2);

        const roleLabel = entityRole === ENTITY_ROLES.REQUIREMENT ? 'requirement document (defines criteria and needs)' : 'offering profile (possesses skills and attributes)';

        return this._buildMessages(PROMPT_SYSTEM_NAMES.DYNAMIC_EXTRACTION, { roleLabel, dimensionCount: activeDimensions.length, dimensionList, exampleJsonString }, rawText);
    }

    /**
     * Builds message array for generating an executive summary from dimensional summaries.
     * Uses a Map-Reduce pattern: first generates dimensional summaries (map), then synthesizes
     * them into a single executive summary (reduce).
     * 
     * This method maps dynamic dimensional outputs into a single prompt for executive synthesis.
     * It extracts dimension names from the map keys and injects dynamic entity names into the
     * system prompt template using the _inject method for DRY compliance.
     * 
     * @method buildExecutiveSummaryMessages
     * @memberof PromptBuilder
     * @param {Object} dimensionalSummariesMap - Object mapping dimension names to their string summaries.
     *                                           E.g., { core_competencies: "Summary text...", soft_skills: "Summary text..." }
     * @param {string} requirementName - The name of the requirement entity (e.g., "Senior Software Engineer").
     * @param {string} offeringName - The name of the offering entity (e.g., "John Doe").
     * @returns {Array<Object>} Array of message objects for the LLM with system and user roles.
     *                           Structure: [{ role: 'system', content: <injected template> }, { role: 'user', content: <compiled dimensional summaries> }]
     */
    buildExecutiveSummaryMessages(dimensionalSummariesMap, requirementName, offeringName) {
        const dimensionNames = Object.keys(dimensionalSummariesMap).join(', ');

        const userContent = Object.entries(dimensionalSummariesMap)
            .map(([dimension, summary]) => `### ${dimension}\n${summary}\n\n`)
            .join('');

        return this._buildMessages(PROMPT_SYSTEM_NAMES.EXECUTIVE_SUMMARY, { requirementName, offeringName, dimensionNames }, userContent);
    }

    /**
     * Builds message array for generating a Markdown summary of a match report.
     * @method buildMatchSummaryMessages
     * @memberof PromptBuilder
     * @param {Object} reportJson - The structured JSON report data (general or dimensional).
     * @returns {Array<Object>} Array of message objects for the LLM.
     */
    buildMatchSummaryMessages(reportJson) {
        const template = this._promptRepo.getPromptBySystemName(PROMPT_SYSTEM_NAMES.MATCH_SUMMARY).prompt;
        return [
            { role: 'system', content: template },
            { role: 'user', content: JSON.stringify(reportJson, null, 2) }
        ];
    }
}

/**
 * @dependency_injection
 * PromptBuilder exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * Reasoning: Constructor Injection ensures promptRepo is available immediately.
 */
module.exports = PromptBuilder;