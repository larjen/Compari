/**
 * @module container
 * @description Composition Root - Manual Dependency Injection Container
 *
 * This file acts as the central DI container that wires all dependencies at startup.
 * It instantiates all repositories, services, workflows, and utilities with their
 * required dependencies using Constructor Injection pattern.
 *
 * @responsibility
 * - Create all repository instances (no dependencies)
 * - Create all service instances with their required dependencies
 * - Create all workflow instances with their required dependencies
 * - Wire task handlers via registerAllTasks (wiring function)
 * - Export all initialized instances for use by Controllers and TaskListeners
 *
 * @boundary_rules
 * - ❌ MUST NOT contain business logic
 * - ❌ MUST NOT handle HTTP request/response objects
 * - ✅ ONLY performs dependency wiring and instance creation
 *
 * @dependency_injection
 * All dependencies are wired in bootstrap() using Constructor Injection.
 * The getContainer() method provides cached instances for repeated calls.
 * Reasoning: Centralized wiring ensures consistent dependency management.
 */

const { LOG_LEVELS, LOG_SYMBOLS } = require('./constants');
const SettingsManager = require('./SettingsManager');

const db = require('../repositories/Database');

const SettingsRepo = require('../repositories/SettingsRepo');
const EntityRepo = require('../repositories/EntityRepo');
const MatchRepo = require('../repositories/MatchRepo');
const BlueprintRepo = require('../repositories/BlueprintRepo');
const CriteriaRepo = require('../repositories/CriteriaRepo');
const DimensionRepo = require('../repositories/DimensionRepo');
const AiModelRepo = require('../repositories/AiModelRepo');
const PromptRepo = require('../repositories/PromptRepo');
const QueueRepo = require('../repositories/QueueRepo');

const LogService = require('../services/LogService');
const FileService = require('../services/FileService');
const EventService = require('../services/EventService');
const PdfService = require('../services/PdfService');
const PdfGeneratorService = require('../services/PdfGeneratorService');
const AiValidatorService = require('../services/AiValidatorService');

const EntityService = require('../services/EntityService');
const MatchService = require('../services/MatchService');
const BlueprintService = require('../services/BlueprintService');
const CriteriaService = require('../services/CriteriaService');
const DimensionService = require('../services/DimensionService');
const AiModelService = require('../services/AiModelService');
const PromptService = require('../services/PromptService');
const QueueService = require('../services/QueueService');
const AiService = require('../services/AiService');

const DocumentProcessorWorkflow = require('../workflows/DocumentProcessorWorkflow');
const MatchAssessmentWorkflow = require('../workflows/MatchAssessmentWorkflow');
const CriteriaManagerWorkflow = require('../workflows/CriteriaManagerWorkflow');
const MatchAnalyticsWorkflow = require('../workflows/MatchAnalyticsWorkflow');

const { registerAllTasks } = require('../workers/TaskRegistry');
const setupTaskListeners = require('../events/TaskListeners');
const PromptBuilder = require('../utils/PromptBuilder');
const DynamicSchemaBuilder = require('../utils/DynamicSchemaBuilder');
const MetadataMapper = require('../utils/MetadataMapper');

const SettingController = require('../controllers/SettingController');
const QueueController = require('../controllers/QueueController');
const DimensionController = require('../controllers/DimensionController');
const EntityController = require('../controllers/EntityController');
const MatchController = require('../controllers/MatchController');
const EventController = require('../controllers/EventController');
const BlueprintController = require('../controllers/BlueprintController');
const CriteriaController = require('../controllers/CriteriaController');
const AiModelController = require('../controllers/AiModelController');
const PromptController = require('../controllers/PromptController');

let cachedInstances = null;

function bootstrap() {
    if (cachedInstances) {
        return cachedInstances;
    }

    const settingsRepo = new SettingsRepo({ db });
    const settingsManager = new SettingsManager({ settingsRepo });

    const entityRepo = new EntityRepo({ db });
    const matchRepo = new MatchRepo({ db });
    const blueprintRepo = new BlueprintRepo({ db });
    const criteriaRepo = new CriteriaRepo({ db });
    const dimensionRepo = new DimensionRepo({ db });
    const aiModelRepo = new AiModelRepo({ db });
    const promptRepo = new PromptRepo({ db });
    const queueRepo = new QueueRepo({ db });

    const logService = new LogService({ fileService: null });
    const eventService = new EventService({ logService });

    const pdfService = new PdfService({ logService });

    const fileService = new FileService({ pdfService, logService });

    logService._fileService = fileService;

    const pdfGenerator = new PdfGeneratorService({ logService, fileService });

    const blueprintService = new BlueprintService({ blueprintRepo, eventService });
    const criteriaService = new CriteriaService({ criteriaRepo });
    const dimensionService = new DimensionService({ dimensionRepo });
    const aiModelService = new AiModelService({ aiModelRepo });
    const promptService = new PromptService({ promptRepo });
    const aiService = new AiService({ settingsManager, aiModelRepo, logService, fileService });

    const aiValidatorService = new AiValidatorService({ aiService, promptRepo, logService });

    const entityService = new EntityService({ entityRepo, fileService, logService, eventService });
    const matchService = new MatchService({
        matchRepo,
        entityRepo,
        fileService,
        logService,
        eventService
    });

    const queueService = new QueueService({ settingsManager, queueRepo, entityService, matchService, logService, eventService });

    const matchAnalyticsWorkflow = new MatchAnalyticsWorkflow({
        matchService,
        matchRepo,
        entityRepo,
        criteriaRepo,
        dimensionRepo,
        settingsManager,
        fileService,
        pdfGenerator
    });

    const promptBuilder = new PromptBuilder({ promptRepo });

    const dynamicSchemaBuilder = new DynamicSchemaBuilder({ logService });

    const metadataMapper = new MetadataMapper({ logService });

    const criteriaManagerWorkflow = new CriteriaManagerWorkflow({
        settingsManager,
        aiService,
        aiValidatorService,
        fileService,
        logService,
        entityService,
        criteriaService,
        entityRepo,
        criteriaRepo,
        dimensionRepo,
        blueprintRepo,
        dynamicSchemaBuilder,
        promptBuilder,
        promptRepo,
        queueService
    });

    const docProcessor = new DocumentProcessorWorkflow({
        entityService,
        fileService,
        settingsManager,
        aiService,
        aiValidatorService,
        eventService,
        logService,
        queueService,
        criteriaManagerWorkflow,
        blueprintRepo,
        entityRepo,
        dynamicSchemaBuilder,
        promptBuilder,
        metadataMapper
    });

    const matchAssessment = new MatchAssessmentWorkflow({
        pdfGenerator,
        entityService,
        matchService,
        fileService,
        settingsManager,
        aiService,
        logService,
        criteriaManagerWorkflow,
        matchRepo,
        dimensionRepo,
        promptBuilder
    });

    registerAllTasks({
        queueService,
        entityService,
        matchService,
        docProcessor,
        matchAssessment,
        criteriaManagerWorkflow,
        fileService
    });

    setupTaskListeners({
        eventService,
        logService,
        docProcessor,
        matchAssessment,
        criteriaManagerWorkflow,
        queueService,
        entityService,
        matchService,
        fileService
    }).registerTaskListeners();

    logService.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'container.js', message: 'Dependency Injection bootstrap complete.' });

    const settingController = new SettingController({ settingsManager, aiService, logService });
    const queueController = new QueueController({ queueService });
    const dimensionController = new DimensionController({ dimensionService });
    const entityController = new EntityController({ entityService, criteriaService, matchService, queueService, logService, fileService, matchAnalyticsWorkflow });
    const matchController = new MatchController({ matchService, queueService, fileService, matchAnalyticsWorkflow });
    const eventController = new EventController({ eventService });
    const blueprintController = new BlueprintController({ blueprintService });
    const criteriaController = new CriteriaController({ criteriaService });
    const aiModelController = new AiModelController({ aiModelService, aiService, logService });
    const promptController = new PromptController({ promptService });

    cachedInstances = {
        settingsManager,
        settingsRepo,
        logService,
        fileService,
        eventService,
        pdfGenerator,
        entityRepo,
        matchRepo,
        blueprintRepo,
        criteriaRepo,
        dimensionRepo,
        aiModelRepo,
        promptRepo,
        queueRepo,
        entityService,
        matchService,
        blueprintService,
        criteriaService,
        dimensionService,
        aiModelService,
        promptService,
        queueService,
        aiService,
        docProcessor,
        matchAssessment,
        criteriaManagerWorkflow,
        matchAnalyticsWorkflow,
        dynamicSchemaBuilder,
        metadataMapper,
        PromptBuilder: promptBuilder,
        settingController,
        queueController,
        dimensionController,
        entityController,
        matchController,
        eventController,
        blueprintController,
        criteriaController,
        aiModelController,
        promptController
    };

    return cachedInstances;
}

/**
 * Returns the cached container instance with all services, repositories, and controllers.
 * @public
 * @returns {Object} The container with cached instances.
 */
function getContainer() {
    if (!cachedInstances) {
        return bootstrap();
    }
    return cachedInstances;
}

module.exports = { bootstrap, getContainer };