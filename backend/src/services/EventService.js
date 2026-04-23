/**
 * @module EventService
 * @description Infrastructure Service for application-wide event broadcasting.
 * @responsibility
 * - Provides a central event bus for emitting and listening to application events.
 * - Supports domain events (e.g., `jobListingUpdate`, `notification`) and task events.
 * - Implements a Publisher/Subscriber pattern that prevents EventEmitter memory leaks.
 *
 * @memory_leak_prevention
 * - Instead of adding listeners directly to the Node EventEmitter for each SSE client,
 *   this service maintains a Set of client callback functions.
 * - Each SSE connection registers a single callback via `subscribe(callback)`.
 * - When events are emitted (via `emit()`), all subscribed callbacks are also invoked.
 * - On connection close, `unsubscribe(callback)` removes the reference, allowing GC.
 * - This prevents the common "MaxListenersExceededWarning" that occurs when multiple
 *   browser tabs/clients add new listeners on the same EventEmitter for each connection.
 *
 * @boundary_rules
 * - ✅ MAY call other Utility/Infrastructure services.
 * - ❌ MUST NOT call Domain Services (e.g., JobListingService, WorkflowService).
 * - ❌ MUST NOT contain business logic or construct business-specific paths.
 *
 * @socexplanation
 * - This service implements a memory-safe observer pattern for real-time SSE updates.
 * - It decouples event producers from consumers, ensuring the system remains responsive.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

const EventEmitter = require('events');
const { LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class EventService extends EventEmitter {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.logService - The LogService instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ logService }) {
        super();
        this._logService = logService;
        this.clients = new Set();
    }

    subscribe(callback) {
        this.clients.add(callback);
    }

    unsubscribe(callback) {
        this.clients.delete(callback);
    }

    /**
     * Broadcasts an event to all subscribed client callbacks.
     * @param {string} eventName - The name of the event to broadcast.
     * @param {*} data - The data to send with the event.
     *
     * @socexplanation
     * Error logging now includes the errorObj parameter to ensure full stack traces are visible
     * in the terminal when debug_mode is enabled. This enables proper debugging of broadcast failures.
     */
    broadcast(eventName, data) {
        for (const clientCallback of this.clients) {
            try {
                clientCallback(eventName, data);
            } catch (err) {
                this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'EventService', message: `Error broadcasting to client: ${err.message}`, errorObj: err });
            }
        }
    }

    emit(eventName, data) {
        super.emit(eventName, data);
        this.broadcast(eventName, data);
    }
}

module.exports = EventService;
