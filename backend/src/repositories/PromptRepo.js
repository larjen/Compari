/**
 * @module PromptRepo
 * @description Data Access Layer for the prompts table.
 * @responsibility
 * - Executes all SQL CRUD queries related to prompt templates.
 * - Maps raw SQLite rows into prompt objects.
 * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events.
 * - ❌ MUST NOT interact with the file system or AI.
 */

const db = require('./Database');

class PromptRepo {
    getAllPrompts() {
        const stmt = db.prepare('SELECT * FROM prompts');
        const rows = stmt.all();
        return rows.map(row => this._mapRow(row));
    }

    getPromptBySystemName(systemName) {
        const stmt = db.prepare('SELECT * FROM prompts WHERE system_name = ?');
        const row = stmt.get(systemName);
        return this._mapRow(row);
    }

    getPromptById(id) {
        const stmt = db.prepare('SELECT * FROM prompts WHERE id = ?');
        const row = stmt.get(id);
        return this._mapRow(row);
    }

    updatePrompt(id, promptText) {
        const stmt = db.prepare('UPDATE prompts SET prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const result = stmt.run(promptText, id);
        return result.changes > 0;
    }

    _mapRow(row) {
        if (!row) return null;
        return {
            id: row.id,
            system_name: row.system_name,
            title: row.title,
            description: row.description,
            prompt: row.prompt,
            updated_at: row.updated_at
        };
    }
}

module.exports = new PromptRepo();