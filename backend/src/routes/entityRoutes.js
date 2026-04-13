/**
 * @module EntityRoutes
 * @description Express Router for generic Entity endpoints.
 * 
 * @responsibility
 * - Defines HTTP routes for entity endpoints.
 * - Maps HTTP methods and paths to controller methods.
 * - Applies middleware (e.g., upload middleware).
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain request handler logic (delegated to EntityController).
 * - ❌ MUST NOT contain business logic (delegated to Services).
 */

const express = require('express');
const router = express.Router();

const EntityController = require('../controllers/EntityController');
const { uploadEntityDocument } = require('../middlewares/uploadMiddleware');
const { validate } = require('../middlewares/validateZod');
const { entitySchema, extractSchema } = require('../validators/schemas');

router.get('/', EntityController.getAll);

router.post('/', validate(entitySchema), EntityController.create);

router.get('/:id', EntityController.getById);

router.put('/:id', EntityController.update);

router.delete('/:id', EntityController.delete);

router.post('/:id/upload', uploadEntityDocument.single('document'), EntityController.uploadFile);

router.post('/:id/upload-multiple', uploadEntityDocument.array('documents'), EntityController.uploadFiles);

router.get('/:id/files', EntityController.getFiles);

router.get('/:id/files/:filename', EntityController.downloadFile);

router.get('/:id/matches', EntityController.getMatches);

router.get('/:id/criteria', EntityController.getCriteria);

router.post('/:id/extract', validate(extractSchema), EntityController.triggerExtraction);

router.delete('/:id/extract', EntityController.cancelExtraction);

router.post('/:id/folder/open', EntityController.openFolder);

router.get('/:id/top-matches', EntityController.getTopMatches);

router.post('/:id/retry', EntityController.retryProcessing);

module.exports = router;
