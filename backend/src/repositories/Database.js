/**
 * @module Database
 * @description Database Connection and Table Initialization.
 * 
 * @responsibility
 * - Connects to the SQLite database.
 * - Initializes all tables and their schemas by reading from schema.sql.
 * - Triggers seeding of initial reference data after schema creation.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT contain inline SQL (delegated to schema.sql).
 * - ✅ Reads schema.sql from disk for table initialization.
 * - ✅ Delegates seeding to the Seeder module
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const logService = require('../services/LogService');
const { DB_DIR, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class DatabaseConnection {
    constructor() {
        const dbPath = path.join(DB_DIR, 'database.db');

        this.db = new Database(dbPath);
        this.db.pragma('foreign_keys = ON');
    }
}

/**
 * Initializes the database schema by reading SQL from schema.sql.
 * 
 * This function MUST be called exactly once during the server boot sequence
 * to ensure the unified schema is present before any services start.
 * It should be called AFTER FileService.initializeWorkspace() has completed
 * to ensure the database directory exists.
 * 
 * After schema creation, seeds are run via the Seeder module.
 * 
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 * @throws {Error} If schema.sql cannot be read or executed.
 */
function initializeSchema(db) {
    const schemaPath = path.join(__dirname, 'schema.sql');
    
    try {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        db.exec(sql);
    } catch (err) {
        logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'Database', `FATAL: Failed to read or execute schema.sql: ${err.message}`);
        logService.logErrorFile('Database', 'Failed to read or execute schema.sql', err);
        throw err;
    }

    const Seeder = require('./Seeder');
    Seeder.seed(db);
}

const db = new DatabaseConnection().db;

db.closeConnection = () => {
    db.close();
};

module.exports = db;
module.exports.initializeSchema = initializeSchema;
