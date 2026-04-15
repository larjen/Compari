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
 */

const logService = require('../services/LogService');

/**
 * Registers process-level event listeners for error handling.
 * This function should be called once during server initialization.
 * 
 * @returns {void}
 */
function registerProcessListeners() {
    process.on('unhandledRejection', (reason, _promise) => {
        const errorObj = reason instanceof Error ? reason : new Error(String(reason));
        logService.logTerminal('ERROR', 'ERROR', 'Process', 'Unhandled Promise Rejection', errorObj);
        logService.logErrorFile('Process', 'Unhandled Promise Rejection', errorObj);
    });

    process.on('uncaughtException', (error) => {
        logService.logTerminal('ERROR', 'ERROR', 'Process', 'Uncaught Exception', error);
        logService.logErrorFile('Process', 'Uncaught Exception', error);
        process.exit(1);
    });
}

module.exports = {
    registerProcessListeners
};
