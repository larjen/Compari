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

/* eslint-disable no-restricted-syntax */
// Architectural Exception: Required for Phase 0 fatal error logging before DI container exists.
const FileService = require('../services/FileService');
const LogService = require('../services/LogService');
/* eslint-enable no-restricted-syntax */

const tempFileService = new FileService();
const logService = new LogService({ fileService: tempFileService });

/**
 * Registers process-level event listeners for error handling.
 * This function should be called once during server initialization.
 * @public
 * @returns {void}
 */
function registerProcessListeners() {
    process.on('unhandledRejection', (reason, _promise) => {
        const errorObj = reason instanceof Error ? reason : new Error(String(reason));
        /** @socexplanation Error handling consolidated to logSystemFault to prevent swallowed stack traces and enforce DRY principles. */
        logService.logSystemFault({ origin: 'Process', message: 'Unhandled Promise Rejection', errorObj: errorObj });
    });

    process.on('uncaughtException', (error) => {
        /** @socexplanation Error handling consolidated to logSystemFault to prevent swallowed stack traces and enforce DRY principles. */
        logService.logSystemFault({ origin: 'Process', message: 'Uncaught Exception', errorObj: error });
        process.exit(1);
    });
}

module.exports = {
    registerProcessListeners
};
