/**
 * @module uploadMiddleware
 * @description Refactored middleware for Multer 2.x.
 * @responsibility Handles secure file uploads to UPLOADS_DIR.
 * @reasoning Upgraded from 1.x to 2.x to resolve CVE-2026-3304. 
 * Note: Multer 2.x enforces stricter stream handling.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { UPLOADS_DIR } = require('../config/constants');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const randomName = crypto.randomBytes(16).toString('hex');
        cb(null, `${randomName}${ext}`);
    }
});

const uploadDocument = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for safety
});

module.exports = { uploadDocument };