/**
 * @module AiModelRoutes
 * @description Express Router for AI Model endpoints.
 * 
 * @responsibility
 * - Defines HTTP routes for AI model endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to AiModelController).
 * - ❌ MUST NOT contain business logic (delegated to Repositories).
 */

const express = require('express');
const router = express.Router();

const { aiModelController } = require('../config/container').getContainer();
const { validate } = require('../middlewares/validateZod');
const { aiModelSchema } = require('../validators/schemas');

router.get('/', aiModelController.getAll);
router.get('/active', aiModelController.getActive);
router.get('/active/all', aiModelController.getAllActive);
router.post('/test', aiModelController.testConnection);
router.get('/:id', aiModelController.getById);
router.post('/', validate(aiModelSchema), aiModelController.create);
router.put('/:id', validate(aiModelSchema), aiModelController.update);
router.delete('/:id', aiModelController.delete);
router.post('/:id/set-active', aiModelController.setActive);

module.exports = router;