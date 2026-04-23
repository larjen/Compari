/**
 * @module MatchRoutes
 * @description Express Router for Match endpoints.
 * 
 * @responsibility
 * - Defines HTTP routes for match endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to MatchController).
 * - ❌ MUST NOT contain business logic (delegated to Services).
 */

const express = require('express');
const router = express.Router();

const container = require('../config/container').getContainer();
const matchController = container.resolve('matchController');
const { validate } = require('../middlewares/validateZod');
const { matchSchema } = require('../validators/schemas');

router.get('/', matchController.getAll);
router.get('/:id', matchController.getById);
router.post('/', validate(matchSchema), matchController.create);
router.delete('/:id', matchController.delete);
router.post('/:id/folder/open', matchController.openFolder);
router.post('/:id/retry', matchController.retry);
router.get('/:id/files', matchController.getFiles);
router.get('/:id/files/:filename', matchController.getFile);
router.get('/:id/pdf', matchController.downloadPdf);
router.post('/:id/master-file', matchController.writeMasterFile);
router.get('/:id/master-file', matchController.getMasterFile);

module.exports = router;