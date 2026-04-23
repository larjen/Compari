const { createContainer, asClass, asValue, InjectionMode } = require('awilix');

const db = require('../repositories/Database');
const { AI_CACHE_DIR, ENTITY_TYPES } = require('./constants');
const VectorMath = require('../utils/VectorMath');
const HashGenerator = require('../utils/HashGenerator');
const MarkdownGenerator = require('../utils/MarkdownGenerator');
const { processAiTasks } = require('../utils/asyncHandler');
const { registerAllTasks } = require('../workers/TaskRegistry');
const setupTaskListeners = require('../events/TaskListeners');

let cachedContainer = null;

function bootstrap() {
    if (cachedContainer) return cachedContainer;

    const container = createContainer({ injectionMode: InjectionMode.PROXY });

    container.register({
        db: asValue(db),
        aiCacheDir: asValue(AI_CACHE_DIR),
        entityTypes: asValue(ENTITY_TYPES),
        vectorMath: asValue(VectorMath),
        hashGenerator: asValue(HashGenerator),
        markdownGenerator: asValue(MarkdownGenerator),
        processAiTasks: asValue(processAiTasks)
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
    if (!cachedContainer) return bootstrap();
    return cachedContainer;
}

module.exports = { bootstrap, getContainer };