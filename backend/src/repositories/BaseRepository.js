/**
 * @module BaseRepository
 * @description Generic Data Access Layer base class for all repository modules.
 * @responsibility
 * - Provides common CRUD operations for any database table.
 * - Enforces DRY principle by eliminating repeated SQL patterns.
 * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT contain complex queries (specific logic goes in child classes).
 */

const db = require('./Database');

class BaseRepository {
    /**
     * Creates a new BaseRepository instance for a specific table.
     * @constructor
     * @param {string} tableName - The name of the database table.
     */
    constructor(tableName) {
        this.tableName = tableName;
    }

    /**
     * Retrieves all rows from the table.
     * @method findAll
     * @returns {Array<object>} Array of all rows from the table.
     */
    findAll() {
        const stmt = db.prepare(`SELECT * FROM ${this.tableName}`);
        return stmt.all();
    }

    /**
     * Retrieves a single row by its primary key ID.
     * @method findById
     * @param {number} id - The primary key ID of the row to retrieve.
     * @returns {object|undefined} The row object, or undefined if not found.
     */
    findById(id) {
        const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
        return stmt.get(id);
    }

    /**
     * Deletes a row by its primary key ID.
     * @method deleteById
     * @param {number} id - The primary key ID of the row to delete.
     * @returns {object} SQLite run result containing `changes` count.
     */
    deleteById(id) {
        const stmt = db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
        return stmt.run(id);
    }
}

module.exports = BaseRepository;