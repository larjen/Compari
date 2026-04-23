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
 * @dependency_injection
 * All services (settingsManager, aiService, logService) are injected via constructor.
 * No global service locator is used - dependencies are explicitly provided.
 *
 * @socexplanation
 * - Standardizes error handling by delegating ALL errors to the global error middleware.
 * - This ensures consistent error responses and centralized error logging.
 * - Previously handled errors locally with res.status(500), now properly propagates via next().
 */

const asyncHandler = require('../utils/asyncHandler');
const { LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class SettingController {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.settingsManager - Settings manager service instance
     * @param {Object} dependencies.aiService - AI service instance
     * @param {Object} dependencies.logService - Logging service instance
     */
    constructor({ settingsManager, aiService, logService }) {
        this._settingsManager = settingsManager;
        this._aiService = aiService;
        this._logService = logService;
    }

    /**
     * GET /api/settings
     * Retrieves all application settings.
     * @socexplanation
     * Uses asyncHandler to eliminate try/catch boilerplate per Rule 1.B.
     * Delegates to SettingsManager.getAll() for business logic.
     */
    getAllSettings = asyncHandler(async (req, res) => {
        const settings = this._settingsManager.getAll();
        res.json({ settings });
    });

    /**
     * POST /api/settings
     * Updates a specific setting.
     *
     * @param {Object} req - Express request object (req.body.key, req.body.value)
     * @param {Object} res - Express response object
     *
     * @socexplanation
     * This method delegates to SettingsManager.set() which handles both database
     * persistence and in-memory cache invalidation. The SettingsManager uses an
     * in-memory cache for performance, and the set() method ensures cache coherence
     * by updating the cache immediately after the database update succeeds.
     * This maintains Separation of Concerns: the controller mediates between the
     * HTTP layer and the application state (both DB and memory).
     * Uses asyncHandler to eliminate try/catch boilerplate per Rule 1.B.
     */
    updateSetting = asyncHandler(async (req, res) => {
        this._settingsManager.set(req.body.key, req.body.value);
        res.json({ success: true });
    });

    /**
     * POST /api/settings/test-ai
     * Tests AI connectivity using global end-to-end test.
     *
     * @param {Object} req - Express request object (req.body.message)
     * @param {Object} res - Express response object
     *
     * @dependency_injection_explanation
     * This method wires the AiService instance into SettingsManager.testAiConnection()
     * to eliminate circular dependencies. Previously, SettingsManager used a deferred
     * require inside the testAiConnection method, which violated Separation of Concerns.
     * Now the controller explicitly passes the dependency, following the DI pattern.
     * SettingsManager and AiService are at the same architectural layer (both are Services),
     * so the controller acts as the wiring layer to connect them.
     *
     * @socexplanation
     * - Uses asyncHandler to eliminate try/catch boilerplate per Rule 1.B.
     * - Wraps AI test with logTerminal for results to terminal.
     * - Logging performed in Controller layer, execution in Service layer.
     * - Error logging now includes the errorObj parameter to ensure full stack traces are visible
     *   in the terminal when debug_mode is enabled.
     */
    testAiConnectivity = asyncHandler(async (req, res) => {
        const reply = await this._settingsManager.testAiConnection(req.body.message, this._aiService);

        this._logService.logTerminal({
            status: LOG_LEVELS.INFO,
            symbolKey: LOG_SYMBOLS.CHECKMARK,
            origin: 'SettingController',
            message: 'Global AI connectivity test successful.'
        });

        res.json({ success: true, reply });
    });
}

module.exports = SettingController;