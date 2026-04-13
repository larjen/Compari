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
 */

const path = require('path');
const fileService = require('../services/FileService');

const mimeTypes = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.json': 'application/json',
    '.jsonl': 'application/json'

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
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.set('Content-Type', contentType);
    res.set('Content-Disposition', 'inline');
    res.send(buffer);
}

module.exports = { handleFileDownload };