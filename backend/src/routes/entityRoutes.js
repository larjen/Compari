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

const { entityController } = require('../config/container').getContainer();
const { uploadDocument } = require('../middlewares/uploadMiddleware');
const { validate } = require('../middlewares/validateZod');
const { entitySchema, extractSchema } = require('../validators/schemas');

router.get('/', entityController.getAll);

router.post('/', validate(entitySchema), entityController.create);

router.get('/:id', entityController.getById);

router.put('/:id', entityController.update);

router.delete('/:id', entityController.delete);

router.post('/:id/upload', uploadDocument.single('document'), entityController.uploadFile);

router.post('/:id/upload-multiple', uploadDocument.array('documents'), entityController.uploadFiles);

router.get('/:id/files', entityController.getFiles);

router.get('/:id/files/:filename', entityController.downloadFile);

router.get('/:id/matches', entityController.getMatches);

router.get('/:id/criteria', entityController.getCriteria);

router.post('/:id/extract', validate(extractSchema), entityController.triggerExtraction);

router.delete('/:id/extract', entityController.cancelExtraction);

router.post('/:id/folder/open', entityController.openFolder);

router.get('/:id/top-matches', entityController.getTopMatches);

router.post('/:id/retry', entityController.retryProcessing);

module.exports = router;