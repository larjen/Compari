/**
 * @module SettingController
 * @description HTTP Controller responsible for handling HTTP requests related to application settings.
 * 
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual business logic to Services/Config (SettingsManager).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business logic for AI or settings persistence.
 * - ❌ MUST NOT handle raw file system operations directly.
 * - ❌ MUST NOT import AiService directly; use SettingsManager wrapper.
 * - ✅ All business logic MUST be delegated to Services/Config.
 * - ✅ All data access MUST go through Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 * 
 * @socexplanation
 * - Standardizes error handling by delegating ALL errors to the global error middleware.
 * - This ensures consistent error responses and centralized error logging.
 * - Previously handled errors locally with res.status(500), now properly propagates via next().
 */

const settingsManager = require('../config/SettingsManager');

class SettingController {
    /**
     * GET /api/settings
     * Retrieves all application settings.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getAllSettings(req, res, next) {
        try {
            const settings = settingsManager.getAll();
            res.json({ settings });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/settings
     * Updates a specific setting.
     * 
     * @param {Object} req - Express request object (req.body.key, req.body.value)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * This method delegates to SettingsManager.set() which handles both database
     * persistence and in-memory cache invalidation. The SettingsManager uses an
     * in-memory cache for performance, and the set() method ensures cache coherence
     * by updating the cache immediately after the database update succeeds.
     * This maintains Separation of Concerns: the controller mediates between the
     * HTTP layer and the application state (both DB and memory).
     */
    static updateSetting(req, res, next) {
        try {
            settingsManager.set(req.body.key, req.body.value);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/settings/test-ai
     * Tests AI connectivity.
     * @param {Object} req - Express request object (req.body.message)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static testAiConnectivity(req, res, next) {
        (async () => {
            try {
                const reply = await settingsManager.testAiConnection(req.body.message);
                res.json({ success: true, reply });
            } catch (error) {
                next(error);
            }
        })();
    }
}

module.exports = SettingController;