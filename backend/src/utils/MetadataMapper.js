/**
 * @module MetadataMapper
 * @description Utility for mapping raw AI JSON responses to blueprint field schemas.
 * 
 * @responsibility
 * - Parses JSON strings returned by AI services.
 * - Maps AI output to blueprint fields with proper fallback handling.
 * - Provides consistent "Unknown" vs null semantics for required vs optional fields.
 * 
 * @soc_explanation
 * This utility is responsible for the structural integrity of extracted metadata. 
 * It ensures AI output strictly follows the schema defined in the Blueprint.
 * 
 * SoC: This utility is responsible for mapping loose AI generated data into the strict schema defined by a Blueprint.
 * 
 * @boundary_rules
 * - ✅ MAY be used by any workflow or service that extracts AI-generated metadata.
 * - ❌ MUST NOT directly call repositories or services.
 * - ❌ MUST NOT contain business logic beyond field mapping.
 * 
 * @separation_of_concerns
 * Uses logService.logTerminal for validation warnings. This is infrastructure-level
 * logging (validation failures) that doesn't need file persistence.
 */

const logService = require('../services/LogService');
const { LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

/**
 * Maps raw AI JSON response to blueprint fields with proper fallback handling.
 * 
 * @function mapRawAiResponseToBlueprint
 * @param {Object} parsedJson - The parsed JSON object from AI response.
 * @param {Array<{fieldName: string, isRequired: boolean}>} blueprintFields - Array of blueprint field definitions.
 * @returns {Object} A mapped object with fields populated according to requirements.
 * 
 * @handling_rules
 * - For required fields: Returns "Unknown" if value is missing, null, or empty string.
 * - For optional fields: Returns null if value is missing, null, or empty string.
 * - If JSON parsing fails entirely, all required fields get "Unknown" and optional fields get null.
 * 
 * @example
 * const blueprintFields = [
 *   { fieldName: 'title', isRequired: true },
 *   { fieldName: 'description', isRequired: false }
 * ];
 * const aiResponse = { title: "Software Engineer" };
 * const result = mapRawAiResponseToBlueprint(aiResponse, blueprintFields);
 * // result: { title: "Software Engineer", description: null }
 */
function mapRawAiResponseToBlueprint(parsedJson, blueprintFields) {
    const dynamicMetadata = {};
    
    if (!parsedJson || typeof parsedJson !== 'object') {
        logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'MetadataMapper', 'Invalid parsed JSON, applying fallback values.');
        for (const field of blueprintFields) {
            dynamicMetadata[field.fieldName] = field.isRequired ? 'Unknown' : null;
        }
        return dynamicMetadata;
    }
    
    for (const field of blueprintFields) {
        const value = parsedJson[field.fieldName];
        
        if (value === undefined || value === null || value === '') {
            if (field.isRequired) {
                dynamicMetadata[field.fieldName] = 'Unknown';
            } else {
                dynamicMetadata[field.fieldName] = null;
            }
        } else {
            dynamicMetadata[field.fieldName] = value;
        }
    }
    
    return dynamicMetadata;
}

/**
 * Parses a JSON string and maps it to blueprint fields.
 * Provides safe error handling - returns partial object on parse failure.
 * 
 * @function parseAndMapMetadata
 * @param {string} metadataJsonString - The raw JSON string from AI response.
 * @param {Array<{fieldName: string, isRequired: boolean}>} blueprintFields - Array of blueprint field definitions.
 * @returns {Object} A mapped object with fields populated according to requirements.
 * 
 * @error_handling
 * - If JSON parsing fails, logs the error and returns fallback values for all fields.
 * - Never throws - always returns a valid object.
 */
function parseAndMapMetadata(metadataJsonString, blueprintFields) {
    let parsedJson = {};
    
    try {
        parsedJson = JSON.parse(metadataJsonString);
    } catch (parseError) {
        logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'MetadataMapper', `JSON Parse Error: ${parseError.message}`);
        logService.logErrorFile('MetadataMapper', 'Failed to parse metadata JSON', parseError, { jsonString: metadataJsonString ? 'present (omitted)' : null });
        return mapRawAiResponseToBlueprint(null, blueprintFields);
    }
    
    return mapRawAiResponseToBlueprint(parsedJson, blueprintFields);
}

module.exports = {
    mapAiResponseToBlueprint: parseAndMapMetadata,
    mapRawAiResponseToBlueprint,
    parseAndMapMetadata
};