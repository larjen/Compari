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

const MatchController = require('../controllers/MatchController');
const { validate } = require('../middlewares/validateZod');
const { matchSchema } = require('../validators/schemas');

router.get('/', MatchController.getAll);
router.get('/:id', MatchController.getById);
router.post('/', validate(matchSchema), MatchController.create);
router.delete('/:id', MatchController.delete);
router.post('/:id/folder/open', MatchController.openFolder);
router.get('/:id/files', MatchController.getFiles);
router.get('/:id/files/:filename', MatchController.getFile);
router.get('/:id/pdf', MatchController.downloadPdf);

module.exports = router;