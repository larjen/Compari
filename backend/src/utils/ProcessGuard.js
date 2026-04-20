/**
 * @module utils/ProcessGuard
 * @description Process-level error hardening utilities.
 * 
 * This module provides process-level error handling to prevent silent crashes
 * and ensure fatal errors are logged for debugging.
 * 
 * @responsibility
 * - Handles unhandled promise rejections
 * - Handles uncaught exceptions with graceful exit
 * 
 * @boundary_rules
 * - MUST NOT contain application logic
 * - MUST be initialized once at server startup
 * 
 * @separation_of_concerns
 * Unhandled rejections and exceptions MUST trigger both:
 * - logTerminal() with 'ERROR' status for developer visibility
 * - logErrorFile() for permanent audit trail
 * 
 * @exception DI Bypass
 * This guard runs at Phase 0 (before Phase 1) to catch fatal startup errors.
 * Because the DI container is not yet initialized at this stage (bootstrapped in Phase 2.5),
 * this module must manually instantiate FileService and LogService with null stubs
 * rather than relying on the DI container. This is a necessary evil to ensure
 * fatal errors during early startup are caught and logged properly.
 */

const FileService = require('../services/FileService');
const LogService = require('../services/LogService');

const tempPdfService = null;
const tempFileService = new FileService({ pdfService: tempPdfService, logService: null });
const logService = new LogService({ fileService: tempFileService });
const { LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

/**
 * Registers process-level event listeners for error handling.
 * This function should be called once during server initialization.
 * @public
 * @returns {void}
 */
function registerProcessListeners() {
    process.on('unhandledRejection', (reason, _promise) => {
        const errorObj = reason instanceof Error ? reason : new Error(String(reason));
        logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'Process', message: 'Unhandled Promise Rejection', errorObj: errorObj });
        logService.logErrorFile({ origin: 'Process', message: 'Unhandled Promise Rejection', errorObj: errorObj });
    });

    process.on('uncaughtException', (error) => {
        logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'Process', message: 'Uncaught Exception', errorObj: error });
        logService.logErrorFile({ origin: 'Process', message: 'Uncaught Exception', errorObj: error });
        process.exit(1);
    });
}

module.exports = {
    registerProcessListeners
};
