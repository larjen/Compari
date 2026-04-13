/**
 * @module QueueController
 * @description HTTP Controller responsible for handling HTTP requests related to queue status.
 * 
 * @responsibility
 * - Extract HTTP parameters and query from incoming requests (req).
 * - Delegate actual business logic to Services (QueueService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business logic for queue processing.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ✅ All business logic MUST be delegated to Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 * 
 * @socexplanation
 * - Standardizes error handling by delegating ALL errors to the global error middleware.
 * - This ensures consistent error responses and centralized error logging.
 * - Previously handled errors locally with res.status(500), now properly propagates via next().
 */

const queueService = require('../services/QueueService');

class QueueController {
    /**
     * GET /api/queue/status
     * Retrieves the current queue status.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getQueueStatus(req, res, next) {
        try {
            const status = queueService.getQueueStatus();
            res.json(status);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = QueueController;