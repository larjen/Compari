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

const container = require('../config/container').getContainer();
const criteriaController = container.resolve('criteriaController');

router.get('/', criteriaController.getAll);
router.get('/:id', criteriaController.getById);

router.get('/:id/associations', criteriaController.getAssociations);

router.delete('/:id', criteriaController.delete);

router.get('/:id/similar', criteriaController.getSimilar);
router.post('/:id/merge', criteriaController.merge);
router.get('/:id/history', criteriaController.getHistory);
router.post('/:id/master-file', criteriaController.writeMasterFile);
router.get('/:id/master-file', criteriaController.getMasterFile);

router.get('/:id/files', criteriaController.getFiles);
router.get('/:id/files/:filename', criteriaController.getFile);
router.post('/:id/folder/open', criteriaController.openFolder);

module.exports = router;