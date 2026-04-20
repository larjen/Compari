/**
 * @module EventController
 * @description HTTP Controller responsible for handling HTTP requests related to Server-Sent Events (SSE).
 *
 * @responsibility
 * - Establish SSE connection with client.
 * - Subscribe to EventService events and forward them to the client.
 * - Handle keep-alive heartbeats.
 * - Clean up resources on connection close.
 * - Format and return SSE responses.
 *
 * @boundary_rules
 * - ❌ MUST NOT contain business logic for events.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ✅ All event data MUST come from EventService.
 * - ✅ SSE formatting and connection management is the sole responsibility of this controller.
 *
 * @dependency_injection
 * Services are injected via the constructor using Constructor Injection pattern.
 * This replaces the previous static/service-locator anti-pattern.
 */

class EventController {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.eventService - The EventService instance
     */
    constructor({ eventService }) {
        this._eventService = eventService;
    }

    /**
     * @description Establishes an SSE connection with the client, subscribes to EventService events,
     * and forwards them to the client with strict JSON serialization guarantees.
     * Arrow function to preserve lexical `this` binding when invoked by Express.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    streamEvents = (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        /**
         * @description Sends an SSE event to the client with strict JSON serialization.
         * Enforces Separation of Concerns: the transport layer guarantees protocol compliance
         * regardless of what the business logic provides.
         * @param {string} eventName - The SSE event type
         * @param {any} data - The payload data to serialize
         */
        const sendEvent = (eventName, data) => {
            const safeData = data !== undefined ? data : { timestamp: Date.now() };
            res.write(`event: ${eventName}\n`);
            res.write(`data: ${JSON.stringify(safeData)}\n\n`);
        };

        const clientCallback = (eventName, data) => {
            sendEvent(eventName, data);
        };

        this._eventService.subscribe(clientCallback);

        const keepAlive = setInterval(() => {
            res.write(':\n\n');
        }, 15000);

        req.on('close', () => {
            clearInterval(keepAlive);
            this._eventService.unsubscribe(clientCallback);
            res.end();
        });
    }
}

module.exports = EventController;