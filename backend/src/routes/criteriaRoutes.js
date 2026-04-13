/**
 * @module CriteriaRoutes
 * @description Express Router for Criteria endpoints.
 * 
 * @responsibility
 * - Defines HTTP routes for criteria endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to CriteriaController).
 * - ❌ MUST NOT contain business logic (delegated to Repositories).
 */

const express = require('express');
const router = express.Router();

const CriteriaController = require('../controllers/CriteriaController');

router.get('/', CriteriaController.getAll);

router.get('/:id/associations', CriteriaController.getAssociations);

router.delete('/:id', CriteriaController.delete);

router.get('/:id/similar', CriteriaController.getSimilar);
router.post('/:id/merge', CriteriaController.merge);
router.get('/:id/history', CriteriaController.getHistory);

module.exports = router;
