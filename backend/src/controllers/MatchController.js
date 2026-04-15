/**
 * @module MatchController
 * @description HTTP Controller responsible for handling HTTP requests related to matches.
 * 
 * @responsibility
 * - Extract HTTP parameters and body from incoming requests (req).
 * - Delegate actual data access to Domain Services (MatchService).
 * - Format and return HTTP responses (res) with appropriate status codes and JSON payloads.
 * - Handle error catching by delegating to global error middleware via next(error).
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business rules.
 * - ❌ MUST NOT interact directly with Repositories.
 * - ❌ MUST NOT handle file system operations (path, FileService, MATCH_REPORTS_DIR, TRASHED_DIR).
 * - ✅ All data access MUST go through Services.
 * - ✅ All errors MUST be passed to next(error) for centralized handling.
 * 
 * @socexplanation
 * - Standardizes error handling by delegating ALL errors to the global error middleware.
 * - This ensures consistent error responses and centralized error logging.
 * - File system operations are delegated to MatchService to maintain SoC.
 * - Uses asyncHandler to eliminate try/catch boilerplate.
 */

const matchService = require('../services/MatchService');
const FileService = require('../services/FileService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { handleFileDownload } = require('../utils/fileHandler');

class MatchController {
    /**
     * GET /api/matches
     * Retrieves matches with pagination, search, and status filtering.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getAll = asyncHandler(async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const result = matchService.getPaginatedMatches(page, limit, search, status);
        res.json(result);
    });

    /**
     * GET /api/matches/:id
     * Retrieves a specific match by ID.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const match = matchService.getMatchById(id);
        if (!match) {
            throw new AppError('Match not found', 404);
        }
        res.json({ match });
    });

    /**
     * POST /api/matches
     * Creates a new match and queues an assessment.
     * @param {Object} req - Express request object (req.body.sourceEntityId, req.body.targetEntityId)
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * - Delegates file system operations to MatchService.createMatchWithFolder.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    static create = asyncHandler(async (req, res) => {
        // Frontend sends requirementEntityId/offeringEntityId per the new domain terminology.
        // The underlying service still uses source/target naming internally (createMatchWithFolder).
        const { requirementEntityId, offeringEntityId } = req.body;

        const matchId = matchService.createMatchWithFolder(requirementEntityId, offeringEntityId);

        res.json({ success: true, matchId });
    });

    /**
     * DELETE /api/matches/:id
     * Deletes a match by ID.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * - Delegates file system operations to MatchService.deleteMatchWithFolder.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    static delete = asyncHandler(async (req, res) => {
        const { id } = req.params;

        matchService.deleteMatchWithFolder(id);

        res.json({ success: true });
    });

    /**
     * POST /api/matches/:id/folder/open
     * Opens the match folder in the native OS file manager.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * - Delegates file system logic to MatchService.
     * - Controller purely handles the HTTP transport and response payload.
     */
    static openFolder = asyncHandler(async (req, res) => {
        const { id } = req.params;
        matchService.openMatchFolder(id);
        res.json({ success: true });
    });

    /**
     * GET /api/matches/:id/files
     * Retrieves files in the match folder.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getFiles = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const match = matchService.getMatchById(id);

        if (!match) {
            throw new AppError('Match not found', 404);
        }

        const docs = matchService.getDocumentsForMatch(id);
        const files = docs.map(d => d.file_name);
        res.json({ files });
    });

    /**
     * GET /api/matches/:id/files/:filename
     * Downloads a specific file from the match folder.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     */
    static getFile = asyncHandler(async (req, res) => {
        const { id, filename } = req.params;
        const match = matchService.getMatchById(id);
        return handleFileDownload(res, match, filename, 'folder_path');
    });

    /**
     * POST /api/matches/:id/retry
     * Retries a failed match assessment by re-queuing the task.
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function for error handling
     * 
     * @socexplanation
     * - Delegates retry orchestration to MatchService.retryMatchAssessment.
     * - Controller only handles HTTP transport: parameter extraction and response formatting.
     */
    static retryProcessing = asyncHandler(async (req, res) => {
        const { id } = req.params;
        matchService.retryMatchAssessment(id);
        res.json({ success: true, message: 'Queued for retry' });
    });

    static downloadPdf = asyncHandler(async (req, res) => {
        const matchId = parseInt(req.params.id);
        const match = matchService.getMatchById(matchId);
        
        if (!match) {
            throw new AppError('Match not found', 404);
        }

        const safeReqName = (match.requirement_name || "Requirement").replace(/[/\\?%*:|"<>]/g, '-');
        const safeOffName = (match.offering_name || "Offering").replace(/[/\\?%*:|"<>]/g, '-');
        const pdfFileName = `Match - ${safeReqName} - ${safeOffName}.pdf`;
        
        let pdfBuffer;
        let pdfPath = null;
        const fs = require('fs');
        const path = require('path');

        if (match.folder_path) {
            pdfPath = path.join(match.folder_path, pdfFileName);
            if (fs.existsSync(pdfPath)) {
                pdfBuffer = fs.readFileSync(pdfPath);
            }
        }

        if (!pdfBuffer) {
            const PdfGeneratorService = require('../services/PdfGeneratorService');
            const rawPdfData = await PdfGeneratorService.generateMatchReport(matchId);
            pdfBuffer = Buffer.from(rawPdfData);

            if (match.folder_path) {
                fs.writeFileSync(pdfPath, pdfBuffer);
                const existingDocs = matchService.getDocumentsForMatch(matchId);
                if (!existingDocs.some(d => d.file_name === pdfFileName)) {
                    matchService.registerDocumentRecord(matchId, 'Match Report PDF', pdfFileName, pdfPath);
                }
            }
        }

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${pdfFileName}"`,
            'Content-Length': pdfBuffer.length,
            'Access-Control-Expose-Headers': 'Content-Disposition'
        });
        
        res.end(pdfBuffer);
    });
}

module.exports = MatchController;
