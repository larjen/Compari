/**
 * @module fileHandler
 * @description Utility function that centralizes Express HTTP file-streaming logic.
 * 
 * @responsibility
 * - Encapsulates common file download patterns used across controllers.
 * - Handles entity validation, file buffer retrieval, and HTTP response formatting.
 * - Eliminates code duplication in controllers for file downloads.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business logic.
 * - ❌ MUST NOT interact with Services directly; expects entities and buffers as input.
 * - ✅ Operates purely at the HTTP transport layer.
 * 
 * @deps
 * - Relies on centralized HTTP_HEADERS and MIME_TYPES constants from config/constants.js
 */

const path = require('path');
const fileService = require('../services/FileService');
const { HTTP_HEADERS, MIME_TYPES } = require('../config/constants');

const mimeTypeMap = {
    '.pdf': MIME_TYPES.PDF,
    '.txt': MIME_TYPES.TXT,
    '.md': MIME_TYPES.MD,
    '.png': MIME_TYPES.PNG,
    '.jpg': MIME_TYPES.JPG,
    '.jpeg': MIME_TYPES.JPEG,
    '.json': MIME_TYPES.JSON,
    '.jsonl': MIME_TYPES.JSONL
};

function handleFileDownload(res, entity, fileName, folderPathKey = 'folderPath') {
    const folderPath = entity[folderPathKey];

    if (!entity || !folderPath) {
        return res.status(404).json({ error: 'Folder not found.' });
    }

    const buffer = fileService.getFileBuffer(folderPath, fileName);
    if (!buffer) {
        return res.status(404).json({ error: 'File not found on disk.' });
    }

    const ext = path.extname(fileName).toLowerCase();
    const contentType = mimeTypeMap[ext] || MIME_TYPES.OCTET_STREAM;

    res.set(HTTP_HEADERS.CONTENT_TYPE, contentType);
    res.set(HTTP_HEADERS.CONTENT_DISPOSITION, 'inline');
    res.send(buffer);
}

module.exports = { handleFileDownload };