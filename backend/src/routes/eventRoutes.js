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

const EventController = require('../controllers/EventController');

router.get('/', EventController.streamEvents);

module.exports = router;