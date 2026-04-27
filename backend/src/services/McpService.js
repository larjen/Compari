/**
 * @module McpService
 * @description Infrastructure Service that manages local MCP server lifecycle 
 * and provides a standard client interface to consume vault search and read tools.
 * Handles the ESM/CommonJS bridge via dynamic imports.
 * * @responsibility
 * - Spawns and manages the 'mcpvault' server via stdio transport.
 * - Executes tool calls to search and retrieve content from the Obsidian vault.
 * - Acts as the primary interface between the LLM and the physical knowledge base.
 */

class McpService {
    constructor({ settingsManager, logService, vaultPath }) {
        this._settingsManager = settingsManager;
        this._logService = logService;
        this._vaultPath = vaultPath;
        this._client = null;
        this._transport = null;
    }

    /**
     * Initializes the MCP connection using dynamic ESM imports.
     * This bridge is required because @modelcontextprotocol is an ESM package.
     */
    async initialize() {
        if (!this._vaultPath) {
            this._logService.logTerminal({ 
                status: 'WARN', 
                symbolKey: 'WARNING', 
                origin: 'McpService', 
                message: 'No vault path provided. MCP bridge will be disabled.' 
            });
            return;
        }

        try {
            // UPDATED: Importing from the monolithic @modelcontextprotocol/sdk stable branch
            // This resolves the ETARGET error by not relying on split v2 alpha packages.
            const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
            const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

            /**
             * @socexplanation
             * Security validation to prevent command injection via the vault path.
             * We strictly allow only alphanumeric characters, slashes, dashes, dots, spaces, and underscores.
             */
            if (/[^a-zA-Z0-9/\\\-_:\. ]/.test(this._vaultPath)) {
                const secErr = new Error(`Invalid characters detected in vault path: ${this._vaultPath}`);
                this._logService.logSystemFault({
                    origin: 'McpService',
                    message: 'Security validation failed for vault path',
                    errorObj: secErr
                });
                return;
            }

            this._transport = new StdioClientTransport({
                command: "npx",
                args: ["-y", "@bitbonsai/mcpvault", this._vaultPath] // Added -y for npx non-interactive
            });

            this._client = new Client({ 
                name: "compari-reasoner", 
                version: "1.0.0" 
            }, {
                capabilities: {
                    tools: {}
                }
            });

            await this._client.connect(this._transport);
            
            this._logService.logTerminal({ 
                status: 'INFO', 
                symbolKey: 'LIGHTNING', 
                origin: 'McpService', 
                message: 'MCP Vault Bridge Initialized via Stable SDK.' 
            });
        } catch (err) {
            this._logService.logSystemFault({
                origin: 'McpService',
                message: 'Failed to initialize MCP bridge (Stable Path)',
                errorObj: err
            });
        }
    }

    /**
     * Executes a tool call on the MCP server.
     * @param {string} toolName - Name of the tool (e.g., 'search_notes').
     * @param {Object} args - Arguments for the tool.
     */
    async executeTool(toolName, args = {}) {
        if (!this._client) {
            throw new Error("MCP Client not initialized. Check logs for ESM import failures.");
        }
        return await this._client.callTool({ 
            name: toolName, 
            arguments: args 
        });
    }
}

module.exports = McpService;