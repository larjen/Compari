/**
 * @file schema.sql
 * @description Database schema initialization SQL.
 *
 * This file contains all CREATE TABLE statements required to initialize the
 * SQLite database schema. It is loaded by Database.js during server startup.
 *
 * Uses Class Table Inheritance (CTI) pattern:
 * - entities_base: Shared attributes for all entity types
 * - entities_requirement: Specific attributes for requirement entities
 * - entities_offering: Specific attributes for offering entities
 * - entities_criterion: Specific attributes for criterion entities
 * - entities_match: Match relationship table
 *
 * Note: The 'status' column in 'entities_base' and 'entities_match' tables maps to ENTITY_STATUS constants.
 */

CREATE TABLE IF NOT EXISTS entities_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ({{ENTITY_TYPE_LIST}})),
    nicename TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    nice_name_line_1 TEXT DEFAULT 'Unknown',
    nice_name_line_2 TEXT DEFAULT 'Unknown',
    folder_path TEXT UNIQUE,
    master_file TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ({{ENTITY_STATUS_LIST}})),
    is_busy INTEGER DEFAULT 0 CHECK(is_busy IN (0, 1)),
    metadata TEXT,
    error TEXT,
    blueprint_id INTEGER,
    hash TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blueprint_id) REFERENCES entity_blueprints(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_base_entities_type ON entities_base(entity_type);
CREATE INDEX IF NOT EXISTS idx_base_entities_status ON entities_base(status);
CREATE INDEX IF NOT EXISTS idx_base_entities_hash ON entities_base(hash);

CREATE TABLE IF NOT EXISTS entities_criterion (
    entity_id INTEGER PRIMARY KEY,
    dimension TEXT NOT NULL DEFAULT 'Uncategorized',
    embedding TEXT,
    FOREIGN KEY (entity_id) REFERENCES entities_base(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entities_match (
    entity_id INTEGER PRIMARY KEY,
    requirement_id INTEGER NOT NULL,
    offering_id INTEGER NOT NULL,
    match_score REAL,
    report_path TEXT,
    FOREIGN KEY (entity_id) REFERENCES entities_base(id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES entities_base(id) ON DELETE CASCADE,
    FOREIGN KEY (offering_id) REFERENCES entities_base(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matches_requirement ON entities_match(requirement_id);
CREATE INDEX IF NOT EXISTS idx_matches_offering ON entities_match(offering_id);

CREATE TABLE IF NOT EXISTS entity_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    criterion_id INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT 1,
    FOREIGN KEY (entity_id) REFERENCES entities_base(id) ON DELETE CASCADE,
    FOREIGN KEY (criterion_id) REFERENCES entities_base(id) ON DELETE CASCADE,
    UNIQUE(entity_id, criterion_id)
);

CREATE TABLE IF NOT EXISTS criterion_merge_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keep_id INTEGER NOT NULL,
    merged_display_name TEXT NOT NULL,
    merged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (keep_id) REFERENCES entities_base(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_criteria_entity ON entity_criteria(entity_id);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities_base(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    attempts INTEGER DEFAULT 0,
    available_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME
);

CREATE TABLE IF NOT EXISTS ai_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    model_identifier TEXT NOT NULL,
    api_url TEXT,
    api_key TEXT,
    role TEXT NOT NULL DEFAULT 'chat',
    is_active INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    temperature REAL DEFAULT 0.1,
    context_window INTEGER DEFAULT 8192,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dimensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    requirement_instruction TEXT NOT NULL,
    offering_instruction TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    is_active BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS entity_blueprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    requirement_label_singular TEXT NOT NULL,
    requirement_label_plural TEXT NOT NULL,
    offering_label_singular TEXT NOT NULL,
    offering_label_plural TEXT NOT NULL,
    requirement_doc_type_label TEXT,
    offering_doc_type_label TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blueprint_metadata_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blueprint_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK(field_type IN ('string', 'date', 'number', 'boolean')),
    description TEXT NOT NULL,
    is_required BOOLEAN DEFAULT 0,
    entity_role TEXT NOT NULL CHECK(entity_role IN ('requirement', 'offering')),
    FOREIGN KEY (blueprint_id) REFERENCES entity_blueprints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blueprint_dimensions (
    blueprint_id INTEGER NOT NULL,
    dimension_id INTEGER NOT NULL,
    FOREIGN KEY (blueprint_id) REFERENCES entity_blueprints(id) ON DELETE CASCADE,
    FOREIGN KEY (dimension_id) REFERENCES dimensions(id) ON DELETE CASCADE,
    UNIQUE(blueprint_id, dimension_id)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_name TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    prompt TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);