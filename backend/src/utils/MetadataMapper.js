/**
 * @module MetadataMapper
 * @description Handles metadata extraction using native DOM features.
 * @reasoning Removed node-domexception dependency; Node.js 18+ provides this natively.
 * @compatibility Node.js 18+ required for native DOMException support.
 * @security Security fix: Removed deprecated polyfill to resolve known vulnerability.
 *
 * Utility for mapping raw AI JSON responses to blueprint field schemas.
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
 * @dependency_injection
 * logService is injected via constructor. This removes the top-level require and enables pure function testing.
 */
const { LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class MetadataMapper {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.logService - The logging service instance
     */
    constructor({ logService }) {
        this._logService = logService;
    }

    /**
     * Maps raw AI JSON response to blueprint fields with proper fallback handling.
     * 
     * @method mapRawAiResponseToBlueprint
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
     * const result = mapper.mapRawAiResponseToBlueprint(aiResponse, blueprintFields);
     * // result: { title: "Software Engineer", description: null }
     */
    mapRawAiResponseToBlueprint(parsedJson, blueprintFields) {
        const dynamicMetadata = {};

        if (!parsedJson || typeof parsedJson !== 'object') {
            if (this._logService) this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'MetadataMapper', message: 'Invalid parsed JSON, applying fallback values.' });
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
     * @method parseAndMapMetadata
     * @param {string} metadataJsonString - The raw JSON string from AI response.
     * @param {Array<{fieldName: string, isRequired: boolean}>} blueprintFields - Array of blueprint field definitions.
     * @returns {Object} A mapped object with fields populated according to requirements.
     * 
     * @error_handling
     * - If JSON parsing fails, logs the error and returns fallback values for all fields.
     * - Never throws - always returns a valid object.
     */
    parseAndMapMetadata(metadataJsonString, blueprintFields) {
        let parsedJson;

        try {
            parsedJson = JSON.parse(metadataJsonString);
        } catch (parseError) {
            if (this._logService) {
                /** @socexplanation Error handling consolidated to logSystemFault to prevent swallowed stack traces and enforce DRY principles. */
                this._logService.logSystemFault({ origin: 'MetadataMapper', message: 'Failed to parse metadata JSON', errorObj: parseError, details: { jsonString: metadataJsonString ? 'present (omitted)' : null } });
            }
            return this.mapRawAiResponseToBlueprint(null, blueprintFields);
        }

        return this.mapRawAiResponseToBlueprint(parsedJson, blueprintFields);
    }
}

module.exports = MetadataMapper;