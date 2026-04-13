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
 */

const EventEmitter = require('events');
const logService = require('./LogService');

class EventService extends EventEmitter {
    constructor() {
        super();
        this.clients = new Set();
    }

    subscribe(callback) {
        this.clients.add(callback);
    }

    unsubscribe(callback) {
        this.clients.delete(callback);
    }

    broadcast(eventName, data) {
        for (const clientCallback of this.clients) {
            try {
                clientCallback(eventName, data);
            } catch (err) {
                logService.logTerminal('ERROR', 'ERROR', 'EventService', `Error broadcasting to client: ${err.message}`);
            }
        }
    }

    emit(eventName, data) {
        super.emit(eventName, data);
        this.broadcast(eventName, data);
    }
}

module.exports = new EventService();
