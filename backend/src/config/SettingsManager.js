/**
 * @module SettingsManager
 * @description Configuration utility for reading and writing application settings.
 * 
 * @responsibility
 * - Reads and writes key-value pairs to the SQLite database.
 * - Provides settings for AI connection, threshold configuration, and other app settings.
 * - Supports frontend configurability by storing settings in the database.
 * - Uses in-memory cache for performance optimization.
 * 
 * @boundary_rules
 * - ✅ Uses Repository for all settings storage (via SettingsRepo).
 * - ✅ Uses in-memory cache for fast reads.
 * - ❌ MUST NOT use raw `fs` module for any file operations.
 * - ❌ MUST NOT know about the meaning of the settings (e.g., it shouldn't validate if an Ollama host URL is real).
 * - ❌ MUST NOT be heavily coupled to domain services (Services should ideally receive their settings as injected variables).
 * 
 * @dependency_injection
 * - Accepts settingsRepo via constructor injection.
 * - No direct database imports - all DB access goes through SettingsRepo.
 * 
 * @database_driven_explanation
 * All settings are now stored in the SQLite database table 'settings' to support
 * frontend configurability. The settings table has columns: key (TEXT PRIMARY KEY), value (TEXT).
 * 
 * @cache_invalidation_strategy
 * - On startup: cache is populated from database.
 * - On set(): database is updated AND cache is immediately invalidated/updated.
 * - On get(): cache is checked first; if miss, database is queried and cache is populated.
 */

class SettingsManager {
    /**
     * @constructor
     * @param {Object} deps - Dependencies
     * @param {Object} deps.settingsRepo - SettingsRepo instance for database access
     */
    constructor({ settingsRepo }) {
        this._settingsRepo = settingsRepo;
        this._cache = new Map();
        this._cacheLoaded = false;
    }

    /**
     * Ensures the cache is populated from the database.
     * @private
     * @returns {void}
     */
    _ensureCacheLoaded() {
        if (this._cacheLoaded) return;
        
        const rows = this._settingsRepo.getAllSettings();
        for (const row of rows) {
            this._cache.set(row.key, row.value);
        }
        this._cacheLoaded = true;
    }

    /**
     * Reloads all settings from the database into the cache.
     * Use this when you need to force a complete refresh of cached settings.
     * 
     * @method reload
     * @memberof SettingsManager
     * @returns {void}
     */
    reload() {
        this._cache.clear();
        this._cacheLoaded = false;
        this._ensureCacheLoaded();
    }
    /**
     * Retrieves all settings from the database.
     * Queries all rows from the settings table and returns them as a key-value object.
     * 
     * @method getAll
     * @memberof SettingsManager
     * @returns {Object} Object mapping setting keys to their values.
     */
    getAll() {
        this._ensureCacheLoaded();
        const settings = {};
        for (const [key, value] of this._cache) {
            settings[key] = value;
        }
        return settings;
    }

    /**
     * Retrieves a single setting value by its key.
     * Uses in-memory cache for fast access.
     * 
     * @method get
     * @memberof SettingsManager
     * @param {string} key - The setting key to retrieve.
     * @returns {string|null} The setting value, or null if not found.
     */
    get(key) {
        this._ensureCacheLoaded();
        return this._cache.get(key) ?? null;
    }

    /**
     * Sets a setting value. Uses upsert logic to insert or update.
     * Uses SQLite's ON CONFLICT clause for atomic upsert.
     * Immediately updates the in-memory cache to ensure coherence.
     * 
     * @method set
     * @memberof SettingsManager
     * @param {string} key - The setting key to set.
     * @param {string} value - The value to set.
     * @returns {boolean} True if successful.
     */
    set(key, value) {
        this._settingsRepo.upsertSetting(key, value);
        
        this._cache.set(key, value);
        return true;
    }

    /**
     * Tests AI connectivity by sending a test message.
     * @description Uses dependency injection for AiService to eliminate circular dependencies.
     * The caller (e.g., SettingController) is responsible for wiring the AiService instance
     * to avoid circular dependency issues between SettingsManager and AiService.
     * 
     * @method testAiConnection
     * @memberof SettingsManager
     * @param {string} message - The test message to send to the AI.
     * @param {Object} aiServiceInstance - The AiService instance to use for testing.
     * @returns {Promise<string>} The AI's response.
     * @throws {Error} If the AI connection fails.
     * 
     * @dependency_injection_explanation
     * Previously used deferred require inside this method to break circular dependency
     * with AiService. Now accepts aiServiceInstance as a parameter, following the
     * Dependency Injection pattern. This eliminates circular dependencies and improves
     * testability by allowing mock AiService instances to be injected.
     */
    async testAiConnection(message, aiServiceInstance) {
        const host = this.get('ollama_host');
        const model = this.get('ollama_model');
        return await aiServiceInstance.testChat(message, host, model);
    }
}

/**
 * @dependency_injection
 * SettingsManager exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = SettingsManager;