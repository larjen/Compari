const asyncHandler = require('../utils/asyncHandler');
const { AI_TASK_TYPES } = require('../config/constants');

class ReasoningController {
    constructor({ mcpService, aiService, logService, blueprintRepo, promptBuilder, chatRepo }) {
        this._mcpService = mcpService;
        this._aiService = aiService;
        this._logService = logService;
        this._blueprintRepo = blueprintRepo;
        this._promptBuilder = promptBuilder;
        this._chatRepo = chatRepo;
    }

    getHistory = asyncHandler(async (req, res) => {
        const history = this._chatRepo.getHistory();
        res.json(history);
    });

    clearHistory = asyncHandler(async (req, res) => {
        this._chatRepo.clearHistory();
        res.status(204).send();
    });

    ask = asyncHandler(async (req, res) => {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt is required" });

        // Initialize SSE Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Prevent Next.js/Nginx proxy buffering
        res.flushHeaders();

        const sendEvent = (event, data) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
            this._chatRepo.addMessage('user', prompt);
            
            sendEvent('progress', { message: 'Understanding intent...' });
            
            const queryBlueprint = this._blueprintRepo.getActiveBlueprint();
            const reqLabel = queryBlueprint?.requirementLabelSingular || 'Requirement';
            const offLabel = queryBlueprint?.offeringLabelSingular || 'Offering';

            // Fast LLM call to translate conversational prompt into a strict keyword search
            const queryMessages = this._promptBuilder.buildQueryReformulationMessages(prompt, reqLabel, offLabel);

            const queryResult = await this._aiService.generateChatResponse(queryMessages, {
                taskType: AI_TASK_TYPES.GENERAL,
                temperature: 0.1,
                logAction: 'Reformulated Search Query'
            });
            
            const optimizedQuery = queryResult.content.replace(/['"]/g, '').trim();

            sendEvent('progress', { message: `Searching: "${optimizedQuery}"` });
            const searchResult = await this._mcpService.executeTool('search_notes', { query: optimizedQuery });
            
            const notesRaw = searchResult?.content?.[0]?.text;
            let notes = [];
            try { 
                notes = notesRaw ? JSON.parse(notesRaw) : []; 
            } catch (parseError) {
                this._logService.logSystemFault({
                    origin: 'ReasoningController',
                    message: 'Failed to parse search results from MCP Vault',
                    errorObj: parseError
                });
                notes = [];
            }

            const extractPath = (note) => {
                if (typeof note === 'string') return note;
                if (!note) return null;
                return note.p || note.path || note.filepath || note.file_path || note.filename || note.file || note.name || note?.item?.path || note?.item?.filename;
            };

            const topNotes = Array.isArray(notes) ? notes.slice(0, 12) : [];
            const MAX_CONTEXT_CHARS = 40000;
            let contextBuffer = "";
            let contextPaths = [];
            let linkMap = {};

            for (const note of topNotes) {
                if (contextBuffer.length > MAX_CONTEXT_CHARS) {
                    sendEvent('progress', { message: 'Context limit reached. Truncating remaining files.' });
                    break; 
                }

                const filePath = extractPath(note);
                if (!filePath) continue;

                sendEvent('progress', { message: `Reading file: ${filePath.split('/').pop()}` });

                try {
                    const result = await this._mcpService.executeTool('read_note', { path: filePath });
                    const text = result?.content?.[0]?.text;
                    if (text && !result.isError) {
                        contextBuffer += `\n--- File: ${filePath} ---\n${text}\n`;
                        contextPaths.push(filePath);
                        
                        const linkMatch = text.match(/Compari Link:\s*"(.*?)"/);
                        const fileName = filePath.split('/').pop().replace(/\.md$/, '');
                        if (linkMatch) {
                            linkMap[fileName] = linkMatch[1];
                        }
                    }
                } catch (readError) {
                    this._logService.logSystemFault({
                        origin: 'ReasoningController',
                        message: `Failed to read note via MCP: ${filePath}`,
                        errorObj: readError
                    });
                }
            }

            if (!contextBuffer.trim()) {
                sendEvent('chunk', { text: "I couldn't find any readable context in the vault to answer your question." });
                sendEvent('done', { model: 'none' });
                return res.end();
            }

            sendEvent('context', { paths: contextPaths, linkMap });
            sendEvent('progress', { message: 'Reasoning...' });

const activeBlueprint = this._blueprintRepo.getActiveBlueprint();
            const requirementLabel = activeBlueprint?.requirementLabelPlural || 'Requirements';
            const offeringLabel = activeBlueprint?.requirementLabelPlural || 'Offerings';

            /**
             * @socexplanation
             * Retrieves full chat history to prevent conversational amnesia.
             * The prompt builder must receive the history array to establish context for follow-up questions.
             */
            const chatHistory = this._chatRepo.getHistory();
            const messages = this._promptBuilder.buildReasoningMessages(contextBuffer, prompt, requirementLabel, offeringLabel, chatHistory);

            const result = await this._aiService.streamReasoningResponse(
                messages, 
                { 
                    logAction: 'Vault-Aware Reasoning',
                    onChunk: (chunk) => sendEvent('chunk', { text: chunk })
                }
            );

            this._chatRepo.addMessage('assistant', result.content);
            
            sendEvent('done', { model: result.model });
            res.end();
        } catch (err) {
            this._logService.logSystemFault({ origin: 'ReasoningController', message: `Stream failed`, errorObj: err });
            sendEvent('error', { message: err.message });
            res.end();
        }
    });
}

module.exports = ReasoningController;