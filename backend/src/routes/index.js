/**
 * @module routes/index
 * @description Route Orchestrator - Single entry point for all HTTP traffic.
 * This module centralizes all route mounting logic to enforce DRY principles
 * and prevent duplicated route paths across the application.
 * 
 * @responsibility
 * - Mounts all domain-specific API routes under /api/* prefix
 * - Provides 404 handler for unmatched routes
 * 
 * @boundary_rules
 * - MUST NOT contain business logic or service implementations
 * - MUST NOT interact with database or file system
 */

const entityRoutes = require('./entityRoutes');
const settingRoutes = require('./settingRoutes');
const eventRoutes = require('./eventRoutes');
const queueRoutes = require('./queueRoutes');
const criteriaRoutes = require('./criteriaRoutes');
const matchRoutes = require('./matchRoutes');
const aiModelRoutes = require('./aiModelRoutes');
const blueprintRoutes = require('./blueprintRoutes');
const dimensionRoutes = require('./dimensionRoutes');

/**
 * Sets up all API routes on the Express application.
 * This function is the single entry point for mounting all HTTP traffic.
 * 
 * @param {Object} app - Express application instance
 * @returns {void}
 */
function setupRoutes(app) {
    app.use('/api/entities', entityRoutes);
    app.use('/api/settings', settingRoutes);
    app.use('/api/events', eventRoutes);
    app.use('/api/queue', queueRoutes);
    app.use('/api/criteria', criteriaRoutes);
    app.use('/api/matches', matchRoutes);
    app.use('/api/ai-models', aiModelRoutes);
    app.use('/api/blueprints', blueprintRoutes);
    app.use('/api/dimensions', dimensionRoutes);
}

module.exports = setupRoutes;
