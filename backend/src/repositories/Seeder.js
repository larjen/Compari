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
 */

const logService = require('../services/LogService');

/**
 * Seeds default AI models into the database.
 * Creates Ollama chat and embedding models if they don't exist.
 * 
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seedAiModels(db) {
    const existing = db.prepare('SELECT COUNT(*) as count FROM ai_models').get();
    if (existing.count > 0) {
        return;
    }

    const defaultModels = [
        {
            name: 'Gemma',
            model_identifier: 'gemma4:e4b',
            api_url: 'http://127.0.0.1:11434/v1',
            api_key: null,
            role: 'chat',
            is_active: 1,
            is_system: 1,
            temperature: 0.1,
            context_window: 8192
        },
        {
            name: 'Llama',
            model_identifier: 'llama3.1:8b',
            api_url: 'http://127.0.0.1:11434/v1',
            api_key: null,
            role: 'chat',
            is_active: 0,
            is_system: 1,
            temperature: 0.1,
            context_window: 8192
        },
        {
            name: 'Nomic',
            model_identifier: 'nomic-embed-text',
            api_url: 'http://127.0.0.1:11434/v1',
            api_key: null,
            role: 'embedding',
            is_active: 1,
            is_system: 1,
            temperature: 0.1,
            context_window: 8192
        },
        {
            name: 'BGE-M3',
            model_identifier: 'bge-m3',
            api_url: 'http://127.0.0.1:11434/v1',
            api_key: null,
            role: 'embedding',
            is_active: 0,
            is_system: 1,
            temperature: 0.1,
            context_window: 8192
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

    logService.logTerminal('INFO', 'CHECKMARK', 'Seeder', 'Seeded default Ollama models (chat + embedding) in ai_models table.');
}

/**
 * Seeds default matching dimensions into the database.
 * Creates 5 default dimensions: core_competencies, experience, soft_skills, domain_knowledge, cultural_fit.
 * 
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seedDimensions(db) {
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

    logService.logTerminal('INFO', 'CHECKMARK', 'Seeder', 'Seeded default 5 dimensions in dimensions table.');
}

/**
 * Seeds default blueprints into the database.
 * Creates "Employment Match" blueprint with singular/plural labels.
 * Links to all 5 dimensions.
 * 
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seedBlueprints(db) {
    const existing = db.prepare('SELECT COUNT(*) as count FROM entity_blueprints').get();
    if (existing.count > 0) {
        return;
    }

    const dimensions = db.prepare('SELECT id FROM dimensions').all();
    if (dimensions.length === 0) {
        logService.logTerminal('WARN', 'WARNING', 'Seeder', 'No dimensions found, skipping blueprint seeding.');
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
        insertField.run(blueprintId, field.field_name, field.field_type, field.description, field.is_required, 'requirement');
    }

    const offeringFields = [
        { field_name: 'name', field_type: 'string', description: 'Extract the full personal name of the candidate.', is_required: 1 },
        { field_name: 'email', field_type: 'string', description: 'Extract the primary email address.', is_required: 1 },
        { field_name: 'phone', field_type: 'string', description: 'Extract the phone number.', is_required: 0 },
        { field_name: 'linkedinUrl', field_type: 'string', description: 'Extract the LinkedIn profile URL.', is_required: 0 }
    ];

    for (const field of offeringFields) {
        insertField.run(blueprintId, field.field_name, field.field_type, field.description, field.is_required, 'offering');
    }

    for (const dim of dimensions) {
        insertDimension.run(blueprintId, dim.id);
    }

    logService.logTerminal('INFO', 'CHECKMARK', 'Seeder', 'Seeded default blueprint (Employment Match) with Job Listing/Candidate fields.');
}

/**
 * Seeds default settings into the database.
 * Populates default application configurations including auto_merge_threshold and log_ai_interactions.
 * The log_ai_interactions setting is disabled by default ('false') and controls whether AI prompts
 * and responses are captured in System Logs for debugging match quality.
 * This function is idempotent - calling multiple times produces the same result.
 * 
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seedSettings(db) {
    const existing = db.prepare('SELECT COUNT(*) as count FROM settings').get();
    if (existing.count > 0) {
        return;
    }

    const defaultSettings = [
        { key: 'auto_merge_threshold', value: '0.95' },
        { key: 'minimum_match_floor', value: '0.50' },
        { key: 'perfect_match_score', value: '0.85' },
        { key: 'log_ai_interactions', value: 'false' }
    ];

    const stmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
    `);

    for (const setting of defaultSettings) {
        stmt.run(setting.key, setting.value);
    }

    logService.logTerminal('INFO', 'CHECKMARK', 'Seeder', 'Seeded default settings (auto_merge_threshold, minimum_match_floor, perfect_match_score) in settings table.');
}

/**
 * Runs all seed functions in the correct order.
 * This function should be called AFTER initializeSchema() completes.
 * 
 * @param {Database} db - The active database connection instance.
 * @returns {void}
 */
function seed(db) {
    seedAiModels(db);
    seedDimensions(db);
    seedBlueprints(db);
    seedSettings(db);
}

module.exports = {
    seed,
    seedAiModels,
    seedDimensions,
    seedBlueprints,
    seedSettings
};
