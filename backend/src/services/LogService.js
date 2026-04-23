/**
 * @module LogService
 * @description Infrastructure Service for application logging and notifications.
 * @responsibility
 * - Manages all logging operations (system logs, job logs).
 * - Writes structured logs to JSON Lines files.
 * - Emits notifications for system errors.
 * @boundary_rules
 * - ✅ MAY call other Utility/Infrastructure services.
 * - ❌ MUST NOT call Domain Services (e.g., JobListingService, WorkflowService).
 * - ❌ MUST NOT contain business logic or construct business-specific paths.
 *
 * @separation_of_concerns
 * This service enforces strict SoC between terminal and file output:
 * - logTerminal(): Writes ONLY to terminal/stdout. Handles ANSI formatting, dev-mode verbosity.
 * - logSystemFile(): Writes ONLY to system.jsonl. SUPPOSED in production (NODE_ENV=production).
 * - logErrorFile(): Writes ONLY to errors.jsonl. Writes regardless of environment.
 *
 * USAGE RULES:
 * - Is it just developer feedback? -> Use logTerminal() only.
 * - Is it a system fault that needs permanent audit trail? -> Use logTerminal() + logErrorFile().
 * - Is it a major workflow milestone that needs historical tracking (non-production)? -> Use logTerminal() + logSystemFile().
 *
 * @socexplanation
 * - This service centralizes the application's logging strategy, enforcing a strict separation between terminal output and persistent storage.
 * - It enables dynamic debug levels and ensures that critical errors are always audited regardless of the environment.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const { LOGS_DIR, LOG_LEVELS } = require('../config/constants');

class LogService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.fileService - The FileService instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ fileService, settingsManager } = {}) {
        this._fileService = fileService;
        this._settingsManager = settingsManager;

        this.SYMBOLS = {
            CHECKMARK: '\x1b[32m✓\x1b[0m',
            INFO: '\x1b[34mℹ\x1b[0m',
            WARNING: '\x1b[33m⚠\x1b[0m',
            ERROR: '\x1b[31m✖\x1b[0m',
            LIGHTNING: '\x1b[36m✧\x1b[0m',
            NONE: ' '
        };
    }

    _isDebugEnabled() {
        return this._settingsManager && this._settingsManager.get('debug_mode') === 'true';
    }

    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }

    _stripAnsi(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    }

    /**
     * Recursively sanitizes data for JSON serialization.
     * Strips ANSI escape codes from strings and converts Error objects to plain objects.
     * @param {*} data - The data to sanitize (object, array, string, Error, or primitive).
     * @param {WeakSet} [seen] - Internal WeakSet for circular reference detection.
     * @returns {*} Sanitized data safe for JSON serialization.
     * 
     * @description Ensures logs remain machine-readable and prevents infrastructure-level 
     * ANSI pollution in the data layer (SoC).
     * 
     * @socexplanation
     * This method is a private helper that provides data-layer sanitization. It ensures that
     * any ANSI escape codes (used for terminal coloring) are stripped from log data before
     * serialization, and converts Error objects to plain objects to prevent serialization failures.
     * This maintains Separation of Concerns by keeping the Infrastructure layer's logging
     * output clean and parseable.
     */
    _sanitizeForJson(data, seen = new WeakSet()) {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'string') {
            let sanitized = this._stripAnsi(data);
            sanitized = sanitized.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, '');
            return sanitized;
        }

        if (data instanceof Error) {
            return {
                name: data.name,
                message: data.message,
                stack: data.stack
            };
        }

        if (typeof data === 'object') {
            if (seen.has(data)) {
                return '[Circular Reference]';
            }
            seen.add(data);

            if (Array.isArray(data)) {
                return data.map(item => this._sanitizeForJson(item, seen));
            }

            const sanitizedObj = {};
            for (const key of Object.keys(data)) {
                sanitizedObj[key] = this._sanitizeForJson(data[key], seen);
            }
            return sanitizedObj;
        }

        return data;
    }

    /**
     * Safely stringifies data to JSON with full sanitization and circular reference protection.
     * @param {*} data - The data to stringify.
     * @returns {string} JSON string or fallback message if serialization fails.
     * 
     * @description Provides a crash-proof serialization layer for complex domain objects,
     * ensuring that logging failures never interrupt the primary application execution flow.
     * 
     * @socexplanation
     * This method wraps the entire sanitization and stringification process in a try-catch
     * to prevent logging failures from crashing the application. It uses WeakSet for circular
     * reference detection and provides a fallback message if serialization fails, ensuring
     * the logging system never interrupts primary application execution.
     */
    _safeStringify(data) {
        try {
            const sanitized = this._sanitizeForJson(data);
            return JSON.stringify(sanitized);
        } catch (error) {
            return JSON.stringify({
                _loggingError: true,
                message: 'Failed to serialize log entry',
                originalError: error.message
            });
        }
    }

    /**
     * Logs a message to the terminal/console ONLY.
     *
     * @method logTerminal
     * @memberof LogService
     * @param {Object} logDto - Data Transfer Object containing all log parameters.
     * @param {string} logDto.status - The log status level (e.g., 'INFO', 'ERROR', 'WARN').
     * @param {string} logDto.symbolKey - The symbol key for the log symbol (e.g., 'CHECKMARK', 'ERROR').
     * @param {string} logDto.origin - The origin of the log message (e.g., 'QueueService.js').
     * @param {string} logDto.message - The log message.
     * @param {Error|null} [logDto.errorObj] - Optional Error object to append stack trace (added to prevent silent failures).
     * @returns {void}
     *
     * @description
     * Handles ANSI formatting and console.log/warn/error.
     * This method performs NO file I/O - it writes ONLY to the terminal.
     *
     * @architectural_decision
     * Enforces Anti-Parameter Creep policy (ARCHITECTURE.md Section 6). Function accepts 5 parameters
     * which exceeds the 3-parameter threshold, so a single DTO is used instead of positional arguments.
     * This improves maintainability and reduces the risk of argument order errors.
     *
     * @soc_explanation
     * This method enforces Separation of Concerns by keeping terminal output completely
     * isolated from file persistence. Use this for developer feedback, debugging,
     * and console output that doesn't need to be persisted to disk.
     *
     * @rule
     * - Is it just developer feedback? -> Use logTerminal() only.
     * - Is it a system fault that needs permanent audit trail? -> Use logTerminal() + logErrorFile().
     * - Is it a major workflow milestone that needs historical tracking (non-production)? -> Use logTerminal() + logSystemFile().
     *
     * @param errorObj - Added as 5th parameter to prevent silent failures. When an Error object
     * is passed, its stack trace is appended to the terminal message for full visibility.
     */
    logTerminal({ status, symbolKey, origin, message, errorObj = null }) {
        const symbol = this.SYMBOLS[symbolKey] || ' ';

        const originTag = origin ? `\x1b[90m[${origin}]\x1b[0m ` : '';
        let terminalMessage = ` ${symbol} ${originTag}${message}`;

        if (errorObj) {
            if (this._isDebugEnabled() && errorObj.stack) {
                terminalMessage += `\n${errorObj.stack}`;
            } else if (errorObj.message) {
                terminalMessage += ` - ${errorObj.message}`;
            }
        }

        const printMethod = status === 'ERROR' ? 'error' : status === 'WARN' ? 'warn' : 'log';
        // eslint-disable-next-line no-console
        console[printMethod](terminalMessage);
    }

    /**
     * Logs a message to the system.jsonl file ONLY.
     * 
     * @method logSystemFile
     * @memberof LogService
     * @param {string} origin - The origin of the log message (e.g., 'QueueService.js').
     * @param {string} message - The log message.
     * @param {Object|null} details - Optional details object to include in the log entry.
     * @returns {void}
     * 
     * @description
     * Formats data as JSONL and appends to system.jsonl using FileService.
     * This method performs NO terminal I/O - it writes ONLY to the file.
     * 
     * @critical_behavior
     * ⚠️ If process.env.NODE_ENV === 'production', this method returns immediately
     * without writing to the file. System logging is completely suppressed in production.
     * 
     * @soc_explanation
     * This method enforces Separation of Concerns by keeping file persistence completely
     * isolated from terminal output. Use this for system events, workflow milestones,
     * and audit tracking that needs to be persisted to disk.
     * 
     * @rule
     * In production (NODE_ENV=production), system.jsonl logging is disabled.
     * For persistent error logging in production, use logErrorFile() instead.
     */
    logSystemFile(origin, message, details = null) {
        if (!this._isDebugEnabled()) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            origin: origin || 'System',
            message: message,
            details: details ? (details instanceof Error ? details.stack : details) : undefined,
            format: 'jsonl'
        };

        const fileService = this._fileService;
        this._fileService.createDirectory(LOGS_DIR);
        fileService.appendToFile(LOGS_DIR, 'system.jsonl', this._safeStringify(logEntry) + '\n');
    }

    /**
     * Logs an error message to the errors.jsonl file ONLY.
     *
     * @method logErrorFile
     * @memberof LogService
     * @param {Object} logDto - Data Transfer Object containing all error log parameters.
     * @param {string} logDto.origin - The origin of the log message (e.g., 'QueueService.js').
     * @param {string} logDto.message - The error message.
     * @param {Error|null} [logDto.errorObj] - Optional Error object for error details.
     * @param {Object|null} [logDto.details] - Optional additional details object.
     * @returns {void}
     *
     * @description
     * Formats data as JSONL and appends to errors.jsonl using FileService.
     * This method performs NO terminal I/O - it writes ONLY to the file.
     *
     * @architectural_decision
     * Enforces Anti-Parameter Creep policy (ARCHITECTURE.md Section 6). Function accepts 4 parameters
     * which exceeds the 3-parameter threshold, so a single DTO is used instead of positional arguments.
     * This improves maintainability and reduces the risk of argument order errors.
     *
     * @critical_behavior
     * ⚠️ Unlike logSystemFile(), this method writes regardless of the environment.
     * Error logs are persisted in both development and production.
     *
     * @soc_explanation
     * This method enforces Separation of Concerns by keeping error file persistence
     * completely isolated from terminal output. Use this for system faults, errors,
     * and failures that need permanent audit trail regardless of environment.
     *
     * @rule
     * Always call logTerminal() with 'ERROR' status alongside this method
     * when you need the error to be visible to developers in the terminal.
     * This method handles ONLY file persistence.
     */
    logErrorFile({ origin, message, errorObj = null, details = null }) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            origin: origin || 'System',
            message: message,
            error: errorObj ? (errorObj.stack || errorObj.message) : undefined,
            details: details ? (details instanceof Error ? details.stack : details) : undefined,
            format: 'jsonl'
        };

        const fileService = this._fileService;
        this._fileService.createDirectory(LOGS_DIR);
        fileService.appendToFile(LOGS_DIR, 'errors.jsonl', this._safeStringify(logEntry) + '\n');
    }

    /**
     * Adds an activity log entry for a given entity.
     *
     * @method addActivityLog
     * @memberof LogService
     * @param {Object} activityLogDto - The DTO containing activity log data
     * @param {string} activityLogDto.entityType - The type of entity (e.g., 'Entity', 'Match')
     * @param {number|string} activityLogDto.entityId - The ID of the entity
     * @param {string} activityLogDto.logType - The type of log (e.g., 'INFO', 'ERROR')
     * @param {string} activityLogDto.message - The log message
     * @param {string|null} [activityLogDto.folderPath] - Optional folder path for the log file
     * @param {Object|Error|null} [activityLogDto.verboseDetails] - Optional detailed information for development mode
     * @returns {Object} The log entry object.
     */
    addActivityLog({ entityType, entityId, logType, message, folderPath = null, verboseDetails = null }) {
        const fileService = this._fileService;
        if (!fileService) {
            return null;
        }

        const debugMode = this._settingsManager.get('debug_mode');

        if (debugMode !== 'true') {
            return null;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            entityType,
            entityId,
            logType,
            message,
            verboseDetails: verboseDetails ? (verboseDetails instanceof Error ? verboseDetails.stack : verboseDetails) : undefined
        };

        if (folderPath) {
            fileService.appendToFile(folderPath, 'activity.jsonl', this._safeStringify(logEntry) + '\n');
        }

        return logEntry;
    }


    /**
     * Logs AI traffic (prompts and responses) to a JSON Lines file.
     * The caller (e.g., AiService) is responsible for passing the shouldLog flag,
     * eliminating the need for LogService to query SettingsManager directly.
     * This follows the Separation of Concerns principle: LogService handles
     * file writing, while the caller decides when logging is appropriate.
     *
     * @method logAiTraffic
     * @memberof LogService
     * @param {Object} aiTrafficDto - The DTO containing AI traffic data
     * @param {string|null} aiTrafficDto.entityFolderPath - The entity-specific folder path where the log file will be written
     * @param {Array} aiTrafficDto.requestMessages - The array of messages sent to the AI model
     * @param {string} aiTrafficDto.responseContent - The content returned from the AI model
     * @param {Object} aiTrafficDto.config - Configuration object containing model details
     * @param {boolean} [aiTrafficDto.shouldLog=false] - Whether AI traffic should be logged
     * @returns {void}
     */
    logAiTraffic({ entityFolderPath, requestMessages, responseContent, config, shouldLog = false }) {
        if (!shouldLog || !entityFolderPath) return;

        const fileService = this._fileService;
        if (!fileService) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            requestMessages,
            responseContent,
            config
        };

        fileService.appendToFile(entityFolderPath, 'ai_interactions.jsonl', this._safeStringify(logEntry) + '\n');
    }

    /**
     * Consolidated system event logger that writes to both terminal and system file.
     * Calls logTerminal internally, then conditionally calls logSystemFile for INFO/WARN status.
     *
     * @method logSystemEvent
     * @memberof LogService
     * @param {Object} eventDto - Data Transfer Object containing all log parameters.
     * @param {string} eventDto.status - The log status level ('INFO', 'WARN', 'ERROR').
     * @param {string} eventDto.symbolKey - The symbol key for the log symbol (e.g., 'CHECKMARK', 'WARNING').
     * @param {string} eventDto.origin - The origin of the log message (e.g., 'QueueService.js').
     * @param {string} eventDto.message - The log message.
     * @param {Object|null} [eventDto.details] - Optional details object to include in the log entry.
     * @returns {void}
     *
     * @description
     * DRY consolidation method that combines terminal and file logging for system events.
     * Automatically determines whether to write to system.jsonl based on status.
     *
     * @socexplanation
     * This method centralizes the DRY violation where callers were duplicating the
     * logTerminal + logSystemFile call pattern. It enforces consistent logging
     * behavior and reduces boilerplate in calling services.
     */
    logSystemEvent({ status, symbolKey, origin, message, details = null }) {
        this.logTerminal({ status, symbolKey, origin, message });

        if (status === LOG_LEVELS.INFO || status === LOG_LEVELS.WARN) {
            this.logSystemFile(origin, message, details);
        }
    }

    /**
     * Consolidated system fault logger that writes to both terminal and error file.
     * Calls logTerminal with ERROR status internally, then calls logErrorFile.
     *
     * @method logSystemFault
     * @memberof LogService
     * @param {Object} faultDto - Data Transfer Object containing all fault log parameters.
     * @param {string} faultDto.origin - The origin of the log message (e.g., 'QueueService.js').
     * @param {string} faultDto.message - The error message.
     * @param {Error|null} [faultDto.errorObj] - Optional Error object for error details.
     * @param {Object|null} [faultDto.details] - Optional additional details object.
     * @returns {void}
     *
     * @description
     * DRY consolidation method that combines terminal and file logging for system faults.
     * Always writes to terminal with ERROR status and writes to errors.jsonl regardless of environment.
     *
     * @socexplanation
     * This method centralizes the DRY violation where callers were duplicating the
     * logTerminal (ERROR) + logErrorFile call pattern. It enforces consistent error
     * logging behavior and reduces boilerplate in calling services.
     */
    logSystemFault({ origin, message, errorObj = null, details = null }) {
        this.logTerminal({ status: 'ERROR', symbolKey: 'ERROR', origin, message, errorObj });
        this.logErrorFile({ origin, message, errorObj, details });
    }
}

module.exports = LogService;