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
 *
 * @dependency_injection
 * This module is executed in Phase 2 of server.js to create tables BEFORE the DI container
 * is initialized in Phase 2.5. The logger instance is passed from server.js during boot.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { DB_DIR, ENTITY_STATUS, ENTITY_TYPES } = require('../config/constants');

class DatabaseConnection {
    constructor() {
        const dbPath = path.join(DB_DIR, 'database.db');

        this.db = new Database(dbPath);
        this.db.pragma('foreign_keys = ON');

        /**
         * WAL (Write-Ahead Logging) mode enables concurrent reads during writes,
         * preventing SQLITE_BUSY locks when multiple background tasks or HTTP
         * requests access the database simultaneously. Essential for production
         * environments with high concurrency and background job stability.
         */
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('busy_timeout = 5000');
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
 * Dynamic Schema Hydration:
 * The schema SQL contains placeholders ({{ENTITY_STATUS_LIST}}) that are replaced
 * at runtime with values from ENTITY_STATUS in constants.js. This ensures DRY
 * compliance - the allowed status values are defined in one place only, preventing
 * SQLite CHECK constraint failures when new statuses are added to the pipeline.
 *
 * After schema creation, seeds are run via the Seeder module.
 *
 * @param {Database} db - The active database connection instance.
 * @param {Object} logger - The LogService instance to use for boot logging.
 * @returns {void}
 * @throws {Error} If schema.sql cannot be read or executed.
 */
function initializeSchema(db, logger) {
    const schemaPath = path.join(__dirname, 'schema.sql');

    try {
        let sql = fs.readFileSync(schemaPath, 'utf8');

        const statusValues = Object.values(ENTITY_STATUS);
        const statusList = statusValues.map(v => `'${v}'`).join(', ');
        sql = sql.replace(/{{ENTITY_STATUS_LIST}}/g, statusList);

        const typeValues = Object.values(ENTITY_TYPES);
        const typeList = typeValues.map(v => `'${v}'`).join(', ');
        sql = sql.replace(/{{ENTITY_TYPE_LIST}}/g, typeList);

        db.exec(sql);
    } catch (err) {
        /** @socexplanation Error handling consolidated to logSystemFault to prevent swallowed stack traces and enforce DRY principles. */
        if (logger) {
            logger.logSystemFault({ origin: 'Database', message: 'Failed to read or execute schema.sql', errorObj: err });
        }
        throw err;
    }

    const Seeder = require('./Seeder');
    Seeder.seed(db, logger);
}

const db = new DatabaseConnection().db;

db.closeConnection = () => {
    db.close();
};

module.exports = db;
module.exports.initializeSchema = initializeSchema;
