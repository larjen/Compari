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

const { matchController } = require('../config/container').getContainer();
const { validate } = require('../middlewares/validateZod');
const { matchSchema } = require('../validators/schemas');

router.get('/', matchController.getAll);
router.get('/:id', matchController.getById);
router.post('/', validate(matchSchema), matchController.create);
router.delete('/:id', matchController.delete);
router.post('/:id/folder/open', matchController.openFolder);
router.post('/:id/retry', matchController.retryProcessing);
router.get('/:id/files', matchController.getFiles);
router.get('/:id/files/:filename', matchController.getFile);
router.get('/:id/pdf', matchController.downloadPdf);

module.exports = router;