/**
 * @module Logger
 * @description Express HTTP middleware for request/response logging.
 * @responsibility
 * - Acts as an HTTP request/response middleware wrapper.
 * - Delegates all physical logging (file and stdout) to LogService to enforce a Single Source of Truth and avoid console-hijacking anti-patterns.
 * @boundary_rules
 * - ❌ MUST NOT use FileService for file I/O operations.
 * - ❌ MUST NOT import or use raw `fs` module for any file operations.
 * - ❌ MUST NOT override console.log or console.error.
 * - ✅ MUST delegate all logging output to LogService.
 * 
 * @separation_of_concerns
 * This middleware enforces strict SoC:
 * - HTTP traffic is primarily printed to the terminal via logTerminal().
 * - For audit purposes, also call logSystemFile() separately if persistent tracking is needed.
 * - The two logging methods must be called separately to maintain the SoC boundary.
 * - NOTE: Response payloads are NOT logged to prevent HTTP payload spam.
 * - HTTP traffic logging is extremely noisy and is now hidden behind the LOG_HTTP_TRAFFIC=true environment variable.
 * 
 * @dependency_injection Dependencies are injected strictly via the constructor.
 */

/**
 * @typedef {Object} LogLevels
 * @property {string} INFO
 * @property {string} WARN
 * @property {string} ERROR
 * @property {string} DEBUG
 */

const { LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class Logger {
    /**
     * Creates a Logger instance.
     * @param {string} serviceName - The name of the service using this Logger.
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.logService - The LogService instance
     * @param {Object} deps.settingsManager - The SettingsManager instance
     */
    constructor(serviceName, { logService, settingsManager }) {
        this.serviceName = serviceName;
        this._logService = logService;
        this._settingsManager = settingsManager;
        this.httpLogsEnabled = process.env.LOG_HTTP_TRAFFIC === 'true';
    }

    /**
     * Express middleware for logging HTTP requests and responses.
     * Uses res.on('finish') to log request completion without capturing response payloads.
     * @returns {function} Express middleware function.
     */
    middleware() {
        return (req, res, next) => {
            const debugEnabled = this._settingsManager && this._settingsManager.get('debug_mode') === 'true';

            // Skip logging if debug is off OR if HTTP-specific logging is disabled
            if (!debugEnabled || !this.httpLogsEnabled) return next();

            const startTime = Date.now();

            this._logService.logTerminal(LOG_LEVELS.INFO, LOG_SYMBOLS.NONE, 'HTTP', `INCOMING: ${req.method} ${req.url}`);

            res.on('finish', () => {
                const duration = Date.now() - startTime;
                this._logService.logTerminal(LOG_LEVELS.INFO, LOG_SYMBOLS.NONE, 'HTTP', `RESOLVED: ${req.method} ${req.url} (${res.statusCode}) - ${duration}ms`);
            });

            next();
        };
    }
}

module.exports = Logger;