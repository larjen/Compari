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
 * Delegated file I/O to FileService to ensure pure testability and strict Separation of Concerns.
 *
 * @boundary_rules
 * - ✅ Uses Constructor Injection for LogService and FileService.
 * - ❌ MUST NOT handle HTTP request/response objects.
 * - ❌ MUST NOT call other domain services.
 * - ❌ MUST NOT handle file system operations beyond reading PDF buffers via FileService.
 * - ❌ MUST NOT contain business logic or path generation.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor.
 * Defensive getters are not required as instantiation guarantees dependency presence.
 * Reasoning: Constructor Injection ensures LogService and FileService are available immediately.
 * Removed hidden fs dependency - delegated to FileService for pure testability.
 */

const pdf = require('pdf-parse');
const { LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

class PdfService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.logService - The LogService instance for logging
     * @dependency_injection Dependencies are injected strictly via the constructor.
     * Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ logService }) {
        this._logService = logService;
    }

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
    async _renderPage(pageData) {
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
     * Extracts text content from a PDF buffer.
     * Uses the custom page renderer for consistent formatting.
     *
     * @async
     * @method extractTextFromPDF
     * @param {Buffer} dataBuffer - The PDF buffer to parse.
     * @returns {Promise<string>} Extracted text content from all pages.
     *
     * @error_handling
     * - Returns empty string if buffer cannot be parsed.
     * - Logs errors to console for debugging.
     */
    async extractTextFromPDF(dataBuffer) {
        try {
            if (!dataBuffer) {
                if (this._logService) {
                    this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'PdfService', message: 'Failed to extract text from PDF: no buffer provided' });
                }
                return '';
            }
            
            // Handle v2 (Class API)
            if (pdf && pdf.PDFParse) {
                const parser = new pdf.PDFParse({ data: dataBuffer });
                // Pass pagerender into getText's ParseParameters
                const result = await parser.getText({ pagerender: this._renderPage.bind(this) });
                await parser.destroy(); // Mandatory in v2 to prevent memory leaks
                return result.text;
            } 
            // Handle v1 (Function API fallback)
            else if (typeof pdf === 'function' || typeof (pdf.default || pdf) === 'function') {
                const legacyPdf = pdf.default || pdf;
                const data = await legacyPdf(dataBuffer, { pagerender: this._renderPage.bind(this) });
                return data.text;
            } 
            // Fallback for unknown export structures
            else {
                throw new Error('Unrecognized pdf-parse export structure. Cannot parse PDF.');
            }
        } catch (error) {
            if (this._logService) {
                this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'PdfService', message: `Failed to extract text from PDF: ${error.message}` });
                this._logService.logErrorFile({ origin: 'PdfService', message: 'Failed to extract text from PDF', errorObj: error });
            }
            return '';
        }
    }
}

/**
 * @dependency_injection
 * PdfService exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * Reasoning: Constructor Injection ensures LogService is available immediately.
 */
module.exports = PdfService;