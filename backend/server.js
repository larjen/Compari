
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

const ProcessGuard = require('./src/utils/ProcessGuard');
ProcessGuard.registerProcessListeners();
// Process-level listeners must be attached before any infrastructure or domain logic initializes.
// This separation of concerns (SoC) ensures the ProcessGuard can catch initialization errors.

// Phase 0: Data Cleanup (Development Only)
// =======================================
const shouldWipe = process.argv.includes('--wipe') || process.env.WIPE_DATA === 'true';
if (shouldWipe) {
    try {
        const FileService = require('./src/services/FileService');
        const fileService = new FileService();
        fileService.wipeWorkspace();
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[FATAL] Phase 0 Failed: Could not wipe workspace:', err.message);
        process.exit(1);
    }
}

// Phase 1: Infrastructure Pre-requisites
// ======================================
// Initialize all directories in the data folder BEFORE any other operations.
// This ensures Database, Applications, Career Archive, etc. directories exist.

const FileService = require('./src/services/FileService');
const LogService = require('./src/services/LogService');
const bootFileService = new FileService();
const bootLogger = new LogService({ fileService: bootFileService });

try {
    bootFileService.initializeWorkspace();
} catch (err) {
    // eslint-disable-next-line no-console
    console.error('[FATAL] Phase 1 Failed: Could not initialize workspace directories:', err.message);
    process.exit(1);
}

// Phase 2: Data Persistence Schema
// =================================
try {
    const db = require('./src/repositories/Database');
    const { initializeSchema } = require('./src/repositories/Database');
    initializeSchema(db, bootLogger);
} catch (err) {
    // eslint-disable-next-line no-console
    console.error('[FATAL] Phase 2 Failed: Could not initialize database schema:', err.message);
    process.exit(1);
}

// Phase 2.5 & 3: Composition & Start
// ==================================
async function startServer() {
    try {
        const { bootstrap } = require('./src/config/container');
        await bootstrap();
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[FATAL] Phase 2.5 Failed: Container Bootstrap Error:', err.message);
        process.exit(1);
    }

    const container = require('./src/config/container').getContainer();
    const logService = container.resolve('logService');
    const settingsManager = container.resolve('settingsManager');
    const { LOG_LEVELS, LOG_SYMBOLS, HTTP_STATUS } = require('./src/config/constants');
    const setupRoutes = require('./src/routes/index');

    logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.NONE, origin: 'server.js', message: `Server starting...` });

    const express = require('express');
    const Logger = require('./src/utils/Logger');

    const app = express();
    const PORT = process.env.PORT || 3000;

    const logger = new Logger('system', { logService, settingsManager });
    app.use(logger.middleware());
    app.use(express.json());

    setupRoutes(app, container);

    app.get('/', (req, res) => {
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: "Compari API is running successfully.",
            timestamp: new Date().toISOString()
        });
    });

    app.use((req, res, next) => {
        const error = new Error(`Route not found: ${req.originalUrl}`);
        error.status = HTTP_STATUS.NOT_FOUND;
        next(error);
    });

    app.use((err, req, res, next) => {
        logService.logSystemFault({ origin: 'GlobalErrorHandler', message: `API Error on ${req.method} ${req.url}`, errorObj: err });
        res.status(err.status || 500).json({
            success: false,
            error: err.message,
            path: req.url
        });
    });

    const queueService = container.resolve('queueService');

    // Update the listen block to handle long-running reasoning tasks
    const server = app.listen(PORT, '0.0.0.0', async () => {
        const startupTime = Math.round(performance.now() - startTime);

        await queueService.sweepOrphanedTasks();
        queueService.start();

        logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'server.js', message: `Backend API running on http://localhost:${PORT}` });

        const debugMode = settingsManager.get('debug_mode');
        if (debugMode === 'true') {
            logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'server.js', message: 'Server is running in DEBUG/DEV mode. Verbose logging is enabled.' });
        }

        logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'server.js', message: `Server started in ${startupTime}ms` });
    });

    // Enforce a 5-minute timeout for AI reasoning and heavy processing
    server.timeout = 300000;
}

// Execute the async startup
startServer();
