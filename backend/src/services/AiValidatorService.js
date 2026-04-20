/**
 * @module AiValidatorService
 * @description Validation service for AI extraction workflows.
 *
 * @responsibility
 * - Pre-validates text input before AI extraction (prevents calling LLM with empty/insufficient text).
 * - Post-validates JSON output to detect "silent LLM failures".
 * - Validates synonym criteria using AI verification.
 *
 * @boundary_rules
 * - ✅ May be called by any extraction workflow (CriteriaManagerWorkflow, DocumentProcessor, etc.).
 * - ❌ MUST NOT contain database operations or business logic beyond validation.
 *
 * @dependency_injection
 * Enforces constructor injection per ARCHITECTURE.md Section 2.
 * All dependencies (aiService, promptRepo, logService) must be explicitly injected.
 * This enables proper DI and testability.
 */

const { LOG_LEVELS, LOG_SYMBOLS, PROMPT_SYSTEM_NAMES } = require('../config/constants');

const MIN_TEXT_LENGTH = 50;

class AiValidatorService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.aiService - The AiService instance
     * @param {Object} deps.promptRepo - The PromptRepo instance
     * @param {Object} deps.logService - The LogService instance
     * @dependency_injection Dependencies are injected strictly via the constructor.
     */
    constructor({ aiService, promptRepo, logService }) {
        this._aiService = aiService;
        this._promptRepo = promptRepo;
        this._logService = logService;
    }

    /**
     * Validates that input text is suitable for AI extraction.
     * Prevents calling the LLM with empty or insufficient text that would
     * result in garbage output or silent truncation issues.
     *
     * @param {string} text - The input text to validate.
     * @param {string} context - Context description for logging (e.g., 'Job posting', 'User resume').
     * @returns {boolean} True if text is valid for extraction, false otherwise.
     *
     * @rationale
     * - Ollama (and other LLMs) may return valid JSON but with empty arrays when input
     *   is empty, whitespace-only, or too short to contain meaningful content.
     * - This pre-check catches these cases early, avoiding wasted API calls and
     *   preventing confusion when debugging "silent LLM failures".
     * - The 50-character threshold is a practical minimum for job descriptions or resumes.
     */
    validateInputText(text, context) {
        if (!text || typeof text !== 'string') {
            if (this._logService) this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'AiValidatorService', message: `${context}: Input text is null or not a string` });
            return false;
        }

        const trimmed = text.trim();

        if (trimmed.length === 0) {
            if (this._logService) this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'AiValidatorService', message: `${context}: Input text is empty or whitespace only` });
            return false;
        }

        if (trimmed.length < MIN_TEXT_LENGTH) {
            if (this._logService) this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'AiValidatorService', message: `${context}: Input text too short (${trimmed.length} chars). Minimum ${MIN_TEXT_LENGTH} chars required for meaningful extraction.` });
            return false;
        }

        return true;
    }

    /**
     * Detects "silent LLM failures" where the schema is respected but no data is extracted.
     * This catches cases where the AI returns valid JSON but all dimension arrays are empty,
     * which typically indicates the LLM failed to extract meaningful content (e.g., due to
     * context window truncation, bad prompt, or model issues).
     *
     * @param {Object} dimensions - The parsed dimensions object from extraction response.
     * @param {Array<Object>} activeDimensions - The active dimensions array from the database.
     * @returns {boolean} True if all dimension arrays are empty, false otherwise.
     *
     * @detection_rationale
     * - The LLM may return a structurally valid JSON that conforms to the schema
     *   but contains zero criteria in any dimension.
     * - This is a "silent failure" because there are no explicit errors - the API call succeeded,
     *   JSON parsed correctly, but extraction yielded nothing.
     * - Without this check, downstream logic would proceed as if criteria were extracted,
     *   leading to confusing "0 criteria found" results that are hard to debug.
     * - Including the first 200 chars of input in the warning helps diagnose whether
     *   the input itself was garbage or the extraction just failed.
     */
    isEmptyExtraction(dimensions, activeDimensions) {
        if (!dimensions) {
            return true;
        }

        for (const dim of activeDimensions) {
            const criteria = dimensions[dim.name];
            if (Array.isArray(criteria) && criteria.length > 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Uses a fast LLM call to verify if two criteria are functionally identical synonym.
     * Acts as a safeguard against false-positive vector embedding matches.
     *
     * @param {Object} criteriaDto - DTO containing the two criteria to compare.
     * @param {string} criteriaDto.criterionA - First criterion to compare.
     * @param {string} criteriaDto.criterionB - Second criterion to compare.
     * @returns {Promise<Object>} Object containing isSynonym boolean.
     *
     * @socexplanation
     * - DTO pattern separates data payload (criteria) from dependencies (services).
     * - Enforces Separation of Concerns: data vs. infrastructure dependencies.
     * - Eliminates parameter creep by grouping related parameters into DTOs.
     */
    async areCriteriaSynonyms(criteriaDto) {
        const { criterionA, criterionB } = criteriaDto;

        if (!this._aiService || !this._promptRepo) {
            throw new Error('[AiValidatorService] areCriteriaSynonyms requires aiService and promptRepo to be injected as dependencies.');
        }

        const synonymPrompt = this._promptRepo.getPromptBySystemName(PROMPT_SYSTEM_NAMES.SYNONYM_VALIDATOR).prompt;

        const messages = [
            {
                role: 'system',
                content: synonymPrompt
            },
            {
                role: 'user',
                content: `Criterion 1: "${criterionA}"\nCriterion 2: "${criterionB}"`
            }
        ];

        try {
            const { content } = await this._aiService.generateChatResponse(messages, { taskType: 'verification', temperature: 0.0, logAction: 'Evaluated synonyms for merge gate.' });
            return {
                isSynonym: content.trim().toUpperCase().includes('YES')
            };
        } catch (error) {
            if (this._logService) this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'AiValidatorService', message: `Synonym verification failed: ${error.message}` });
            return { isSynonym: false };
        }
    }
}

module.exports = AiValidatorService;