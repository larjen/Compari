/**
 * @module PromptBuilder
 * @description Domain Layer utility for constructing LLM prompts.
 * * @responsibility
 * - Builds message arrays for entity extraction, markdown conversion, and dynamic extraction.
 * - Contains all business rules for prompt engineering.
 * * @boundary_rules
 * - ✅ MUST know about Entities and Assessments.
 * - ❌ MUST NOT directly call infrastructure services (AiService).
 */
const fs = require('fs');
const path = require('path');

class PromptBuilder {
    constructor() {
        const promptsDir = path.join(__dirname, '../prompts');
        this.markdownTemplate = fs.readFileSync(path.join(promptsDir, 'markdown_extraction.md'), 'utf-8');
        this.metadataTemplate = fs.readFileSync(path.join(promptsDir, 'entity_metadata.md'), 'utf-8');
        this.dynamicTemplate = fs.readFileSync(path.join(promptsDir, 'dynamic_extraction.md'), 'utf-8');
        this.matchSummaryTemplate = fs.readFileSync(path.join(promptsDir, 'match_summary.md'), 'utf-8');
        this.executiveSummaryTemplate = fs.readFileSync(path.join(promptsDir, 'executive_summary.md'), 'utf-8');
    }

    _inject(template, vars) {
        let result = template;
        for (const key of Object.keys(vars)) {
            result = result.replace(new RegExp('{{' + key + '}}', 'g'), vars[key]);
        }
        return result;
    }

    buildMarkdownExtractionMessages(rawText) {
        const systemPrompt = this.markdownTemplate;
        return [
            { role: 'system', content: systemPrompt },
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

        const systemPrompt = this._inject(this.metadataTemplate, {
            blueprintName,
            fieldsList
        });

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: rawText }
        ];
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
    buildDynamicExtractionMessages(rawText, activeDimensions, entityRole = 'offering') {
        if (!Array.isArray(activeDimensions) || activeDimensions.length === 0) {
            throw new Error('Active dimensions array is required and must not be empty.');
        }

        const getInstruction = (dim) => {
            return entityRole === 'requirement' ? dim.requirementInstruction : dim.offeringInstruction;
        };

        const dimensionList = activeDimensions.map((dim, index) => {
            const instruction = getInstruction(dim);
            return `${index + 1}. ${dim.displayName}: ${instruction}`;
        }).join('\n');

        const exampleOutput = {};
        for (const dim of activeDimensions) {
            exampleOutput[dim.name] = ['example 1', 'example 2'];
        }
        const exampleJsonString = JSON.stringify(exampleOutput, null, 2);

        const roleLabel = entityRole === 'requirement' ? 'requirement document (defines criteria and needs)' : 'offering profile (possesses skills and attributes)';

        const systemPrompt = this._inject(this.dynamicTemplate, {
            roleLabel,
            dimensionCount: activeDimensions.length,
            dimensionList,
            exampleJsonString
        });

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: rawText }
        ];
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

        const systemPrompt = this._inject(this.executiveSummaryTemplate, {
            requirementName,
            offeringName,
            dimensionNames
        });

        const userContent = Object.entries(dimensionalSummariesMap)
            .map(([dimension, summary]) => `### ${dimension}\n${summary}\n\n`)
            .join('');

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ];
    }

    /**
     * Builds message array for generating a Markdown summary of a match report.
     * @method buildMatchSummaryMessages
     * @memberof PromptBuilder
     * @param {Object} reportJson - The structured JSON report data (general or dimensional).
     * @returns {Array<Object>} Array of message objects for the LLM.
     */
    buildMatchSummaryMessages(reportJson) {
        return [
            { role: 'system', content: this.matchSummaryTemplate },
            { role: 'user', content: JSON.stringify(reportJson, null, 2) }
        ];
    }
}

module.exports = new PromptBuilder();