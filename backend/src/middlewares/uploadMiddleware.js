/**
 * @module uploadMiddleware
 * @description Refactored middleware for Multer 2.x.
 * @responsibility Handles secure file uploads directly to UPLOADS_DIR.
 * @reasoning Upgraded from 1.x to 2.x. Replaced deprecated diskStorage callbacks with the native 'dest' property to ensure files are saved to the correct directory and not the pwd.
 */

const multer = require('multer');
const { UPLOADS_DIR } = require('../config/constants');

const uploadDocument = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for safety
});

module.exports = { uploadDocument };