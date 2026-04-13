/**
 * @module uploadMiddleware
 * @description Middleware for handling file uploads.
 * @responsibility
 * - Configures multer for document and archive uploads.
 * - Ensures required directories exist at startup.
 * @boundary_rules
 * - ✅ Delegates directory creation to FileService.
 * - ❌ MUST NOT use raw `fs` module for directory operations.
 */

const multer = require('multer');
const path = require('path');
const FileService = require('../services/FileService');

const { UPLOADS_DIR, DATA_DIR } = require('../config/constants');

FileService.createDirectory(UPLOADS_DIR);
FileService.createDirectory(DATA_DIR);

// Middleware for Document job applications
const uploadDocument = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOADS_DIR),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const baseName = path.basename(file.originalname, ext);
            const now = new Date();
            const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.');
            const newFileName = `${baseName} (uploaded ${timestamp[0]})${ext}`;
            cb(null, newFileName);
        }
    })
});

module.exports = {
    uploadDocument,
    uploadEntityDocument: uploadDocument
};