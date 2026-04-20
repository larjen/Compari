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
 * is initialized in Phase 2.5. Therefore, it creates a temporary logger instance using
 * the same pattern as ProcessGuard.js to log schema initialization and seeding progress.
 * This follows the DTO pattern to avoid top-level requires of services not yet initialized.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const FileService = require('../services/FileService');
const LogService = require('../services/LogService');
const { DB_DIR, LOG_LEVELS, LOG_SYMBOLS, ENTITY_STATUS, ENTITY_TYPES } = require('../config/constants');

const tempPdfService = null;
const tempFileService = new FileService({ pdfService: tempPdfService, logService: null });
const logger = new LogService({ fileService: tempFileService });

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
 * @returns {void}
 * @throws {Error} If schema.sql cannot be read or executed.
 */
function initializeSchema(db) {
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
        logger.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'Database', message: `FATAL: Failed to read or execute schema.sql: ${err.message}` });
        logger.logErrorFile({ origin: 'Database', message: 'Failed to read or execute schema.sql', errorObj: err });
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
