/**
 * @module DimensionRoutes
 * @description Express Router for Dimension endpoints.
 * @responsibility
 * - Defines HTTP routes for dimension endpoints.
 * - Maps HTTP methods and paths to controller methods.
 */
const express = require('express');
const router = express.Router();

const DimensionController = require('../controllers/DimensionController');
const { validate } = require('../middlewares/validateZod');
const { dimensionSchema } = require('../validators/schemas');

router.get('/active', DimensionController.getActive);

router.get('/', DimensionController.getAll);

router.get('/:id', DimensionController.getById);

router.post('/', validate(dimensionSchema), DimensionController.create);

router.put('/:id', DimensionController.update);

router.delete('/:id', DimensionController.delete);

router.patch('/:id/toggle', DimensionController.toggleActive);

module.exports = router;