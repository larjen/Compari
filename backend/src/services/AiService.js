/**
 * @module AiService
 * @description Infrastructure Service for interacting with LLMs using the OpenAI SDK.
 *
 * @responsibility
 * - Connects to OpenAI-compatible APIs using the OpenAI SDK.
 * - Assumes OpenAI SDK compatibility for all connected providers.
 * - Provides generic chat generation and embedding without domain-specific knowledge.
 * - Automatically resolves connection settings (model, api_url, api_key) from AiModelRepo.
 * - Supports role-based models: one active 'chat' model and one active 'embedding' model.
 *
 * @role_based_models
 * - This service now supports distinct active models for 'chat' and 'embedding' roles.
 * - Chat models are used for text generation, conversation, and structured output.
 * - Embedding models are used for vectorization and similarity calculations.
 * - Each role can have its own active model, allowing optimization (e.g., fast chat model + powerful embedding model).
 *
 * @socexplanation
 * - This service now autonomously resolves its connection settings via AiModelRepo,
 *   adhering to Separation of Concerns (SoC). Domain workflows no longer need to manage
 *   AI configuration details - they simply call the service methods without passing host/model.
 * - Optional overrides are still supported for flexibility/testing, but the default behavior
 *   delegates configuration to the Infrastructure layer where it belongs.
 * - Logging model usage in the Infrastructure layer (AiService) follows SoC principles:
 *   This is a technical concern (which model was used), not a business domain concern.
 *
 * @boundary_rules
 * - ✅ MAY call other Utility/Infrastructure services (LogService, AiModelRepo).
 * - ❌ MUST NOT call Domain Services (e.g., JobService, WorkflowService).
 * - ❌ MUST NOT contain business logic or construct business-specific paths.
 * - ❌ MUST NOT use SettingsManager for AI configuration (now database-driven).
 * - ❌ MUST NOT contain provider-specific branching (assumes OpenAI SDK compatibility).
 *
 * @separation_of_concerns
 * - AI generation success: Use logTerminal() for feedback. Use logSystemFile() for milestones.
 * - AI generation errors: Use logTerminal() with 'ERROR' + logErrorFile() for audit.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const crypto = require('crypto');
const path = require('path');
const { OpenAI } = require('openai');
const { AI_MODEL_ROLES, AI_TASK_TYPES, LOG_LEVELS, LOG_SYMBOLS, SETTING_KEYS, AI_CACHE_DIR } = require('../config/constants');

class AiService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.settingsManager - The SettingsManager instance
     * @param {Object} deps.aiModelRepo - The AiModelRepo instance
     * @param {Object} deps.logService - The LogService instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ settingsManager, aiModelRepo, logService, fileService }) {
        this._settingsManager = settingsManager;
        this._aiModelRepo = aiModelRepo;
        this._logService = logService;
        this._fileService = fileService;
        this.clientCache = new Map();
        this.isTestingConnection = false;
    }

    _generateCacheKey(prefix, payload) {
        const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
        return `${prefix}_${hash}.json`;
    }

    /**
     * @private
     * Checks the file system cache for a previously generated AI response.
     * Enforces DRY principles across chat and embedding generations.
     * @param {string} cacheKey - The generated cache key filename.
     * @param {string} logAction - Description of the action for logging.
     * @returns {Object|null} The cached data, or null if miss/disabled.
     */
    _checkCache(cacheKey, logAction) {
        if (this._settingsManager.get(SETTING_KEYS.USE_AI_CACHE) !== 'true') return null;

        const cachePath = path.join(AI_CACHE_DIR, cacheKey);
        const cachedData = this._fileService.readJsonFile(cachePath);

        if (cachedData) {
            this._logService.logTerminal({
                status: LOG_LEVELS.INFO,
                symbolKey: LOG_SYMBOLS.LIGHTNING,
                origin: 'AiService',
                message: `[VCR CACHE HIT] Returning mocked AI response for: ${logAction}`
            });
            return cachedData;
        }
        return null;
    }

    /**
     * @private
     * Writes data to the AI cache if caching is enabled.
     */
    _writeCache(cacheKey, data) {
        if (this._settingsManager.get(SETTING_KEYS.USE_AI_CACHE) !== 'true') return;
        const cachePath = path.join(AI_CACHE_DIR, cacheKey);
        this._fileService.writeJsonFile(cachePath, data);
    }

    /**
     * @private
     * @description Provider Strategy Factory. Standardizes connection options for the OpenAI SDK.
     * Sanitizes inputs to prevent "Multiple authentication credentials" errors.
     * * @responsibility Infrastructure - Connection string normalization.
     * @boundary_rules No provider-specific branching allowed. Assumes OpenAI compatibility.
     * * @param {string} baseURL - The API base URL from the database.
     * @param {string} apiKey - The API key from the database.
     * @returns {Object} Configured options for the OpenAI client.
     */
    _buildClientOptions(baseURL, apiKey) {
        let cleanBaseURL = baseURL;
        try {
            if (baseURL) {
                const urlObj = new URL(baseURL);
                urlObj.search = '';
                cleanBaseURL = urlObj.toString().replace(/\/$/, '');
            }
        } catch (error) {
            console.error('Invalid Base URL provided to AiService:', error.stack || error);
            cleanBaseURL = baseURL;
        }

        return {
            baseURL: cleanBaseURL,
            apiKey: apiKey || 'dummy-key'
        };
    }

    /**
     * Retrieves the model configuration for a given role.
     * STRICT MODE: Throws an error instead of falling back to default identifiers.
     * Uses AI_MODEL_ROLES constants to enforce type safety and prevent typo-induced bugs.
     * @private
     * @param {string} role - The role to get config for (from AI_MODEL_ROLES).
     * @returns {Object} Model configuration object with modelIdentifier, apiUrl, apiKey, role.
     * @throws {Error} If no active model is configured for the requested role.
     */
    _getModelConfigByRole(role) {
        const activeModel = this._aiModelRepo.getActiveModelByRole(role);

        if (activeModel) {
            return {
                name: activeModel.name,
                modelIdentifier: activeModel.modelIdentifier,
                apiUrl: activeModel.apiUrl,
                apiKey: activeModel.apiKey,
                role: role,
                temperature: activeModel.temperature,
                contextWindow: activeModel.contextWindow,
                id: activeModel.id
            };
        }

        const err = new Error(`Strict Mode: No active AI model configured for role '${role}'. Please set an active model in settings.`);
        err.isAiError = true;
        throw err;
    }

    _getModelConfigById(id) {
        if (!id) {
            return null;
        }
        const model = this._aiModelRepo.getModelById(id);
        if (!model) {
            return null;
        }
        return {
            name: model.name,
            modelIdentifier: model.modelIdentifier,
            apiUrl: model.apiUrl,
            apiKey: model.apiKey,
            role: model.role,
            temperature: model.temperature,
            contextWindow: model.contextWindow,
            id: model.id
        };
    }

    /**
     * @private
     * @description Resolves model configuration based on specific task types.
     * STRICT MODE: Throws an error if routing settings are missing, invalid, or unmapped.
     * @param {string} taskType - The specific AI task type defined in AI_TASK_TYPES.
     * @returns {Object} Model configuration object.
     * @throws {Error} If taskType is unknown or model configuration is missing.
     * * @socexplanation
     * - Enforces fail-fast domain configuration. Task routing is explicit.
     * - Uses explicit dependency injection to eliminate circular dependencies.
     */
    _getModelConfigForTask(taskType) {
        let settingKey;

        switch (taskType) {
            case AI_TASK_TYPES.GENERAL:
                settingKey = SETTING_KEYS.MODEL_ROUTING_GENERAL;
                break;
            case AI_TASK_TYPES.VERIFICATION:
                settingKey = SETTING_KEYS.MODEL_ROUTING_VERIFICATION;
                break;
            case AI_TASK_TYPES.EMBEDDING:
                settingKey = SETTING_KEYS.MODEL_ROUTING_EMBEDDING;
                break;
            case AI_TASK_TYPES.METADATA:
                settingKey = SETTING_KEYS.MODEL_ROUTING_METADATA;
                break;
            default: {
                // Scoped block {} fixes the ESLint no-case-declarations error
                const err = new Error(`Strict Mode: Unmapped task type '${taskType}'. No fallback model allowed.`);
                err.isAiError = true;
                throw err;
            }
        }

        const modelId = this._settingsManager.get(settingKey);

        if (!modelId) {
            const err = new Error(`Strict Mode: No model configured for task routing '${taskType}'. Please configure task routing in settings.`);
            err.isAiError = true;
            throw err;
        }

        const config = this._getModelConfigById(modelId);

        if (!config) {
            const err = new Error(`Strict Mode: Model ID '${modelId}' configured for task '${taskType}' could not be found. It may have been deleted.`);
            err.isAiError = true;
            throw err;
        }

        return config;
    }

    /**
     * Retrieves the active chat model configuration from the database.
     * STRICT MODE: Throws if no active model is configured.
     * @private
     * @returns {Object} Model configuration object with modelIdentifier, apiUrl, apiKey, role.
     * @throws {Error} If no active chat model is configured.
     */
    _getChatModelConfig() {
        return this._getModelConfigByRole(AI_MODEL_ROLES.CHAT);
    }

    /**
     * Retrieves the active embedding model configuration from the database.
     * STRICT MODE: Throws if no active model is configured.
     * @private
     * @returns {Object} Model configuration object with modelIdentifier, apiUrl, apiKey, role.
     * @throws {Error} If no active embedding model is configured.
     */
    _getEmbeddingModelConfig() {
        return this._getModelConfigByRole(AI_MODEL_ROLES.EMBEDDING);
    }

    /**
     * Gets or creates the appropriate client based on the model configuration.
     * Optimized for the hot path using instance caching.
     * @private
     * @param {Object} config - Required model configuration.
     * @returns {Object} Client object with openai instance and model name.
     * @throws {Error} If config is not provided.
     */
    _getClient(config) {
        if (!config) throw new Error("Strict Mode: Model configuration is required to initialize AI client.");

        const baseURL = config.apiUrl || 'https://api.openai.com/v1';
        const apiKey = config.apiKey || 'dummy-key';

        const cacheKey = `${baseURL}|${apiKey}`;

        if (!this.clientCache.has(cacheKey)) {
            const clientOptions = this._buildClientOptions(baseURL, apiKey);
            this.clientCache.set(cacheKey, new OpenAI(clientOptions));
        }

        return {
            client: this.clientCache.get(cacheKey),
            model: config.modelIdentifier
        };
}

    /**
     * Determines if an error from the OpenAI SDK is fundamentally fatal and should never be retried.
     * All 4xx errors are considered fatal (no retry) EXCEPT 429 (Rate Limit) and 408 (Timeout).
     * Relies on standard HTTP status codes rather than brittle string matching.
     * @private
     * @param {Error} error - The error thrown by the AI client.
     * @returns {Error|null} Returns a formatted fatal error if true, or null if the error is transient.
     */
    _checkFatalError(error) {
        const status = error.status || error.statusCode;

        if (status >= 400 && status < 500 && status !== 429 && status !== 408) {
            const fatalErr = new Error(`${error.message}`);
            fatalErr.isFatalClientError = true;
            return fatalErr;
        }

        if (error.code === 'unauthenticated' || error.code === 'permission_denied') {
            const fatalErr = new Error(`${error.message}`);
            fatalErr.isFatalClientError = true;
            return fatalErr;
        }

        return null;
    }

    /**
     * @private
     * @description Centralized error handler for AI API errors.
     * Absorbs duplicated error-catching logic across generateChatResponse and generateEmbedding.
     * Handles connection timeouts, validation errors, and logs appropriately.
     * @param {Error} error - The error thrown by the AI client.
     * @param {Object} logContext - Context object for error logging (e.g., { messages: '...' } or { text: '...' }).
     * @throws {Error} Re-throws classified connection errors or the original error after logging.
     */
    _handleAiApiError(error, logContext) {
        const fatalError = this._checkFatalError(error);
        if (fatalError) throw fatalError;

        if (error.name === 'TimeoutError' || error.message.includes('Timeout')) {
            const timeoutErr = new Error('Connection error.');
            timeoutErr.isConnectionError = true;
            throw timeoutErr;
        }

        if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
            const connErr = new Error('Connection error.');
            connErr.isConnectionError = true;
            throw connErr;
        }

        this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'AiService', message: `Error during AI generation: ${error.message}` });
        this._logService.logErrorFile({ origin: 'AiService', message: 'Error during AI generation', errorObj: error, details: logContext });
        throw error;
    }

    /**
     * Generates a chat response using the active chat model.
     * Automatically resolves model from the database.
     * @param {Array} messages - Array of message objects with role and content.
     * @param {Object} [optionsDto={}] - DTO containing configuration, overrideConfig, and signal.
     * @param {Object} [optionsDto.taskType] - The task type for model routing.
     * @param {string} [optionsDto.format] - Output format ('json' or schema object).
     * @param {string} [optionsDto.logFolderPath] - Folder path for logging AI traffic.
     * @param {string} [optionsDto.logAction] - Action description for logging.
     * @param {string} [optionsDto.logSymbol] - Symbol for logging.
     * @param {number} [optionsDto.temperature] - Sampling temperature.
     * @param {Object} [optionsDto.overrideConfig] - Optional override configuration (for testing/flexibility).
     * @param {AbortSignal} [optionsDto.signal] - Optional signal to abort the AI generation.
     * @returns {Promise<string>} The assistant's response content.
     *
     * @socexplanation
     * - DTO pattern consolidates all optional parameters into a single options object, eliminating parameter creep.
     * - Logs model usage after successful AI generation for observability.
     * - This is infrastructure-level logging (which technical component handled the request).
     * - Protected by try-catch to prevent logging failures from affecting AI functionality.
     * - Automatically strips markdown backticks from JSON responses when format is specified,
     *   ensuring clean output for structured data consumers (Repositories, Workflows).
     * - Resolves model from AiModelRepo using role 'chat'.
     *
     * @options_support
     * - optionsDto.format: Can be 'json' for basic JSON mode, or a JSON Schema object for structured outputs.
     * - When a JSON Schema object is passed, it is passed directly to the provider's format parameter.
     * - When format is provided, markdown backticks are automatically stripped from the response.
     */
    async generateChatResponse(messages, optionsDto = {}) {
        const { overrideConfig, signal, ...options } = optionsDto;
        const startTime = Date.now();
        let config = overrideConfig;

        if (!config && options.taskType) {
            config = this._getModelConfigForTask(options.taskType);
        }

if (!config) {
            config = this._getChatModelConfig();
        }
        const requestOptions = { ...options };
        const isJsonFormat = options.format === 'json' || (options.format && typeof options.format === 'object');

        const { client, model: selectedModel } = this._getClient(config);

        const cacheKey = this._generateCacheKey('chat', {
            model: selectedModel,
            messages,
            format: options.format
        });

        const cachedData = this._checkCache(cacheKey, options.logAction || 'Chat');
        if (cachedData) return cachedData;

        const chatParams = {
            model: selectedModel,
            messages: messages,
            ...requestOptions
        };

        if (chatParams.temperature === undefined) {
            chatParams.temperature = config.temperature ?? 0.1;
        }
        // Keep num_ctx to define total allocated VRAM
        if (chatParams.num_ctx === undefined && config.contextWindow) {
            chatParams.num_ctx = config.contextWindow;
        }

        // FIX: Removed the assignment of chatParams.max_tokens = config.contextWindow.
        // max_tokens dictates output length. Setting it to the total context window size 
        // causes OOM crashes and runaway hallucinations on local models.

        if (options.format === 'json') {
            chatParams.response_format = { type: 'json_object' };
        } else if (options.format && typeof options.format === 'object') {
            chatParams.response_format = { type: 'json_object' };
        }

        try {
            const timeoutSignal = AbortSignal.timeout(300000);
            const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

            var response = await client.chat.completions.create(chatParams, { signal: combinedSignal });
        } catch (error) {
            this._handleAiApiError(error, { messages: messages ? 'Query sent (omitted for brevity)' : null });
        }

        let content = response.choices[0].message.content.trim();

        if (options.logFolderPath) {
            try {
                const shouldLogAi = this._settingsManager.get('log_ai_interactions') === 'true';
                this._logService.logAiTraffic({
                    entityFolderPath: options.logFolderPath,
                    requestMessages: messages,
                    responseContent: content,
                    config,
                    shouldLog: shouldLogAi
                });
            } catch (err) {
                this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'AiService.js', message: `Failed to log AI traffic: ${err.message}` });
            }
        }

        const durationMs = Date.now() - startTime;

        if (options.logAction) {
            const timeStr = durationMs < 1000 ? `${durationMs}ms` : this._logService.formatDuration(durationMs);
            const origin = 'AiService';
            const symbol = options.logSymbol || LOG_SYMBOLS.LIGHTNING;
            this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: symbol, origin: origin, message: `[Model: ${selectedModel}] [Time: ${timeStr}] ${options.logAction}` });
        }

        if (isJsonFormat) {
            content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

            const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
                content = jsonMatch[1];
            }
        }

        const result = { content, model: selectedModel, durationMs };
        this._writeCache(cacheKey, result);
        return result;
    }

    /**
     * Generates a vector embedding for the given text using the active embedding model.
     * Automatically resolves model from the database using role 'embedding'.
     * @param {string} text - The text to embed.
     * @param {Object} [optionsDto={}] - Optional settings object.
     * @param {Object} [optionsDto.overrideConfig] - Optional override configuration.
     * @param {string} [optionsDto.embeddingModel] - Embedding model name.
     * @param {AbortSignal} [optionsDto.signal] - Optional signal to abort the AI generation.
     * @param {string} [optionsDto.logFolderPath] - Optional folder path for logging AI traffic.
     * @returns {Promise<number[]>} Array of floating point numbers representing the embedding.
     */
    async generateEmbedding(text, optionsDto = {}) {
        const { overrideConfig, embeddingModel, signal, logFolderPath } = optionsDto;
        const config = overrideConfig || this._getEmbeddingModelConfig();
        const { client, model } = this._getClient(config);
        const modelName = embeddingModel || model;

        const cacheKey = this._generateCacheKey('embed', { model: modelName, text });

        const cachedData = this._checkCache(cacheKey, 'Embedding');
        if (cachedData) return cachedData.embedding;

        let response;
        try {
            const timeoutSignal = AbortSignal.timeout(120000);
            const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

            response = await client.embeddings.create({
                model: modelName,
                input: text
            }, { signal: combinedSignal });
        } catch (error) {
            this._handleAiApiError(error, { text: text ? 'Query sent (omitted for brevity)' : null });
        }

        this._logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.LIGHTNING, origin: 'AiService', message: `[Model: ${modelName}] Embedding Prompt: "${text}"` });

        if (logFolderPath) {
            try {
                const shouldLogAi = this._settingsManager.get('log_ai_interactions') === 'true';
                this._logService.logAiTraffic({
                    entityFolderPath: logFolderPath,
                    requestMessages: { task: AI_TASK_TYPES.EMBEDDING, text },
                    responseContent: '[Vector Array Omitted for Brevity]',
                    config: { modelIdentifier: modelName },
                    shouldLog: shouldLogAi
                });
            } catch (err) {
                this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'AiService', message: `Failed to log AI traffic: ${err.message}` });
            }
        }

        /**
         * @socexplanation
         * The OpenAI SDK returns embeddings inside a data array: response.data[].embedding.
         * We strictly validate the presence of this array to prevent propagating undefined 
         * values to the cache layer or the domain layer (which results in NULL database vectors).
         */
        const result = response?.data?.[0]?.embedding;

        if (!result || !Array.isArray(result) || result.length === 0) {
            const err = new Error(`Failed to extract valid embedding vector from AI provider using model ${modelName}.`);
            err.isAiError = true;
            throw err;
        }

        this._writeCache(cacheKey, { embedding: result });
        return result;
    }

    /**
     * Executes a true 1-token end-to-end test to verify model availability and VRAM loading.
     * This replaces the flawed isHealthy pre-flight check by invoking a real prompt to the model.
     * 
     * @param {string} [role] - The role to test ('chat' or 'embedding'). Defaults to AI_MODEL_ROLES.CHAT.
     * @param {Object} [overrideConfig] - Optional override configuration (modelIdentifier, apiUrl, apiKey).
     * @returns {Promise<Object>} The response object containing model and result.
     * @throws {Error} If the test fails or a fatal error is detected.
     * 
     * @responsibility
     * - Executes a real prompt to the model to prove it successfully loads into VRAM and executes.
     * - Handles both 'chat' and 'embedding' roles correctly.
     * - Throws properly classified fatal errors for unrecoverable failures.
     * 
     * @socexplanation
     * - This method performs the actual execution in the Service layer.
     * - Error classification (_checkFatalError) happens here.
     * - Logging is handled by the Controller layer (AiModelController).
     */
    async testEndToEnd(role = AI_MODEL_ROLES.CHAT, overrideConfig) {
        if (this.isTestingConnection) {
            const err = new Error('A connection test is already in progress. Please wait.');
            err.status = 409;
            throw err;
        }

        this.isTestingConnection = true;

        let config = overrideConfig;
        if (!config) {
            config = role === AI_MODEL_ROLES.EMBEDDING ? this._getEmbeddingModelConfig() : this._getChatModelConfig();
        }
        const { client, model } = this._getClient(config);

        try {
            if (role === AI_MODEL_ROLES.EMBEDDING) {
                await client.embeddings.create({
                    model: model,
                    input: 'Ping'
                });
            } else {
                await client.chat.completions.create({
                    model: model,
                    messages: [{ role: 'user', content: 'Ping. Reply with exactly one word: Pong.' }],
                    max_tokens: 5
                });
            }
            return { model, role };
        } catch (error) {
            const fatalError = this._checkFatalError(error);
            if (fatalError) {
                throw fatalError;
            }
            throw error;
        } finally {
            this.isTestingConnection = false;
        }
    }

    /**
     * Tests AI connectivity by sending a test message.
     * @param {string} message - The test message to send to the AI.
     * @param {string} [role] - The role to test ('chat' or 'embedding'). Defaults to 'chat'.
     * @param {Object} [overrideConfig] - Optional override configuration.
     * @returns {Promise<string>} The AI's response.
     * @throws {Error} If the AI connection fails.
     */
    async testChat(message, role = AI_MODEL_ROLES.CHAT, overrideConfig) {
        if (this.isTestingConnection) {
            const err = new Error('A connection test is already in progress. Please wait.');
            err.status = 409;
            throw err;
        }

        this.isTestingConnection = true;

        let config;
        if (overrideConfig) {
            config = overrideConfig;
        } else if (role === AI_MODEL_ROLES.EMBEDDING) {
            config = this._getEmbeddingModelConfig();
        } else {
            config = this._getChatModelConfig();
        }

        const { client, model: selectedModel } = this._getClient(config);

        try {
            const response = await client.chat.completions.create({
                model: selectedModel,
                messages: [{ role: 'user', content: message }]
            });
            return response.choices[0].message.content;
        } finally {
            this.isTestingConnection = false;
        }
    }
}

/**
 * @dependency_injection
 * AiService exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = AiService;
