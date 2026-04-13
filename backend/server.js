
/**
 * @file server.js
 * @description Minimalist orchestrator for the Compari API.
 * 
 * This file delegates infrastructure to /utils and domain logic to /routes.
 * It coordinates the startup sequence but contains no business logic.
 * 
 * @responsibility
 * - Phase 1: Initialize workspace directories
 * - Phase 2: Initialize database schema and seed data
 * - Phase 3: Mount routes and start services
 * - Final Safety Net: GlobalErrorHandler for unhandled errors
 * 
 * @separation_of_concerns
 * Startup messages generally only go to terminal via logTerminal().
 * Errors are logged to both terminal (logTerminal) and error file (logErrorFile).
 */

const startTime = performance.now();

require('dotenv').config();

require('./src/utils/ProcessGuard').registerProcessListeners();
// Process-level listeners must be attached before any infrastructure or domain logic initializes.
// This separation of concerns (SoC) ensures the ProcessGuard can catch initialization errors.

// Phase 0: Data Cleanup (Development Only)
// =======================================
const shouldWipe = process.argv.includes('--wipe') || process.env.WIPE_DATA === 'true';
if (shouldWipe) {
    try {
        const FileService = require('./src/services/FileService');
        FileService.wipeWorkspace();
    } catch (err) {
        console.error('[FATAL] Phase 0 Failed: Could not wipe workspace:', err.message);
        process.exit(1);
    }
}

// Phase 1: Infrastructure Pre-requisites
// ======================================
// Initialize all directories in the data folder BEFORE any other operations.
// This ensures Database, Applications, Career Archive, etc. directories exist.

try {
    const FileService = require('./src/services/FileService');
    FileService.initializeWorkspace();
} catch (err) {
    console.error('[FATAL] Phase 1 Failed: Could not initialize workspace directories:', err.message);
    process.exit(1);
}

// Phase 2: Data Persistence Schema
// =================================
try {
    const db = require('./src/repositories/Database');
    const { initializeSchema } = require('./src/repositories/Database');
    initializeSchema(db);
} catch (err) {
    console.error('[FATAL] Phase 2 Failed: Could not initialize database schema:', err.message);
    process.exit(1);
}

// Phase 3: Application Logic
// ==========================
const logService = require('./src/services/LogService');
const setupRoutes = require('./src/routes/index');

logService.logTerminal('INFO', 'NONE', 'server.js', `Server starting...`);

const express = require('express');

const Logger = require('./src/utils/Logger');

const app = express();
const PORT = process.env.PORT || 3000;

const logger = new Logger('system');
app.use(logger.middleware());

app.use(express.json());

setupRoutes(app);

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: "Compari API is running successfully.",
        timestamp: new Date().toISOString()
    });
});

/**
 * Catch-all 404 handler for unmatched routes.
 * Part of server error hardening - ensures all unmatched routes return structured JSON
 * instead of default HTML error pages.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
app.use((req, res, next) => {
    const error = new Error(`Route not found: ${req.originalUrl}`);
    error.status = 404;
    next(error);
});

/**
 * Global error handler middleware.
 * Final safety net for the application - catches all unhandled errors from controllers.
 * Enforces SoC by keeping infrastructure logging out of the routing layer.
 * Uses LogService to automatically format and print full stack traces in development.
 * 
 * @param {Error} err - The error object passed from controllers via next(error)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
app.use((err, req, res, next) => {
    logService.logTerminal('ERROR', 'ERROR', 'GlobalErrorHandler', `API Error on ${req.method} ${req.url}`);
    logService.logErrorFile('GlobalErrorHandler', `API Error on ${req.method} ${req.url}`, err);

    res.status(err.status || 500).json({
        success: false,
        error: err.message,
        path: req.url
    });
});

const registerTaskListeners = require('./src/events/TaskListeners');
registerTaskListeners();

const queueService = require('./src/services/QueueService');
queueService.start();

const entityService = require('./src/services/EntityService');

app.listen(PORT, '0.0.0.0', () => {
    const startupTime = Math.round(performance.now() - startTime);

    logService.logTerminal('INFO', 'CHECKMARK', 'server.js', `Backend API running on http://localhost:${PORT}`);

    const isDevMode = process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true';
    if (isDevMode) {
        logService.logTerminal('WARN', 'WARNING', 'server.js', 'Server is running in DEBUG/DEV mode. Verbose logging is enabled.');
        logService.logTerminal('INFO', 'NONE', 'server.js', 'To disable debug mode and run normally, stop this process and use: npm start');
    } else {
        logService.logTerminal('INFO', 'CHECKMARK', 'server.js', 'Server is running in PRODUCTION mode.');
    }

    logService.logTerminal('INFO', 'CHECKMARK', 'server.js', `Server started in ${startupTime}ms`);
    console.log();
});
