const puppeteer = require('puppeteer');
const path = require('path');
const { LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');

/**
 * @module PdfGeneratorService
 * @description Infrastructure Service for generating PDF match reports using Puppeteer.
 *
 * @responsibility
 * - Handles PDF generation by converting HTML pages to PDF documents using Puppeteer.
 * - Robustly manages browser lifecycle (launch, use, close) to prevent memory leaks.
 * - Captures frontend render errors by piping console logs and page errors to LogService.
 * - Delegates file I/O to FileService to ensure strict Separation of Concerns.
 *
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (FileService, LogService).
 * - ❌ MUST NOT call Domain Services.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 *
 * @socexplanation
 * - This service abstracts the Puppeteer browser lifecycle and PDF rendering logic.
 * - It follows the Infrastructure Service pattern, providing technical capabilities to domain services without being aware of domain logic.
 * - It includes robust error-capturing mechanisms to help diagnose frontend rendering failures during PDF generation.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor.
 * Defensive getters are not required as instantiation guarantees dependency presence.
 * Reasoning: Constructor Injection ensures LogService and FileService are available immediately.
 */
class PdfGeneratorService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.logService - The LogService instance for logging
     * @param {Object} deps.fileService - The FileService instance for file I/O
     * @dependency_injection Dependencies are injected strictly via the constructor.
     * Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ logService, fileService }) {
        this._logService = logService;
        this._fileService = fileService;
    }

    /**
     * Launches a new Puppeteer browser instance with security-hardened configuration.
     * @returns {Promise<import('puppeteer').Browser>} The Puppeteer browser instance
     * @throws {Error} If browser launch fails
     */
    async _launchBrowser() {
        return puppeteer.launch({
            headless: 'new',
            args: [
                '--disable-dev-shm-usage'
            ]
        });
    }

    /**
     * Generates a PDF report for a match.
     * @param {string|number} matchId - The ID of the match to generate the report for
     * @returns {Promise<Buffer>} The generated PDF as a buffer
     * @throws {Error} If PDF generation fails
     */
    async generateMatchReport(matchId) {
        let browser = null;
        let page = null;

        try {
            browser = await this._launchBrowser();
            page = await browser.newPage();

            // Harden: Pipe frontend console logs to backend logger to diagnose render failures
            page.on('console', msg => {
                if (msg.type() === 'error' || msg.type() === 'warning') {
                    this._logService.logTerminal({
                        status: LOG_LEVELS.WARN,
                        symbolKey: LOG_SYMBOLS.WARNING,
                        origin: 'Puppeteer/Frontend',
                        message: `[${msg.type()}] ${msg.text()}`
                    });
                }
            });

            page.on('pageerror', err => {
                this._logService.logTerminal({
                    status: LOG_LEVELS.ERROR,
                    symbolKey: LOG_SYMBOLS.ERROR,
                    origin: 'Puppeteer/Frontend',
                    message: `Page Crash: ${err.message}`
                });
            });

            const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/print/match/${matchId}`;

            try {
                await page.goto(frontendUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                await page.waitForSelector('#match-report-content', { visible: true, timeout: 60000 });
            } catch (err) {
                /** * @socexplanation 
                 * Stack trace preservation enforced. errorObj passed explicitly to prevent 
                 * swallowed stack traces during Puppeteer timeout failures.
                 * Using logSystemFault to ensure permanent audit trail in errors.jsonl.
                 */
                this._logService.logSystemFault({
                    origin: 'PdfGeneratorService',
                    message: `Timeout waiting for frontend to render PDF content at ${frontendUrl}`,
                    errorObj: err
                });
                throw new Error(`Failed to render PDF: The frontend at ${frontendUrl} timed out or failed to display the report.`, { cause: err });
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

            const logoPath = path.join(__dirname, '../../../frontend/public/compari.svg');
            let logoBase64 = '';
            if (this._fileService.validatePath(logoPath)) {
                const logoBuffer = await this._fileService.readBuffer(logoPath);
                logoBase64 = `data:image/svg+xml;base64,${logoBuffer.toString('base64')}`;
            }

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate: `
                    <div style="width: 100%; font-size: 10px; color: #666; display: flex; justify-content: space-between; align-items: center; padding: 0 20mm 5mm 20mm; font-family: sans-serif; box-sizing: border-box;">
                        <a href="https://github.com/larjen/Compari" style="display: flex; align-items: center; gap: 8px; text-decoration: none; color: inherit;">
                            ${logoBase64 ? `<img src="${logoBase64}" style="height: 14px; opacity: 0.8;" />` : ''}
                            <span style="opacity: 0.7;">Highly experimental AI matching engine, crafted by AI agents orchestrated by Lars Jensen in 2026.</span>
                        </a>

                        <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
                    </div>
                `,
                margin: {
                    top: '20mm',
                    bottom: '20mm',
                    left: '20mm',
                    right: '20mm'
                }
            });

            return pdfBuffer;
        } finally {
            if (page) {
                await page.close();
            }
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Placeholder for backward compatibility - no-op since we no longer maintain a singleton.
     * @returns {Promise<void>}
     */
    async closeBrowser() {
    }
}

/**
 * @dependency_injection
 * PdfGeneratorService exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * Reasoning: Constructor Injection ensures LogService and FileService are available immediately.
 * Removed hidden fs dependency - delegated to FileService for pure testability and strict Separation of Concerns.
 */
module.exports = PdfGeneratorService;