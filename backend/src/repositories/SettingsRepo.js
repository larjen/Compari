/**
 * @module SettingsRepo
 * @description Data Access Layer for settings table.
 *
 * @responsibility
 * - Pure Data Access: Only handles database read/write operations for settings.
 * - Provides methods to get all settings and upsert individual settings.
 *
 * @boundary_rules
 * - ❌ MUST NOT contain business logic.
 * - ❌ MUST NOT validate settings values.
 * - ❌ MUST NOT know the meaning of settings keys.
 * - ✅ MUST only execute SQL and return raw data.
 */

const BaseRepository = require('./BaseRepository');

class SettingsRepo extends BaseRepository {
    /**
     * Creates a new SettingsRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     */
    constructor({ db }) {
        super('settings', { db });
    }

    /**
     * Retrieves all settings as key-value pairs.
     * @returns {Array<{key: string, value: string}>} Array of settings objects.
     */
    getAllSettings() {
        const stmt = this.db.prepare('SELECT key, value FROM settings');
        return stmt.all();
    }

    /**
     * Upserts a setting (insert or update).
     * @param {string} key - The setting key.
     * @param {string} value - The setting value.
     * @returns {object} SQLite run result.
     */
    upsertSetting(key, value) {
        const stmt = this.db.prepare(`
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        return stmt.run(key, value);
    }
}

/**
 * @dependency_injection
 * SettingsRepo exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * @param {Object} deps - Dependencies object.
 * @param {Object} deps.db - The database instance (injected).
 * Reasoning: Allows runtime configuration and testing via injection.
 */
module.exports = SettingsRepo;
