/**
 * @module FileService
 * @description Infrastructure Service for File System operations.
 *
 * @responsibility
 * - Performs raw file I/O: reading, writing, moving, and directory creation.
 * - Provides generic JSON file read/write operations.
 * - Extracts raw text streams from PDF buffers.
 * - Initializes all application directories at startup.
 * - Opens folders in the native OS file manager.
 * - Generates standardized folder paths for job applications.
 *
 * @boundary_rules
 * - ✅ Uses Constructor Injection for PdfService and LogService.
 * - ❌ MUST NOT call Domain Services (e.g., JobService, WorkflowService).
 * - ❌ MUST NOT contain business logic or construct business-specific paths.
 * - ❌ MUST NOT know about application-specific settings or configurations.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor.
 * Defensive getters are not required as instantiation guarantees dependency presence.
 * Reasoning: Constructor Injection ensures PdfService and LogService are available immediately.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const {
    OFFERINGS_DIR,
    TRASHED_DIR,
    DB_DIR,
    LOGS_DIR,
    UPLOADS_DIR,
    DATA_DIR,
    REQUIREMENTS_DIR,
    MATCH_REPORTS_DIR,
    CRITERIA_DIR,
    AI_CACHE_DIR,
    LOG_LEVELS,
    LOG_SYMBOLS
} = require('../config/constants');

class FileService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.pdfService - The PdfService instance for PDF text extraction
     * @param {Object} deps.logService - The LogService instance for logging
     * @dependency_injection Dependencies are injected strictly via the constructor.
     * Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ pdfService, logService }) {
        this._pdfService = pdfService;
        this._logService = logService;
    }

    /**
     * @private
     * Ensures the directory for a target path exists, creating it if necessary.
     * Centralizes directory creation logic to reduce repetitive boilerplate.
     * @param {string} targetPath - The file or directory path to ensure.
     * @param {boolean} isFile - If true, extracts the parent directory from the targetPath.
     */
    _ensureDir(targetPath, isFile = false) {
        const dir = isFile ? path.dirname(targetPath) : targetPath;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Safely checks if a path exists.
     * Centralizes path validation logic to reduce repetitive boilerplate.
     * @param {string} targetPath - The path to check.
     * @returns {boolean} True if the path exists, false otherwise.
     */
    validatePath(targetPath) {
        return targetPath && fs.existsSync(targetPath);
    }

    /**
     * @socexplanation
     * Ensures the new directory structure (Offerings/Requirements) is created
     * automatically if it doesn't exist on the host system.
     */
    initializeWorkspace() {
        const directories = [
            OFFERINGS_DIR,
            REQUIREMENTS_DIR,
            TRASHED_DIR,
            DB_DIR,
            LOGS_DIR,
            UPLOADS_DIR,
            DATA_DIR,
            MATCH_REPORTS_DIR,
            AI_CACHE_DIR
        ];
        for (const dir of directories) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    /**
     * Recursively deletes the entire workspace data directory.
     * Used for development to ensure a clean state.
     * @method wipeWorkspace
     */
    wipeWorkspace() {
        if (fs.existsSync(DATA_DIR)) {
            console.log(`[FileService] Wiping data directory: ${DATA_DIR}`);
            fs.rmSync(DATA_DIR, { recursive: true, force: true });
        }
    }

    async extractTextFromPDF(filePath) {
        const dataBuffer = this.readBuffer(filePath);
        if (!dataBuffer) {
            return '';
        }
        return await this._pdfService.extractTextFromPDF(dataBuffer);
    }

    async extractTextFromFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            return await this.extractTextFromPDF(filePath);
        }
        return fs.readFileSync(filePath, 'utf8');
    }

    listFilesInFolder(folderPath) {
        if (!this.validatePath(folderPath)) return [];
        return fs.readdirSync(folderPath);
    }

    /**
     * Validates and returns the full file path if the file exists within the specified folder.
     * This method mitigates Directory Traversal (Path Traversal) attacks by ensuring
     * the resolved file path remains strictly within the intended directory boundary.
     * @param {string} folderPath - The base folder path.
     * @param {string} fileName - The file name to validate.
     * @returns {string|null} The full resolved file path if valid and exists, or null otherwise.
     */
    getValidatedFilePath(folderPath, fileName) {
        if (!folderPath || !fileName) return null;
        const resolvedFolder = path.resolve(folderPath);
        const targetPath = path.join(folderPath, fileName);
        const resolvedTargetPath = path.resolve(targetPath);
        if (!resolvedTargetPath.startsWith(resolvedFolder)) {
            return null;
        }
        return fs.existsSync(resolvedTargetPath) ? resolvedTargetPath : null;
    }

    /**
     * Retrieves a file as a buffer for HTTP responses.
     * This abstracts file retrieval to allow easy swapping to cloud storage later.
     * @param {string} folderPath - The folder path where the file is located.
     * @param {string} fileName - The name of the file to retrieve.
     * @returns {Buffer|null} The file buffer if found, or null if not found.
     */
    getFileBuffer(folderPath, fileName) {
        const targetPath = this.getValidatedFilePath(folderPath, fileName);
        if (!targetPath) return null;
        return fs.readFileSync(targetPath);
    }

    createDirectory(folderPath) {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
    }

    moveFile(oldPath, newDirectory, newFileName) {
        if (!fs.existsSync(oldPath)) return null;
        const finalDest = path.join(newDirectory, newFileName);
        fs.renameSync(oldPath, finalDest);
        return finalDest;
    }

    readTextFile(filePath) {
        if (!this.validatePath(filePath)) return '';
        return fs.readFileSync(filePath, 'utf8');
    }

    /**
     * Saves text content to a file in the specified folder.
     * @param {string} folderPath - The folder path where the file will be saved.
     * @param {string} fileName - The name of the file to save.
     * @param {string} content - The text content to write to the file.
     * @returns {string} The full path to the saved file.
     */
    saveTextFile(folderPath, fileName, content) {
        this._ensureDir(folderPath);
        const filePath = path.join(folderPath, fileName);
        fs.writeFileSync(filePath, content);
        return filePath;
    }

    moveDirectory(sourcePath, targetPath) {
        if (!this.validatePath(sourcePath)) return;
        this._ensureDir(targetPath);
        fs.renameSync(sourcePath, targetPath);
    }

    appendToFile(folderPath, fileName, content) {
        if (!folderPath || !fileName) return;
        this._ensureDir(folderPath);
        const filePath = path.join(folderPath, fileName);
        fs.appendFileSync(filePath, content);
    }

    /**
     * Saves a buffer to a file in the specified folder.
     * @param {string} filePath - The full path to the file.
     * @param {Buffer} buffer - The buffer to write.
     */
    saveBuffer(filePath, buffer) {
        this._ensureDir(filePath, true);
        fs.writeFileSync(filePath, buffer);
    }

    /**
     * Reads a file and returns the buffer.
     * @param {string} filePath - The full path to the file.
     * @returns {Buffer|null} The file buffer if found, or null if not found.
     */
    readBuffer(filePath) {
        if (!this.validatePath(filePath)) return null;
        return fs.readFileSync(filePath);
    }

    readJsonFile(filePath) {
        if (!this.validatePath(filePath)) return null;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * Reads a JSONL (JSON Lines) file and parses each line as a separate JSON object.
     * @param {string} filePath - The path to the JSONL file.
     * @returns {Array<Object>|null} An array of parsed JSON objects, or null if the file cannot be read.
     *
     * @description This is the required partner method for reading structured logs,
     * enforcing the JSONL protocol across the Infrastructure layer. Each line in the
     * file is treated as a separate JSON object.
     *
     * @socexplanation
     * This method provides the read counterpart to the JSONL writing performed by LogService.
     * It splits the file by newlines, filters empty lines, and parses each line individually,
     * ensuring the JSONL protocol is properly enforced in the Infrastructure layer.
     */
    readJsonlFile(filePath) {
        if (!this.validatePath(filePath)) return null;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const results = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) {
                    try {
                        results.push(JSON.parse(trimmed));
                    } catch (parseError) {
                        this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'FileService', message: `Failed to parse JSONL line: ${parseError.message}` });
                    }
                }
            }
            return results;
        } catch (error) {
            return null;
        }
    }

    writeJsonFile(filePath, data) {
        if (!filePath) return;
        this._ensureDir(filePath, true);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
    }

    /**
     * Opens the specified folder in the native OS file manager.
     * Uses platform-specific commands: explorer (Windows), open (macOS), xdg-open (Linux).
     * @param {string} folderPath - The path to the folder to open.
     */
    openFolderInOS(folderPath) {
        if (!folderPath || !fs.existsSync(folderPath)) {
            this._logService.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'FileService', message: `Cannot open folder: path does not exist: ${folderPath}` });
            return;
        }

        const platform = os.platform();

        if (platform === 'win32') {
            exec(`explorer "${folderPath}"`, (error) => {
                if (error) this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'FileService', message: `Failed to open folder on Windows: ${error.message}` });
            });
        } else if (platform === 'darwin') {
            exec(`open "${folderPath}"`, (error) => {
                if (error) this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'FileService', message: `Failed to open folder on macOS: ${error.message}` });
            });
        } else if (platform === 'linux') {
            exec(`xdg-open "${folderPath}"`, (error) => {
                if (error) this._logService.logTerminal({ status: LOG_LEVELS.ERROR, symbolKey: LOG_SYMBOLS.ERROR, origin: 'FileService', message: `Failed to open folder on Linux: ${error.message}` });
            });
        }
    }

    /**
     * Generates a vault folder path for any base entity type.
     * Creates a standardized path using the entity type and display lines with a safe local timestamp.
     *
     * @method generateVaultPath
     * @memberof FileService
     * @param {string} entityType - The entity type ('requirement', 'offering', 'match', 'criterion').
     * @param {string} line1 - Primary display name (niceNameLine1).
     * @param {string} line2 - Secondary display name (niceNameLine2).
     * @returns {string} The full filesystem path for the entity vault folder.
     *
     * @socexplanation
     * - Formats timestamp as YYYY-MM-DD HH-mm-ss using local time.
     * - Avoids toISOString() (which forces UTC) and toLocaleString() (which risks OS-level invalid file path characters).
     */
    generateVaultPath(entityType, line1, line2) {
        // Safely extract local time components to guarantee OS file path compatibility
        const date = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
        
        const safeLine1 = (line1 || "Unknown").replace(/[\/\\:*?"<>|]/g, '-').trim();
        const safeLine2 = (line2 || "Unknown").replace(/[\/\\:*?"<>|]/g, '-').trim();
        
        let baseDir;
        switch (entityType) {
            case 'requirement': baseDir = REQUIREMENTS_DIR; break;
            case 'offering': baseDir = OFFERINGS_DIR; break;
            case 'match': baseDir = MATCH_REPORTS_DIR; break;
            case 'criterion': baseDir = CRITERIA_DIR; break;
            default: baseDir = OFFERINGS_DIR;
        }

        const folderName = entityType === 'match' 
            ? `Match - ${safeLine1} - ${safeLine2} - ${timestamp}` 
            : `${safeLine1} - ${safeLine2} - ${timestamp}`;

        return path.join(baseDir, folderName);
    }

    /**
     * Generates a folder path for an entity.
     * Creates a standardized path using the entity type, name sanitized, and timestamp.
     *
     * @method generateEntityFolderPath
     * @memberof FileService
     * @param {string} type - The entity type ('requirement' or 'offering').
     * @param {string} name - The entity name.
     * @returns {string} The full filesystem path for the entity folder.
     * @deprecated Use generateVaultPath instead.
     */
    generateEntityFolderPath(type, name) {
        return this.generateVaultPath(type, name);
    }

    /**
     * Generates a folder path for match reports.
     * Creates a standardized path using match ID and timestamp.
     *
     * @method generateMatchFolderPath
     * @memberof FileService
     * @param {number} sourceEntityId - The source entity ID.
     * @param {number} targetEntityId - The target entity ID.
     * @returns {string} The full filesystem path for the match folder.
     * @deprecated Use generateVaultPath instead.
     */
    generateMatchFolderPath(sourceEntityId, targetEntityId) {
        return this.generateVaultPath('match', `${sourceEntityId}_${targetEntityId}`);
    }

    /**
     * Prepares a staging directory inside UPLOADS_DIR and optionally moves a file into it.
     * This enforces the staging architecture by quarantining all unprocessed artifacts.
     *
     * @method prepareStagingDirectory
     * @memberof FileService
     * @param {string|number} identifier - The entity identifier (name or ID) for folder naming.
     * @param {Object|null} file - Optional uploaded file object with path and filename properties.
     * @returns {string} The path to the prepared staging directory.
     *
     * @responsibility
     * - Forces all unprocessed artifacts into a quarantine/staging area (UPLOADS_DIR).
     * - Keeps documents isolated from the permanent vault until finalization.
     *
     * @boundary_rules
     * - ✅ Uses UPLOADS_DIR as the strict base for all staging folders.
     * - ❌ MUST NOT place files directly into vault directories.
     *
     * @socexplanation
     * - CTI: Unified staging directory method for all entity types.
     * - Replaces separate prepareEntityDirectory and prepareMatchStagingDirectory methods.
     */
    prepareStagingDirectory(identifier, file = null) {
        const safeIdentifier = String(identifier).replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
        const stagingFolderName = `staging-${Date.now()}-${safeIdentifier}`;
        const stagingFolderPath = path.join(UPLOADS_DIR, stagingFolderName);

        this.createDirectory(stagingFolderPath);

        if (file) {
            const safeFileName = require('path').basename(file.originalname);
            this.moveFile(file.path, stagingFolderPath, safeFileName);
        }

        return stagingFolderPath;
    }

    /**
     * Prepares a staging directory for a match inside UPLOADS_DIR.
     * @method prepareMatchStagingDirectory
     * @memberof FileService
     * @param {number} sourceEntityId - The source entity ID.
     * @param {number} targetEntityId - The target entity ID.
     * @returns {string} The path to the prepared staging directory.
     * @deprecated Use prepareStagingDirectory instead.
     */
    prepareMatchStagingDirectory(sourceEntityId, targetEntityId) {
        return this.prepareStagingDirectory(`match-${sourceEntityId}-${targetEntityId}`);
    }

    /**
     * Moves an entity from the staging directory to its permanent vault location using DTO pattern.
     *
     * @method finalizeWorkspace
     * @memberof FileService
     * @param {Object} finalizeDto - The finalize DTO.
     * @param {string} finalizeDto.entityType - The entity type.
     * @param {string} finalizeDto.line1 - Primary display name.
     * @param {string} finalizeDto.line2 - Secondary display name.
     * @param {string} finalizeDto.currentStagingPath - The current staging directory path.
     * @returns {string} The path to the final entity directory in the vault.
     *
     * @socexplanation
     * - Uses DTO pattern to prevent parameter creep (anti-pattern where methods have too many parameters).
     * - DTO consolidates entityType, line1, line2, currentStagingPath into a single object.
     */
    finalizeWorkspace({ entityType, line1, line2, currentStagingPath }) {
        const finalFolderPath = this.generateVaultPath(entityType, line1, line2);
        this.moveDirectory(currentStagingPath, finalFolderPath);
        return finalFolderPath;
    }

    /**
     * Moves a match from the staging directory to its permanent vault location.
     * @method finalizeMatchDirectory
     * @memberof FileService
     * @param {string} line1 - Primary display name (e.g., requirement niceNameLine1).
     * @param {string} line2 - Secondary display name (e.g., offering niceNameLine1).
     * @param {string} currentPath - The current staging directory path.
     * @returns {string} The path to the final match directory in the vault.
     * @deprecated Use finalizeWorkspace instead.
     */
    finalizeMatchDirectory(line1, line2, currentPath) {
        return this.finalizeWorkspace({ entityType: 'match', line1, line2, currentStagingPath: currentPath });
    }

    /**
     * Prepares a staging entity directory inside UPLOADS_DIR and moves an uploaded file into it.
     * This enforces the staging architecture by quarantining all unprocessed artifacts.
     *
     * @method prepareEntityDirectory
     * @memberof FileService
     * @param {string} entityType - The entity type ('requirement' or 'offering').
     * @param {Object} file - The uploaded file object with path and filename properties.
     * @returns {string} The path to the prepared staging directory.
     *
     * @responsibility
     * - Forces all unprocessed artifacts into a quarantine/staging area (UPLOADS_DIR).
     * - Keeps documents isolated from the permanent vault (REQUIREMENTS_DIR/OFFERINGS_DIR)
     *   until the FINALIZE_ENTITY_WORKSPACE task completes successfully.
     *
     * @boundary_rules
     * - ✅ Uses UPLOADS_DIR as the strict base for all staging folders.
     * - ❌ MUST NOT place files directly into REQUIREMENTS_DIR or OFFERINGS_DIR.
     *
     * @socexplanation
     * - Abstracts the entire staging directory setup from the workflow.
     * - Workflow no longer needs to construct paths using path.join with base directories.
     * - This ensures the workflow remains agnostic to filesystem structure details.
     * - The folder remains in staging until finalizeEntityDirectory is called.
     */
    prepareEntityDirectory(entityType, file) {
        return this.prepareStagingDirectory(file.originalname, file);
    }

    /**
     * Moves an entity from the staging directory (UPLOADS_DIR) to its permanent vault location.
     * This is the FINAL step in the document processing pipeline and should ONLY be called
     * by the FINALIZE_ENTITY_WORKSPACE task after all AI processing completes.
     *
     * @method finalizeEntityDirectory
     * @memberof FileService
     * @param {string} entityType - The entity type ('requirement' or 'offering').
     * @param {string} line1 - Primary display name.
     * @param {string} line2 - Secondary display name.
     * @param {string} currentPath - The current staging directory path (in UPLOADS_DIR).
     * @returns {string} The path to the final entity directory in the vault.
     *
     * @responsibility
     * - Transitions entity from staging (UPLOADS_DIR) to permanent vault (REQUIREMENTS_DIR/OFFERINGS_DIR).
     * - Should ONLY be called at the END of the pipeline by finalizeEntityWorkspace.
     *
     * @boundary_rules
     * - ✅ Resolves final path to REQUIREMENTS_DIR or OFFERINGS_DIR based on entityType.
     * - ❌ MUST NOT be called during intermediate processing steps.
     *
     * @socexplanation
     * - Abstracts the final directory setup from the workflow.
     * - Workflow calls this method and receives the final path without knowing the structure.
     */
    finalizeEntityDirectory(entityType, line1, line2, currentPath) {
        return this.finalizeWorkspace({ entityType, line1, line2, currentStagingPath: currentPath });
    }
}

/**
 * @dependency_injection
 * FileService exports the class constructor rather than an instance.
 * This enables DI container to instantiate with dependencies.
 * Reasoning: Constructor Injection ensures PdfService and LogService are available immediately.
 */
module.exports = FileService;