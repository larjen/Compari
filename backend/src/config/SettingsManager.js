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
 * - ✅ Uses the database for all settings storage.
 * - ✅ Uses in-memory cache for fast reads.
 * - ❌ MUST NOT use raw `fs` module for any file operations.
 * - ❌ MUST NOT know about the meaning of the settings (e.g., it shouldn't validate if an Ollama host URL is real).
 * - ❌ MUST NOT be heavily coupled to domain services (Services should ideally receive their settings as injected variables).
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

const db = require('../repositories/Database');

class SettingsManager {
    constructor() {
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
        
        const rows = db.prepare('SELECT key, value FROM settings').all();
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
        db.prepare(`
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(key, value);
        
        this._cache.set(key, value);
        return true;
    }

    /**
     * Tests AI connectivity by sending a test message.
     * @description Uses deferred require for AiService to prevent circular dependency crashes.
     * @param {string} message - The test message to send to the AI.
     * @returns {Promise<string>} The AI's response.
     * @throws {Error} If the AI connection fails.
     */
    async testAiConnection(message) {
        // DEFERRED REQUIRE: Breaks circular dependency with AiService
        const AiService = require('../services/AiService');

        const host = this.get('ollama_host');
        const model = this.get('ollama_model');
        return await AiService.testChat(message, host, model);
    }
}

module.exports = new SettingsManager();
