/**
 * @module PdfService
 * @description Service for PDF text extraction and parsing.
 * 
 * @responsibility
 * - Extracts text content from PDF files using pdf-parse.
 * - Provides page-by-page rendering with proper formatting.
 * - Handles various PDF encodings and layouts.
 * 
 * @soc_explanation
 * This service isolates PDF-specific parsing logic, keeping FileService
 * generic and focused on standard disk I/O operations.
 * 
 * @boundary_rules
 * - ✅ MAY be called by any service that needs PDF text extraction.
 * - ❌ MUST NOT handle HTTP request/response objects.
 * - ❌ MUST NOT call other domain services.
 * - ❌ MUST NOT handle file system operations beyond reading PDF buffers.
 * - ❌ MUST NOT contain business logic or path generation.
 */

const fs = require('fs');
const pdf = require('pdf-parse');
const logService = require('./LogService');

/**
 * Renders a PDF page with proper text formatting.
 * Adds page markers for better readability of extracted content.
 * 
 * @async
 * @method _renderPage
 * @param {Object} pageData - The pdf-parse page data object.
 * @returns {Promise<string>} Formatted text content of the page.
 * 
 * @formatting_rules
 * - Adds page start/end markers for reference.
 * - Inserts newlines between text blocks with different Y positions.
 * - Preserves reading order within each page.
 */
async function _renderPage(pageData) {
    const textContent = await pageData.getTextContent();
    let lastY, text = `\n--- [PAGE ${pageData.pageIndex + 1} START] ---\n`;
    
    for (let item of textContent.items) {
        if (lastY !== undefined && Math.abs(lastY - item.transform) > 2) {
            text += '\n';
        }
        text += item.str;
        lastY = item.transform;
    }
    
    return text + `\n--- [PAGE ${pageData.pageIndex + 1} END] ---\n`;
}

/**
 * Extracts text content from a PDF file.
 * Uses the custom page renderer for consistent formatting.
 * 
 * @async
 * @method extractTextFromPDF
 * @param {string} filePath - The path to the PDF file.
 * @returns {Promise<string>} Extracted text content from all pages.
 * 
 * @error_handling
 * - Returns empty string if file cannot be read or parsed.
 * - Logs errors to console for debugging.
 */
async function extractTextFromPDF(filePath) {
    const fs = require('fs');
    
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer, { pagerender: _renderPage });
        return data.text;
    } catch (error) {
        logService.logTerminal('ERROR', 'ERROR', 'PdfService', `Failed to extract text from PDF: ${error.message}`);
        logService.logErrorFile('PdfService', 'Failed to extract text from PDF', error, { filePath });
        return '';
    }
}

module.exports = {
    extractTextFromPDF,
    _renderPage
};