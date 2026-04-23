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

const container = require('../config/container').getContainer();
const blueprintController = container.resolve('blueprintController');
const { validate } = require('../middlewares/validateZod');
const { blueprintSchema } = require('../validators/schemas');

router.get('/', blueprintController.getAll);

router.get('/:id', blueprintController.getById);

router.post('/', validate(blueprintSchema), blueprintController.create);

router.put('/:id', validate(blueprintSchema), blueprintController.update);

router.patch('/:id/set-active', blueprintController.setActive);

router.delete('/:id', blueprintController.delete);

module.exports = router;