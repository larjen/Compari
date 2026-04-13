/**
 * @module BlueprintRoutes
 * @description Express Router for Blueprint endpoints.
 * 
 * @responsibility
 * - Defines HTTP routes for blueprint endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * - Applies middleware for validation.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to BlueprintController).
 * - ❌ MUST NOT contain business logic (delegated to Services).
 */

const express = require('express');
const router = express.Router();

const BlueprintController = require('../controllers/BlueprintController');
const { validate } = require('../middlewares/validateZod');
const { blueprintSchema } = require('../validators/schemas');

router.get('/', BlueprintController.getAll);

router.get('/:id', BlueprintController.getById);

router.post('/', validate(blueprintSchema), BlueprintController.create);

router.put('/:id', BlueprintController.update);

router.patch('/:id/set-active', BlueprintController.setActive);

router.delete('/:id', BlueprintController.delete);

module.exports = router;