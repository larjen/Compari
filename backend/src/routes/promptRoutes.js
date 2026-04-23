/**
 * @module PromptRoutes
 * @description Express Router for AI Prompts endpoints.
 * 
 * @responsibility
 * - Defines HTTP routes for prompts endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to PromptController).
 * - ❌ MUST NOT contain business logic (delegated to Repository).
 */

const express = require('express');
const router = express.Router();

const container = require('../config/container').getContainer();
const promptController = container.resolve('promptController');

router.get('/', promptController.getAll);

router.put('/:id', promptController.updatePrompt);

module.exports = router;