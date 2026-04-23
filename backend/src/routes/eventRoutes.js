/**
 * @module EventRoutes
 * @description Express Router for Event endpoints (Server-Sent Events).
 * 
 * @responsibility
 * - Defines HTTP routes for event streaming endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to EventController).
 * - ❌ MUST NOT contain business logic (delegated to Services).
 */

const express = require('express');
const router = express.Router();

const container = require('../config/container').getContainer();
const eventController = container.resolve('eventController');

router.get('/', eventController.streamEvents);

module.exports = router;