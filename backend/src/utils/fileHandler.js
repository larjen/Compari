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
 * @dependency_injection
 * Enforces constructor injection per ARCHITECTURE.md Section 2.
 * fileService must be passed as a parameter from the caller.
 * 
 * @deps
 * - Relies on centralized HTTP_HEADERS and MIME_TYPES constants from config/constants.js
 */

const path = require('path');
const AppError = require('./AppError');
const { HTTP_HEADERS, MIME_TYPES, HTTP_STATUS } = require('../config/constants');

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

/**
 * Handles file download by streaming a file from the fileService to the HTTP response.
 * * @param {Object} dto - Data Transfer Object containing all required parameters
 * @param {Object} dto.fileService - The file service instance for file operations
 * @param {Object} dto.res - Express response object
 * @param {Object} dto.entity - The entity object containing the folder path
 * @param {string} dto.fileName - The name of the file to download
 * @param {string} [dto.folderPathKey='folderPath'] - The key to retrieve folder path from entity
 * @throws {AppError} If folder or file is not found
 */
async function handleFileDownload({ fileService, res, entity, fileName, folderPathKey = 'folderPath' }) {
    const folderPath = entity[folderPathKey];

    if (!entity || !folderPath) {
        throw new AppError('Folder not found.', HTTP_STATUS.NOT_FOUND);
    }

    const buffer = await fileService.getFileBuffer(folderPath, fileName);
    if (!buffer) {
        throw new AppError('File not found on disk.', HTTP_STATUS.NOT_FOUND);
    }

    const ext = path.extname(fileName).toLowerCase();
    const contentType = mimeTypeMap[ext] || MIME_TYPES.OCTET_STREAM;

    res.set(HTTP_HEADERS.CONTENT_TYPE, contentType);
    res.set(HTTP_HEADERS.CONTENT_DISPOSITION, 'inline');
    res.send(buffer);
}

module.exports = { handleFileDownload };