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

class BaseRepository {
    /**
     * Creates a new BaseRepository instance for a specific table.
     * @constructor
     * @param {string} tableName - The name of the database table.
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     * @param {Function|null} deps.mapper - Optional row mapper function.
     */
    constructor(tableName, { db, mapper = null }) {
        this.tableName = tableName;
        this.db = db;
        this.mapper = mapper;
    }

    /**
     * Retrieves all rows from the table.
     * @method findAll
     * @returns {Array<object>} Array of all rows from the table.
     */
    findAll() {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName}`);
        const rows = stmt.all();
        if (this.mapper) {
            return rows.map(row => this.mapper(row));
        }
        return rows;
    }

    /**
     * Retrieves a single row by its primary key ID.
     * @method findById
     * @param {number} id - The primary key ID of the row to retrieve.
     * @returns {object|undefined} The row object, or undefined if not found.
     */
    findById(id) {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
        const row = stmt.get(id);
        if (this.mapper && row) {
            return this.mapper(row);
        }
        return row;
    }

    /**
     * Updates a row with the given data object.
     * Dynamically builds the UPDATE SQL statement from the keys of the data object.
     * Automatically appends updated_at = CURRENT_TIMESTAMP.
     * @method update
     * @param {number} id - The primary key ID of the row to update.
     * @param {Object} data - The data object with column-value pairs.
     * @returns {boolean} True if the row was updated, false otherwise.
     */
    update(id, data) {
        const keys = Object.keys(data);
        if (keys.length === 0) return false;
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        values.push(id);
        const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
        return stmt.run(...values).changes > 0;
    }

    /**
     * Deletes a row by its primary key ID.
     * @method deleteById
     * @param {number} id - The primary key ID of the row to delete.
     * @returns {object} SQLite run result containing `changes` count.
     */
    deleteById(id) {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
        return stmt.run(id);
    }
}

module.exports = BaseRepository;