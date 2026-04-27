/**
 * @module repositories/Seeder
 * @description Database Seeding Utilities.
 *
 * This module contains idempotent seed functions for populating the database
 * with initial reference data. Seeding is meant for initial workspace setup
 * and should only be called once after schema initialization.
 *
 * @responsibility
 * - Seeds default AI models (chat + embedding)
 * - Seeds default matching dimensions
 * - Seeds default entity blueprints with metadata fields
 *
 * @boundary_rules
 * - MUST NOT contain schema initialization logic
 * - MUST NOT be called more than once per database lifetime
 * - Functions are idempotent: calling multiple times produces same result
 *
 * @dependency_injection
 * Logger is passed as a parameter to seed functions to avoid top-level require
 * of LogService before DI container is initialized. This enables testing
 * and follows the DTO pattern for dependency injection.
 */

const { AI_MODEL_ROLES, ENTITY_TYPES, LOG_LEVELS, LOG_SYMBOLS } = require('../config/constants');
const fs = require('fs');
const path = require('path');

/**
 * Seeds default AI models into the database.
 * Creates Ollama chat and embedding models if they don't exist.
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 * @public
 */
function seedAiModels(db, logger) {
    const existing = db.prepare('SELECT COUNT(*) as count FROM ai_models').get();
    if (existing.count > 0) {
        return;
    }

    const defaultModels = [
        {
            name: 'Gemma 4 (4B)',
            model_identifier: 'gemma4:e4b',
            api_url: 'http://127.0.0.1:11434/v1',
            api_key: null,
            role: AI_MODEL_ROLES.CHAT,
            is_active: 1,
            is_system: 1,
            temperature: 0.1,
            context_window: 4096
        },
        {
            name: 'Gemma 4 (2B)',
            model_identifier: 'gemma4:e2b',
            api_url: 'http://127.0.0.1:11434/v1',
            api_key: null,
            role: AI_MODEL_ROLES.CHAT,
            is_active: 1,
            is_system: 1,
            temperature: 0.1,
            context_window: 4096
        },
        {
            name: 'BGE-M3',
            model_identifier: 'bge-m3',
            api_url: 'http://127.0.0.1:11434/v1',
            api_key: null,
            role: AI_MODEL_ROLES.EMBEDDING,
            is_active: 1,
            is_system: 1,
            temperature: 0.1,
            context_window: 8192
        },
        {
            name: 'Claude Sonnet 4.6',
            model_identifier: 'claude-sonnet-4-6',
            api_url: 'https://api.anthropic.com/v1',
            api_key: null,
            role: AI_MODEL_ROLES.CHAT,
            is_active: 1,
            is_system: 0,
            temperature: 0.1,
            context_window: 200000
        },
        {
            name: 'Claude Opus 4.6',
            model_identifier: 'claude-opus-4-6',
            api_url: 'https://api.anthropic.com/v1',
            api_key: null,
            role: AI_MODEL_ROLES.CHAT,
            is_active: 1,
            is_system: 0,
            temperature: 0.1,
            context_window: 200000
        },
        {
            name: 'Claude Haiku 4.5',
            model_identifier: 'claude-haiku-4-5-20251001',
            api_url: 'https://api.anthropic.com/v1',
            api_key: null,
            role: AI_MODEL_ROLES.CHAT,
            is_active: 1,
            is_system: 0,
            temperature: 0.1,
            context_window: 200000
        },
        {
            name: 'Gemini 3 Flash Preview',
            model_identifier: 'gemini-3-flash-preview',
            api_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            api_key: null,
            role: AI_MODEL_ROLES.CHAT,
            is_active: 0,
            is_system: 0,
            temperature: 0.1,
            context_window: 2000000
        },
        {
            name: 'Gemini 3.1 Pro Preview',
            model_identifier: 'gemini-3.1-pro-preview',
            api_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            api_key: null,
            role: AI_MODEL_ROLES.CHAT,
            is_active: 0,
            is_system: 0,
            temperature: 0.1,
            context_window: 1000000
        },
        {
            name: 'Gemini Embedding 2',
            model_identifier: 'gemini-embedding-2',
            api_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            api_key: null,
            role: AI_MODEL_ROLES.EMBEDDING,
            is_active: 0,
            is_system: 0,
            temperature: 0.1,
            context_window: 2048
        }
    ];

    const stmt = db.prepare(`
        INSERT INTO ai_models (name, model_identifier, api_url, api_key, role, is_active, is_system, temperature, context_window)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const model of defaultModels) {
        stmt.run(
            model.name,
            model.model_identifier,
            model.api_url,
            model.api_key,
            model.role,
            model.is_active,
            model.is_system,
            model.temperature,
            model.context_window
        );
    }

    logger.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'Seeder', message: 'Seeded default AI models (Ollama, Claude, Gemini) in ai_models table.' });
}

/**
 * Seeds default matching dimensions into the database.
 * Creates 5 default dimensions: core_competencies, experience, soft_skills, domain_knowledge, cultural_fit.
 * @public
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seedDimensions(db, logger) {
    const existing = db.prepare('SELECT COUNT(*) as count FROM dimensions').get();
    if (existing.count > 0) {
        return;
    }

    const defaultDimensions = [
        {
            name: 'core_competencies',
            display_name: 'Core Competencies',
            requirement_instruction: 'Extract all required domain-specific hard skills, specialized techniques, methodologies, equipment, software tools, educational requirements, and professional certifications that the offering must possess. Find ALL required competencies - do not stop at 2 or 3. Format each item to include its application context (e.g., "ReactJS for building scalable single-page applications" rather than just "ReactJS").',
            offering_instruction: 'Extract all possessed domain-specific hard skills, specialized techniques, methodologies, equipment, software tools, educational credentials, and professional certifications from the offering profile. Find ALL skills listed. Format each item to include its application context (e.g., "ReactJS for building scalable single-page applications" rather than just "ReactJS").',
            is_active: 1,
            weight: 1.5
        },
        {
            name: 'experience',
            display_name: 'Experience',
            requirement_instruction: 'Extract required years of experience, specific past role titles, career track requirements, seniority levels, and professional background expectations for the offering position. Format each item to include its contextual details (e.g., "5 years of experience leading agile frontend teams" rather than just "5 years experience").',
            offering_instruction: 'Extract all years of experience, past role titles, career history, seniority levels, and professional background from the offering profile. Format each item to include its contextual details (e.g., "5 years of experience leading agile frontend teams" rather than just "5 years experience").',
            is_active: 1,
            weight: 1.2
        },
        {
            name: 'soft_skills',
            display_name: 'Soft Skills',
            requirement_instruction: 'Extract required interpersonal skills, leadership abilities, communication capabilities, cognitive traits, and personal attributes expected from the offering. Format each item to include how the skill is applied (e.g., "Strong communication skills for negotiating with enterprise stakeholders" rather than just "Communication").',
            offering_instruction: 'Extract all interpersonal skills, leadership abilities, communication capabilities, cognitive traits, and personal attributes demonstrated by the offering. Format each item to include how the skill is applied (e.g., "Strong communication skills for negotiating with enterprise stakeholders" rather than just "Communication").',
            is_active: 1,
            weight: 0.8
        },
        {
            name: 'domain_knowledge',
            display_name: 'Domain Knowledge',
            requirement_instruction: 'Extract required industry-specific knowledge, market familiarity, regulatory expertise, domain terminology, and specialized subject matter expertise expected from the offering. Format each item to include specific contexts (e.g., "HIPAA compliance knowledge for healthcare data processing" rather than just "HIPAA").',
            offering_instruction: 'Extract all industry-specific knowledge, market familiarity, regulatory expertise, domain terminology, and specialized subject matter expertise possessed by the offering. Format each item to include specific contexts (e.g., "HIPAA compliance knowledge for healthcare data processing" rather than just "HIPAA").',
            is_active: 1,
            weight: 1.0
        },
        {
            name: 'cultural_fit',
            display_name: 'Cultural Fit',
            requirement_instruction: 'Extract required work style preferences (remote, hybrid, on-site), work environment expectations (fast-paced, collaborative, autonomous), company values, and cultural indicators for the offering. Format each item to include context (e.g., "Prefers fast-paced, autonomous startup environments" rather than just "Autonomous").',
            offering_instruction: 'Extract work style preferences (remote, hybrid, on-site), work environment expectations (fast-paced, collaborative, autonomous), company values, and cultural indicators from the offering profile. Format each item to include context (e.g., "Prefers fast-paced, autonomous startup environments" rather than just "Autonomous").',
            is_active: 1,
            weight: 0.5
        }
    ];

    const stmt = db.prepare(`
        INSERT INTO dimensions (name, display_name, requirement_instruction, offering_instruction, is_active, weight)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const dimension of defaultDimensions) {
        stmt.run(
            dimension.name,
            dimension.display_name,
            dimension.requirement_instruction,
            dimension.offering_instruction,
            dimension.is_active,
            dimension.weight
        );
    }

    logger.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'Seeder', message: 'Seeded default 5 dimensions in dimensions table.' });
}

/**
 * Seeds default blueprints into the database.
 * Creates "Employment Match" blueprint with singular/plural labels.
 * Links to all 5 dimensions.
 * @public
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seedBlueprints(db, logger) {
    const existing = db.prepare('SELECT COUNT(*) as count FROM entity_blueprints').get();
    if (existing.count > 0) {
        return;
    }

    const dimensions = db.prepare('SELECT id FROM dimensions').all();
    if (dimensions.length === 0) {
        logger.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'Seeder', message: 'No dimensions found, skipping blueprint seeding.' });
        return;
    }

    const insertBlueprint = db.prepare(`
        INSERT INTO entity_blueprints (name, requirement_label_singular, requirement_label_plural, offering_label_singular, offering_label_plural, requirement_doc_type_label, offering_doc_type_label, description, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertField = db.prepare(`
        INSERT INTO blueprint_metadata_fields (blueprint_id, field_name, field_type, description, is_required, entity_role)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertDimension = db.prepare(`
        INSERT INTO blueprint_dimensions (blueprint_id, dimension_id)
        VALUES (?, ?)
    `);

    const blueprintId = insertBlueprint.run(
        'Employment Match',
        'Job Listing',
        'Job Listings',
        'Candidate',
        'Candidates',
        'Upload a PDF file containing the job listing, browse to the Job Listing and print as pdf, make sure headers and footers contains the URL to the page.',
        'Upload a PDF file containing the candidate Curriculum Vitae.',
        'Standard blueprint for matching job listings with candidate profiles.',
        1
    ).lastInsertRowid;

    const requirementFields = [
        { field_name: 'position', field_type: 'string', description: 'Extract the specific job title or position being offered. Return only the title.', is_required: 1 },
        { field_name: 'company', field_type: 'string', description: 'Extract the name of the company or organization hiring.', is_required: 1 },
        { field_name: 'url', field_type: 'string', description: 'Extract the URL or web link to the job listing if present. Return the raw URL string.', is_required: 0 },
        { field_name: 'datePosted', field_type: 'date', description: 'Extract the date the job listing was published. Format YYYY-MM-DD.', is_required: 0 },
        { field_name: 'deadline', field_type: 'date', description: 'Extract the application deadline. Format YYYY-MM-DD.', is_required: 0 }
    ];

    for (const field of requirementFields) {
        insertField.run(blueprintId, field.field_name, field.field_type, field.description, field.is_required, ENTITY_TYPES.REQUIREMENT);
    }

    const offeringFields = [
        { field_name: 'name', field_type: 'string', description: 'Extract the full personal name of the candidate.', is_required: 1 },
        { field_name: 'email', field_type: 'string', description: 'Extract the primary email address.', is_required: 1 },
        { field_name: 'phone', field_type: 'string', description: 'Extract the phone number.', is_required: 0 },
        { field_name: 'linkedinUrl', field_type: 'string', description: 'Extract the LinkedIn profile URL.', is_required: 0 }
    ];

    for (const field of offeringFields) {
        insertField.run(blueprintId, field.field_name, field.field_type, field.description, field.is_required, ENTITY_TYPES.OFFERING);
    }

    for (const dim of dimensions) {
        insertDimension.run(blueprintId, dim.id);
    }

    logger.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'Seeder', message: 'Seeded default blueprint (Employment Match) with Job Listing/Candidate fields.' });
}

/**
 * Seeds default settings into the database.
 * Populates default application configurations including auto_merge_threshold and log_ai_interactions.
 * The log_ai_interactions setting is disabled by default ('false') and controls whether AI prompts
 * and responses are captured in System Logs for debugging match quality.
 * This function is idempotent - calling multiple times produces the same result.
 * @public
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seedSettings(db, logger) {
    const existing = db.prepare('SELECT COUNT(*) as count FROM settings').get();
    if (existing.count > 0) {
        return;
    }

    const defaultSettings = [
        { key: 'auto_merge_threshold', value: '0.95' },
        { key: 'minimum_match_floor', value: '0.50' },
        { key: 'perfect_match_score', value: '0.85' },
        { key: 'log_ai_interactions', value: 'false' },
        { key: 'ai_verify_merges', value: 'true' },
        { key: 'model_routing_general', value: '1' },
        { key: 'model_routing_verification', value: '1' },
        { key: 'model_routing_embedding', value: '3' },
        { key: 'model_routing_metadata', value: '1' },
        { key: 'model_routing_reasoning', value: '1' },
        { key: 'allow_concurrent_ai', value: 'false' },
        { key: 'use_ai_cache', value: 'true' },
        { key: 'debug_mode', value: 'false' }
    ];

    const stmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
    `);

    for (const setting of defaultSettings) {
        stmt.run(setting.key, setting.value);
    }

    logger.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'Seeder', message: 'Seeded default settings including model routing configuration in settings table.' });
}

/**
 * Seeds default prompts into the database.
 * Reads prompt templates from markdown files in the prompts directory.
 * @public
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seedPrompts(db, logger) {
    const existing = db.prepare('SELECT COUNT(*) as count FROM prompts').get();
    if (existing.count > 0) {
        return;
    }

    const promptsDir = path.join(__dirname, '../prompts');

    const readMarkdownFile = (filename) => {
        try {
            const filePath = path.join(promptsDir, filename);
            return fs.readFileSync(filePath, 'utf-8');
        } catch (err) {
            /** * @socexplanation 
             * Stack trace preservation enforced during database seeding.
             */
            logger.logTerminal({
                status: LOG_LEVELS.WARN,
                symbolKey: LOG_SYMBOLS.WARNING,
                origin: 'Seeder',
                message: `Failed to read prompt file ${filename}`,
                errorObj: err
            });
            return null;
        }
    };

    const defaultPrompts = [
        {
            system_name: 'markdown_extraction',
            title: 'Markdown Extraction',
            description: 'Converts raw PDF text into clean Markdown format',
            prompt: readMarkdownFile('markdown_extraction.md') || ''
        },
        {
            system_name: 'entity_metadata',
            title: 'Entity Metadata Extraction',
            description: 'Extracts entity metadata fields based on blueprint definitions',
            prompt: readMarkdownFile('entity_metadata.md') || ''
        },
        {
            system_name: 'dynamic_extraction',
            title: 'Dynamic Criteria Extraction',
            description: 'Extracts criteria from entities across multiple dimensional categories',
            prompt: readMarkdownFile('dynamic_extraction.md') || ''
        },
        {
            system_name: 'match_summary',
            title: 'Match Summary Generation',
            description: 'Generates structured Markdown summaries of requirement-offering matches',
            prompt: readMarkdownFile('match_summary.md') || ''
        },
        {
            system_name: 'executive_summary',
            title: 'Executive Summary Generation',
            description: 'Synthesizes dimensional match analysis into executive summaries',
            prompt: readMarkdownFile('executive_summary.md') || ''
        },
        {
            system_name: 'synonym_validator',
            title: 'Synonym Validator',
            description: 'Determines if two criteria are functionally identical synonyms',
            prompt: `You are a strict technical evaluator. Your job is to determine if two criteria are functionally identical synonyms. 

CRITICAL RULES:
- Related but distinct concepts (e.g., "Hardware" vs "Software", "B2B SaaS" vs "OT", "GDPR" vs "HIPAA", "React" vs "Node") are NOT synonyms.
- Hierarchical differences (e.g., "Programming" vs "Python") are NOT synonyms.
- ONLY approve if they mean the exact same thing in a professional context (e.g., "JS" vs "JavaScript", "P&L Management" vs "Profit and Loss").

Respond with EXACTLY and ONLY the word "YES" or "NO".`
        },
        {
            system_name: 'reasoning_system',
            title: 'Reasoning Agent System',
            description: 'Instructions for the deep reasoning MCP agent, dynamically injecting blueprint terminology and vault syntax rules.',
            prompt: `You are an expert semantic matching analyst and deep reasoning assistant. You operate on top of a structured knowledge vault containing:
- {{offeringLabel}}: Entities that provide specific capabilities, skills, or assets.
- {{requirementLabel}}: Entities that demand specific capabilities, skills, or assets.
- Criteria: Extracted data points categorized by dynamically constructed dimensions.
- Matches: Scoring reports showing the semantic alignment between {{offeringLabel}} and {{requirementLabel}}.

You will be provided with context in the form of raw file contents retrieved from this vault.

VAULT SYNTAX GUIDE:
- YAML Frontmatter: Files begin with metadata between \`---\` lines. ALWAYS read the \`Type\` property in the frontmatter to immediately understand what kind of document you are analyzing.
- Wiki Links: Files use Obsidian-style links (e.g., [[Target Entity Name]]). These indicate strong relational connections between Offerings, Requirements, and Criteria.

INSTRUCTIONS:
1. Base your analysis strictly on the provided file context. If the answer cannot be confidently derived from the context, explicitly state that you lack the necessary information.
2. Synthesize the information intelligently. Do not just recite text; compare, contrast, and provide objective, actionable insights regarding the match quality and criteria alignment.

CRITICAL: Do NOT use markdown formatting (no asterisks, no hashes, no code blocks). Use plain text with clear paragraph spacing and dashes for lists.`
        },
        {
            system_name: 'query_reformulation',
            title: 'Search Query Reformulation',
            description: 'Instructions for translating user chat messages into optimized vault search queries.',
            prompt: `You are an expert search query generator for a markdown vault. 
Extract the core search intent from the user's message.
RULES:
1. Strip conversational filler (e.g., "Can you tell me", "What are").
2. If the user explicitly asks to list or find all entities of a certain type, output ONLY: Type: "{{requirementLabel}}" or Type: "{{offeringLabel}}".
3. If the user asks a specific question about skills or traits (e.g., "Who has React experience?"), extract the core keywords and include the type if implied (e.g., Type: "{{offeringLabel}}" React experience).
4. If the message is a general conceptual question or comparison, just extract the 2-5 most important keywords from their prompt.
Just output the raw query string.`
        }
    ];

    for (const promptData of defaultPrompts) {
        if (!promptData.prompt) {
            logger.logTerminal({ status: LOG_LEVELS.WARN, symbolKey: LOG_SYMBOLS.WARNING, origin: 'Seeder', message: `Skipping seed for ${promptData.system_name} - empty prompt content` });
            continue;
        }

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO prompts (system_name, title, description, prompt)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(promptData.system_name, promptData.title, promptData.description, promptData.prompt);
    }

    logger.logTerminal({ status: LOG_LEVELS.INFO, symbolKey: LOG_SYMBOLS.CHECKMARK, origin: 'Seeder', message: 'Seeded default prompts in prompts table.' });
}

/**
 * Runs all seed functions in the correct order.
 * This function should be called AFTER initializeSchema() completes.
 * @public
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seed(db, logger) {
    seedAiModels(db, logger);
    seedDimensions(db, logger);
    seedBlueprints(db, logger);
    seedSettings(db, logger);
    seedPrompts(db, logger);
}

module.exports = {
    seed,
    seedAiModels,
    seedDimensions,
    seedBlueprints,
    seedSettings,
    seedPrompts
};
