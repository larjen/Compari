const { createContainer, asClass, asValue, InjectionMode } = require('awilix');

const db = require('../repositories/Database');
const { AI_CACHE_DIR, ENTITY_TYPES, VAULT_DIR } = require('./constants');
const VectorMath = require('../utils/VectorMath');
const HashGenerator = require('../utils/HashGenerator');
const MarkdownGenerator = require('../utils/MarkdownGenerator');
const { processAiTasks } = require('../utils/asyncHandler');
const { registerAllTasks } = require('../workers/TaskRegistry');
const setupTaskListeners = require('../events/TaskListeners');
const McpService = require('../services/McpService');
const ReasoningController = require('../controllers/ReasoningController');

let cachedContainer = null;

async function bootstrap() {
    if (cachedContainer) return cachedContainer;

    const container = createContainer({ injectionMode: InjectionMode.PROXY });

    container.register({
        db: asValue(db),
        aiCacheDir: asValue(AI_CACHE_DIR),
        entityTypes: asValue(ENTITY_TYPES),
        vectorMath: asValue(VectorMath),
        hashGenerator: asValue(HashGenerator),
        markdownGenerator: asValue(MarkdownGenerator),
        processAiTasks: asValue(processAiTasks),
        // Register the physical vault path as a resolvable dependency
        vaultPath: asValue(VAULT_DIR),
        // Simplified registration: Proxy mode will now automatically inject vaultPath by name
        mcpService: asClass(McpService).singleton(),
        // Reasoning controller for vault-aware AI reasoning
        reasoningController: asClass(ReasoningController).singleton()
    });

    container.loadModules([
        '../repositories/*Repo.js',
        '../services/*Service.js',
        '../workflows/*Workflow.js',
        '../controllers/*Controller.js',
        '../utils/MatchingEngine.js',
        '../utils/PromptBuilder.js',
        '../utils/DynamicSchemaBuilder.js',
        '../utils/MetadataMapper.js',
        '../config/SettingsManager.js'
    ], {
        cwd: __dirname,
        formatName: 'camelCase',
        resolverOptions: { register: asClass, lifetime: 'SINGLETON' }
    });

    const queueService = container.resolve('queueService');
    const entityService = container.resolve('entityService');
    const matchService = container.resolve('matchService');
    const docProcessor = container.resolve('documentProcessorWorkflow');
    const matchAssessment = container.resolve('matchAssessmentWorkflow');
    const criteriaManagerWorkflow = container.resolve('criteriaManagerWorkflow');
    const fileService = container.resolve('fileService');
    const eventService = container.resolve('eventService');
    const logService = container.resolve('logService');
    const mcpService = container.resolve('mcpService');

    if (mcpService && VAULT_DIR) {
        try {
            await mcpService.initialize();
        } catch (err) {
            logService.logTerminal({ 
                status: 'WARN', 
                symbolKey: 'WARNING', 
                origin: 'Container', 
                message: `[MCP] Service initialization failed: ${err.message}` 
            });
        }
    }

    registerAllTasks({
        queueService, entityService, matchService, docProcessor, 
        matchAssessment, criteriaManagerWorkflow, fileService
    });

    const taskListeners = setupTaskListeners({
        eventService, logService, entityService, matchService, 
        fileService, docProcessor, matchAssessment, 
        criteriaManagerWorkflow, queueService
    });
    
    taskListeners.registerTaskListeners();

    cachedContainer = container;
    return container;
}

function getContainer() {
    if (!cachedContainer) {
        throw new Error("Container has not been bootstrapped. Ensure await bootstrap() is called during server startup.");
    }
    return cachedContainer;
}

module.exports = { bootstrap, getContainer };