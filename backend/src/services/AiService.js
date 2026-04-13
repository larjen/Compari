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
                modelIdentifier: activeModel.modelIdentifier,
                apiUrl: activeModel.apiUrl,
                apiKey: activeModel.apiKey,
                role: role,
                temperature: activeModel.temperature,
                contextWindow: activeModel.contextWindow
            };
        }

        return {
            modelIdentifier: defaultModelIdentifier,
            apiUrl: DEFAULT_API_URL,
            apiKey: null,
            role: role,
            temperature: 0.1,
            contextWindow: 8192
        };
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
        
        const { client, model } = this._getClient(config);

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
        const config = overrideConfig || this._getChatModelConfig();
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

        try {
            logService.logTerminal('INFO', 'LIGHTNING', 'AiService.js', `AI chat model finished generation successfully. Model: ${selectedModel}`);
            logService.logSystemFile('AiService.js', `AI chat model finished generation successfully. Model: ${selectedModel}`);
        } catch (err) {
            logService.logTerminal('WARN', 'WARNING', 'AiService.js', `Failed to log AI generation: ${err.message}`);
        }

        let content = response.choices[0].message.content.trim();

        if (options.logFolderPath) {
            try {
                logService.logAiTraffic(options.logFolderPath, messages, content, config);
            } catch (err) {
                logService.logTerminal('WARN', 'WARNING', 'AiService.js', `Failed to log AI traffic: ${err.message}`);
            }
        }

        if (isJsonFormat) {
            content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
            
            const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
                content = jsonMatch[1];
            }
            
            return content;
        }

        return content;
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
    async generateEmbedding(text, overrideConfig, embeddingModel, signal) {
        const config = overrideConfig || this._getEmbeddingModelConfig();
        
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
