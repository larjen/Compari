/**
 * @module FileService
 * @description Infrastructure Service for File System operations.
 * @responsibility
 * - Performs raw file I/O: reading, writing, moving, and directory creation.
 * - Provides generic JSON file read/write operations.
 * - Extracts raw text streams from PDF buffers.
 * - Initializes all application directories at startup.
 * - Opens folders in the native OS file manager.
 * - Generates standardized folder paths for job applications.
 * @boundary_rules
 * - ✅ MAY call other Utility/Infrastructure services.
 * - ❌ MUST NOT call Domain Services (e.g., JobService, WorkflowService).
 * - ❌ MUST NOT contain business logic or construct business-specific paths.
 * - ❌ MUST NOT know about application-specific settings or configurations.
 * 
 * @socexplanation
 * - Centralizes folder path generation to avoid code duplication across workflows.
 * - Provides a single source of truth for file system naming conventions.
 * - Sanitizes user input (position, company) to ensure valid filesystem paths.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const PdfService = require('./PdfService');
const logService = require('./LogService');
const {
    OFFERINGS_DIR,
    TRASHED_DIR,
    DB_DIR,
    LOGS_DIR,
    UPLOADS_DIR,
    DATA_DIR,
    REQUIREMENTS_DIR,
    MATCH_REPORTS_DIR,
    LOG_LEVELS,
    LOG_SYMBOLS
} = require('../config/constants');

class FileService {

    /**
     * Ensures the directory for a target path exists, creating it if necessary.
     * Centralizes directory creation logic to reduce repetitive boilerplate.
     * @param {string} targetPath - The file or directory path to ensure.
     * @param {boolean} isFile - If true, extracts the parent directory from the targetPath.
     * @private
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
     * @private
     */
    _isValidPath(targetPath) {
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
            MATCH_REPORTS_DIR
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
        return await PdfService.extractTextFromPDF(filePath);
    }

    async extractTextFromFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            return await this.extractTextFromPDF(filePath);
        }
        return fs.readFileSync(filePath, 'utf8');
    }

    listFilesInFolder(folderPath) {
        if (!this._isValidPath(folderPath)) return [];
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
        if (!this._isValidPath(filePath)) return '';
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
        if (!this._isValidPath(sourcePath)) return;
        this._ensureDir(targetPath);
        fs.renameSync(sourcePath, targetPath);
    }

    appendToFile(folderPath, fileName, content) {
        if (!folderPath || !fileName) return;
        this._ensureDir(folderPath);
        const filePath = path.join(folderPath, fileName);
        fs.appendFileSync(filePath, content);
    }

    readJsonFile(filePath) {
        if (!this._isValidPath(filePath)) return null;
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
        if (!this._isValidPath(filePath)) return null;
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
                        logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'FileService', `Failed to parse JSONL line: ${parseError.message}`);
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
            logService.logTerminal(LOG_LEVELS.WARN, LOG_SYMBOLS.WARNING, 'FileService', `Cannot open folder: path does not exist: ${folderPath}`);
            return;
        }

        const platform = os.platform();
        
        if (platform === 'win32') {
            exec(`explorer "${folderPath}"`, (error) => {
                if (error) logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'FileService', `Failed to open folder on Windows: ${error.message}`);
            });
        } else if (platform === 'darwin') {
            exec(`open "${folderPath}"`, (error) => {
                if (error) logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'FileService', `Failed to open folder on macOS: ${error.message}`);
            });
        } else if (platform === 'linux') {
            exec(`xdg-open "${folderPath}"`, (error) => {
                if (error) logService.logTerminal(LOG_LEVELS.ERROR, LOG_SYMBOLS.ERROR, 'FileService', `Failed to open folder on Linux: ${error.message}`);
            });
        }
    }

    /**
     * Generates a folder path for an entity.
     * Creates a standardized path using the entity type, name sanitized, and timestamp.
     * 
     * @method generateEntityFolderPath
     * @memberof FileService
     * @param {string} type - The entity type ('source' or 'target').
     * @param {string} name - The entity name.
     * @returns {string} The full filesystem path for the entity folder.
     */
    generateEntityFolderPath(type, name) {
        const timestamp = Date.now();
        const safeName = (name || "Entity").replace(/[\/\\:*?"<>|]/g, '-').trim() || "Entity";
        const baseDir = type === 'requirement' ? REQUIREMENTS_DIR : OFFERINGS_DIR;
        return path.join(baseDir, `${timestamp}-${safeName}`);
    }

    /**
     * Generates a folder path for match reports.
     * Creates a standardized path using the source entity ID, target entity ID, and timestamp.
     * 
     * @method generateMatchFolderPath
     * @memberof FileService
     * @param {number} sourceEntityId - The source entity ID.
     * @param {number} targetEntityId - The target entity ID.
     * @returns {string} The full filesystem path for the match folder.
     * 
     * @socexplanation
     * - Centralizes path generation logic to prevent infrastructure details from leaking
     *   into domain workflows (MatchService, MatchAssessmentWorkflow).
     * - Provides a single source of truth for match folder naming conventions.
     */
    generateMatchFolderPath(sourceEntityId, targetEntityId) {
        const timestamp = Date.now();
        return path.join(MATCH_REPORTS_DIR, `Match_${sourceEntityId}_${targetEntityId}_${timestamp}`);
    }

    /**
     * Prepares a temporary entity directory and moves an uploaded file into it.
     * Encapsulates path generation, directory creation, and file movement to enforce SoC.
     * 
     * @method prepareEntityDirectory
     * @memberof FileService
     * @param {string} entityType - The entity type ('requirement' or 'offering').
     * @param {Object} file - The uploaded file object with path and filename properties.
     * @returns {string} The path to the prepared temporary directory.
     * 
     * @socexplanation
     * - Abstracts the entire temporary directory setup from the workflow.
     * - Workflow no longer needs to construct paths using path.join with base directories.
     * - This ensures the workflow remains agnostic to filesystem structure details.
     */
    prepareEntityDirectory(entityType, file) {
        const { REQUIREMENTS_DIR, OFFERINGS_DIR } = require('../config/constants');
        const baseDir = entityType === 'requirement' ? REQUIREMENTS_DIR : OFFERINGS_DIR;
        const tempFolderName = `processing-${Date.now()}`;
        const tempFolderPath = path.join(baseDir, tempFolderName);
        
        this.createDirectory(tempFolderPath);
        this.moveFile(file.path, tempFolderPath, file.filename);
        
        return tempFolderPath;
    }

    /**
     * Moves an entity from a temporary directory to its final named location.
     * Encapsulates final path generation and directory movement to enforce SoC.
     * 
     * @method finalizeEntityDirectory
     * @memberof FileService
     * @param {string} entityType - The entity type ('requirement' or 'offering').
     * @param {string} entityName - The name of the entity for folder naming.
     * @param {string} currentPath - The current temporary directory path.
     * @returns {string} The path to the final entity directory.
     * 
     * @socexplanation
     * - Abstracts the final directory setup from the workflow.
     * - Workflow calls this method and receives the final path without knowing the structure.
     */
    finalizeEntityDirectory(entityType, entityName, currentPath) {
        const finalFolderPath = this.generateEntityFolderPath(entityType, entityName);
        this.moveDirectory(currentPath, finalFolderPath);
        return finalFolderPath;
    }
}

module.exports = new FileService();