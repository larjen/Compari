/**
 * @module AiService
 * @description Infrastructure Service for interacting with LLMs using the OpenAI SDK.
 * 
 * @responsibility
 * - Connects to OpenAI-compatible APIs (cloud and local) using the OpenAI SDK.
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
 * 
 * @separation_of_concerns
 * - AI generation success: Use logTerminal() for feedback. Use logSystemFile() for milestones.
 * - AI generation errors: Use logTerminal() with 'ERROR' + logErrorFile() for audit.
 */

const { OpenAI } = require('openai');
const logService = require('./LogService');
const aiModelRepo = require('../repositories/AiModelRepo');
const settingsManager = require('../config/SettingsManager');

const DEFAULT_CHAT_MODEL = 'gemma4:e4b';
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';
const DEFAULT_API_URL = 'http://127.0.0.1:11434/v1';

class AiService {
    /**
     * Retrieves the model configuration for a given role (chat or embedding).
     * Abstracts the database lookup, object mapping, and fallback logic to keep the service DRY.
     * @private
     * @param {string} role - The role to get config for ('chat' or 'embedding').
     * @param {string} defaultModelIdentifier - The default model identifier to use if no active model is found.
     * @returns {Object} Model configuration object with modelIdentifier, apiUrl, apiKey, role.
     */
    _getModelConfigByRole(role, defaultModelIdentifier) {
        const activeModel = aiModelRepo.getActiveModelByRole(role);

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

        return {
            name: defaultModelIdentifier,
            modelIdentifier: defaultModelIdentifier,
            apiUrl: DEFAULT_API_URL,
            apiKey: null,
            role: role,
            temperature: 0.1,
            contextWindow: 8192,
            id: null
        };
    }

    _getModelConfigById(id) {
        if (!id) {
            return null;
        }
        const model = aiModelRepo.getModelById(id);
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

    _getModelConfigForTask(taskType, defaultConfig) {
        let settingKey = null;
        let fallbackRole = null;

        switch (taskType) {
            case 'general':
                settingKey = 'model_routing_general';
                fallbackRole = 'chat';
                break;
            case 'verification':
                settingKey = 'model_routing_verification';
                fallbackRole = 'chat';
                break;
            case 'embedding':
                settingKey = 'model_routing_embedding';
                fallbackRole = 'embedding';
                break;
            case 'metadata':
                settingKey = 'model_routing_metadata';
                fallbackRole = 'chat';
                break;
            default:
                return defaultConfig;
        }

        if (!settingKey) {
            return defaultConfig;
        }

        const modelId = settingsManager.get(settingKey);

        if (!modelId) {
            logService.logTerminal('WARN', 'WARNING', 'AiService.js', `No model configured for task '${taskType}', falling back to active ${fallbackRole} model.`);
            return this._getModelConfigByRole(fallbackRole, defaultConfig.modelIdentifier);
        }

        const config = this._getModelConfigById(modelId);

        if (!config) {
            logService.logTerminal('WARN', 'WARNING', 'AiService.js', `Model ID '${modelId}' not found for task '${taskType}', falling back to active ${fallbackRole} model.`);
            return this._getModelConfigByRole(fallbackRole, defaultConfig.modelIdentifier);
        }

        return config;
    }

    /**
     * Retrieves the active chat model configuration from the database.
     * Falls back to default settings if no active model is found.
     * @private
     * @returns {Object} Model configuration object with modelIdentifier, apiUrl, apiKey, role.
     */
    _getChatModelConfig() {
        return this._getModelConfigByRole('chat', DEFAULT_CHAT_MODEL);
    }

    /**
     * Retrieves the active embedding model configuration from the database.
     * Falls back to default settings if no active model is found.
     * @private
     * @returns {Object} Model configuration object with modelIdentifier, apiUrl, apiKey, role.
     */
    _getEmbeddingModelConfig() {
        return this._getModelConfigByRole('embedding', DEFAULT_EMBEDDING_MODEL);
    }

    /**
     * Gets the appropriate client based on the model configuration.
     * Directly instantiates the OpenAI client with the configured baseURL and apiKey.
     * @private
     * @param {Object} [overrideConfig] - Optional override configuration.
     * @returns {Object} Client object with openai instance and model name.
     */
    _getClient(overrideConfig) {
        const config = overrideConfig || this._getChatModelConfig();

        const baseURL = config.apiUrl || 'https://api.openai.com/v1';
        const apiKey = config.apiKey || 'dummy-key';

        return {
            client: new OpenAI({ baseURL, apiKey }),
            model: config.modelIdentifier
        };
    }

    /**
     * Checks if the active AI provider is healthy/available.
     * @param {string} [role] - The role to check ('chat' or 'embedding'). Defaults to 'chat'.
     * @param {Object} [overrideConfig] - Optional override configuration.
     * @returns {Promise<boolean>} True if healthy, throws error if not.
     * @throws {Error} If the AI provider is offline or unreachable.
     */
    async isHealthy(role = 'chat', overrideConfig) {
        let config;
        if (overrideConfig) {
            config = overrideConfig;
        } else if (role === 'embedding') {
            config = this._getEmbeddingModelConfig();
        } else {
            config = this._getChatModelConfig();
        }

        const { client } = this._getClient(config);

        try {
            await client.models.list();
            return true;
        } catch (error) {
            const e = new Error(`AI is offline. Details: ${error.message}`);
            e.isAiError = true;
            throw e;
        }
    }

    /**
     * Generates a chat response using the active chat model.
     * Automatically resolves model from the database.
     * @param {Array} messages - Array of message objects with role and content.
     * @param {Object} options - Optional settings (e.g., temperature, format).
     * @param {Object} [overrideConfig] - Optional override configuration (for testing/flexibility).
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<string>} The assistant's response content.
     * 
     * @socexplanation
     * - Logs model usage after successful AI generation for observability.
     * - This is infrastructure-level logging (which technical component handled the request).
     * - Protected by try-catch to prevent logging failures from affecting AI functionality.
     * - Automatically strips markdown backticks from JSON responses when format is specified,
     *   ensuring clean output for structured data consumers (Repositories, Workflows).
     * - Resolves model from AiModelRepo using role 'chat'.
     * 
     * @options_support
     * - options.format: Can be 'json' for basic JSON mode, or a JSON Schema object for structured outputs.
     * - When a JSON Schema object is passed, it is passed directly to the provider's format parameter.
     * - When format is provided, markdown backticks are automatically stripped from the response.
     */
    async generateChatResponse(messages, options = {}, overrideConfig, signal) {
        const startTime = Date.now();
        let config = overrideConfig;

        if (!config && options.taskType) {
            config = this._getModelConfigForTask(options.taskType, this._getChatModelConfig());
        }

        if (!config) {
            config = this._getChatModelConfig();
        }
        const { client, model: selectedModel } = this._getClient(config);

        await this.isHealthy('chat', config);

        const requestOptions = { ...options };
        const isJsonFormat = options.format === 'json' || (options.format && typeof options.format === 'object');

        const chatParams = {
            model: selectedModel,
            messages: messages,
            ...requestOptions
        };

        if (chatParams.temperature === undefined) {
            chatParams.temperature = config.temperature ?? 0.1;
        }
        if (chatParams.num_ctx === undefined && config.contextWindow) {
            chatParams.num_ctx = config.contextWindow;
        }
        if (chatParams.max_tokens === undefined && config.contextWindow) {
            chatParams.max_tokens = config.contextWindow;
        }

        if (options.format === 'json') {
            chatParams.response_format = { type: 'json_object' };
        } else if (options.format && typeof options.format === 'object') {
            chatParams.response_format = { type: 'json_object' };
        }

        try {
            var response = await client.chat.completions.create(chatParams, { signal });
        } catch (error) {
            logService.logTerminal('ERROR', 'ERROR', 'AiService.js', `Error during AI generation: ${error.message}`);
            logService.logErrorFile('AiService.js', 'Error during AI generation', error, { messages: messages ? 'Query sent (omitted for brevity)' : null });
            throw error;
        }

        let content = response.choices[0].message.content.trim();

        if (options.logFolderPath) {
            try {
                logService.logAiTraffic(options.logFolderPath, messages, content, config);
            } catch (err) {
                logService.logTerminal('WARN', 'WARNING', 'AiService.js', `Failed to log AI traffic: ${err.message}`);
            }
        }

        const durationMs = Date.now() - startTime;

        if (options.logAction) {
            const timeStr = durationMs < 1000 ? `${durationMs}ms` : logService.formatDuration(durationMs);
            const origin = 'AiService';
            const symbol = options.logSymbol || 'LIGHTNING';
            logService.logTerminal('INFO', symbol, origin, `[Model: ${selectedModel}] [Time: ${timeStr}] ${options.logAction}`);
        }

        if (isJsonFormat) {
            content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

            const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
                content = jsonMatch[1];
            }
        }

        return {
            content,
            model: selectedModel,
            durationMs
        };
    }

    /**
     * Generates a vector embedding for the given text using the active embedding model.
     * Automatically resolves model from the database using role 'embedding'.
     * @param {string} text - The text to embed.
     * @param {Object} [overrideConfig] - Optional override configuration.
     * @param {string} [embeddingModel] - Embedding model name (default: nomic-embed-text).
     * @param {AbortSignal} [signal] - Optional signal to abort the AI generation.
     * @returns {Promise<number[]>} Array of floating point numbers representing the embedding.
     */
    async generateEmbedding(text, overrideConfig, embeddingModel, _signal) {
        let config = overrideConfig;

        if (!config) {
            config = this._getModelConfigForTask('embedding', this._getEmbeddingModelConfig());
        }

        if (!config) {
            config = this._getEmbeddingModelConfig();
        }

        await this.isHealthy('embedding', config);

        const { client } = this._getClient(config);
        const model = embeddingModel || config.modelIdentifier || DEFAULT_EMBEDDING_MODEL;

        const response = await client.embeddings.create({
            model: model,
            input: text
        });

        return response.data[0].embedding;
    }

    /**
     * Pre-warms the AI model by sending a minimal payload to load it into memory.
     * Logs the spin-up time to the terminal.
     * @param {string} [taskType='general'] - The task type (e.g., 'general', 'metadata', 'embedding').
     * @param {Object} [overrideConfig] - Optional override configuration.
     * @returns {Promise<{model: string, durationMs: number}>}
     */
    async warmUpModel(taskType = 'general', overrideConfig) {
        let config = overrideConfig;

        if (!config) {
            const defaultRole = taskType === 'embedding' ? 'embedding' : 'chat';
            const defaultConfig = defaultRole === 'embedding' ? this._getEmbeddingModelConfig() : this._getChatModelConfig();
            config = this._getModelConfigForTask(taskType, defaultConfig);
        }

        const safeApiUrl = config.apiUrl || 'default local endpoint';

        logService.logTerminal('INFO', 'INFO', 'AiService', `Spinning up model ${config.name} (${config.modelIdentifier}) at ${safeApiUrl}`);

        try {
            await this.isHealthy(config.role, config);
            const { client } = this._getClient(config);

            const startTime = Date.now();

            if (config.role === 'embedding') {
                await client.embeddings.create({
                    model: config.modelIdentifier,
                    input: 'warmup'
                });
            } else {
                await client.chat.completions.create({
                    model: config.modelIdentifier,
                    messages: [{ role: 'user', content: 'warmup' }],
                    max_tokens: 1
                });
            }

            const durationMs = Date.now() - startTime;
            const timeStr = durationMs < 1000 ? `${durationMs}ms` : logService.formatDuration(durationMs);

            logService.logTerminal('INFO', 'LIGHTNING', 'AiService', `Model ${config.name} (${config.modelIdentifier}) at ${safeApiUrl} spun up in ${timeStr}.`);

            return { model: config.modelIdentifier, durationMs };
        } catch (error) {
            logService.logTerminal('WARN', 'WARNING', 'AiService', `Failed to warm up model ${config.name}: ${error.message}`);
            return { model: config.modelIdentifier || 'unknown', durationMs: 0 };
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
    async testChat(message, role = 'chat', overrideConfig) {
        let config;
        if (overrideConfig) {
            config = overrideConfig;
        } else if (role === 'embedding') {
            config = this._getEmbeddingModelConfig();
        } else {
            config = this._getChatModelConfig();
        }

        const { client, model: selectedModel } = this._getClient(config);

        await this.isHealthy(role, config);

        const response = await client.chat.completions.create({
            model: selectedModel,
            messages: [{ role: 'user', content: message }]
        });
        return response.choices[0].message.content;
    }
}

module.exports = new AiService();
