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

const AiModelController = require('../controllers/AiModelController');
const { validate } = require('../middlewares/validateZod');
const { aiModelSchema } = require('../validators/schemas');

router.get('/', AiModelController.getAll);
router.get('/active', AiModelController.getActive);
router.get('/active/all', AiModelController.getAllActive);
router.get('/:id', AiModelController.getById);
router.post('/', validate(aiModelSchema), AiModelController.create);
router.put('/:id', validate(aiModelSchema), AiModelController.update);
router.delete('/:id', AiModelController.delete);
router.post('/:id/set-active', AiModelController.setActive);

module.exports = router;