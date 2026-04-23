/**
 * @module DimensionRoutes
 * @description Express Router for Dimension endpoints.
 * @responsibility
 * - Defines HTTP routes for dimension endpoints.
 * - Maps HTTP methods and paths to controller methods.
 */
const express = require('express');
const router = express.Router();

const container = require('../config/container').getContainer();
const dimensionController = container.resolve('dimensionController');
const { validate } = require('../middlewares/validateZod');
const { dimensionSchema } = require('../validators/schemas');

router.get('/active', dimensionController.getActive);

router.get('/', dimensionController.getAll);

router.get('/:id', dimensionController.getById);

router.post('/', validate(dimensionSchema), dimensionController.create);

router.put('/:id', validate(dimensionSchema), dimensionController.update);

router.delete('/:id', dimensionController.delete);

router.patch('/:id/toggle', dimensionController.toggleActive);

module.exports = router;