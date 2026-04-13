/**
 * @module QueueRoutes
 * @description Express Router for Queue endpoints.
 * 
 * @responsibility
 * - Defines HTTP routes for queue status endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to QueueController).
 * - ❌ MUST NOT contain business logic (delegated to Services).
 */

const express = require('express');
const router = express.Router();

const QueueController = require('../controllers/QueueController');

router.get('/status', QueueController.getQueueStatus);

module.exports = router;