/**
 * @file schema.sql
 * @description Database schema initialization SQL.
 * 
 * This file contains all CREATE TABLE statements required to initialize the
 * SQLite database schema. It is loaded by Database.js during server startup.
 * 
 * Tables include: entities, entity_matches, criteria, entity_criteria,
 * activity_logs, system_logs, documents, job_queue, ai_models, dimensions,
 * entity_blueprints, blueprint_metadata_fields, blueprint_dimensions,
 * criterion_merge_history, and settings.
 * 
 * Note: The 'status' column in 'entities' table maps to ENTITY_STATUS constants.
 * The legacy 'queue_status' column has been removed - use 'status' for all entity states.
 */

CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    folder_path TEXT,
    metadata TEXT,
    -- status column: single source of truth for entity processing state
    -- Must conform to ENTITY_STATUS constants (pending, processing, completed, failed)
    status TEXT DEFAULT 'pending',
    error TEXT,
    processing_file_name TEXT,
    blueprint_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blueprint_id) REFERENCES entity_blueprints(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);

CREATE TABLE IF NOT EXISTS entity_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement_id INTEGER NOT NULL,
    offering_id INTEGER NOT NULL,
    match_score REAL,
    report_path TEXT,
    folder_path TEXT,
    -- queue_status kept for entity_matches as it's a different entity type
    queue_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'pending',
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requirement_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (offering_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_matches_requirement ON entity_matches(requirement_id);
CREATE INDEX IF NOT EXISTS idx_entity_matches_offering ON entity_matches(offering_id);

CREATE TABLE IF NOT EXISTS criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    normalized_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    dimension TEXT NOT NULL DEFAULT 'Uncategorized',
    embedding TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    criterion_id INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT 1,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (criterion_id) REFERENCES criteria(id) ON DELETE CASCADE,
    UNIQUE(entity_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_criteria_entity ON entity_criteria(entity_id);

CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    log_type TEXT NOT NULL,
    message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    log_type TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    link_name TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    FOREIGN KEY (match_id) REFERENCES entity_matches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
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

CREATE TABLE IF NOT EXISTS criterion_merge_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keep_id INTEGER NOT NULL,
    merged_display_name TEXT NOT NULL,
    merged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (keep_id) REFERENCES criteria(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);