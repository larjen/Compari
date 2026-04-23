/**
 * @module BlueprintRepo
 * @description Data Access Layer for blueprint tables.
 * * @responsibility
 * - Executes all SQL CRUD queries related to entity blueprints, metadata fields, and dimension links.
 * - Maps raw SQLite rows into Blueprint and BlueprintField Model instances.
 * * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events (e.g., no `EventService.emit()`).
 * - ❌ MUST NOT interact with the file system or AI.
 * - ❌ This layer ONLY handles database operations.
 */

const BaseRepository = require('./BaseRepository');
const Blueprint = require('../models/Blueprint');
const BlueprintField = require('../models/BlueprintField');
const { ENTITY_TYPES } = require('../config/constants');

/**
 * @class BlueprintRepo
 * @extends BaseRepository
 * @description Repository for blueprint CRUD operations.
 */
class BlueprintRepo extends BaseRepository {
    /**
     * Creates a new BlueprintRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     */
    constructor({ db }) {
        super('entity_blueprints', { db });
    }
    /**
     * Retrieves all blueprints with their associated fields and dimensions.
     * @method getAllBlueprints
     * @returns {Array<Blueprint>} Array of Blueprint instances.
     * @why_not_base - Requires JOINs with blueprint_metadata_fields and blueprint_dimensions tables,
     *                 plus Blueprint model mapping with nested fields/dimensions.
     */
    getAllBlueprints() {
        const stmt = this.db.prepare('SELECT * FROM entity_blueprints ORDER BY id DESC');
        const rows = stmt.all();

        return rows.map(row => {
            const blueprint = Blueprint.fromRow(row);
            blueprint.fields = this.getBlueprintFields(blueprint.id);
            blueprint.dimensions = this.getBlueprintDimensions(blueprint.id);
            return blueprint;
        });
    }

    /**
     * Retrieves a single blueprint by ID with its fields and dimensions.
     * @method getBlueprintById
     * @param {number} id - The blueprint ID.
     * @returns {Blueprint|null} The Blueprint instance or null if not found.
     * @why_not_base - Requires JOINs with blueprint_metadata_fields and blueprint_dimensions tables,
     *                 plus Blueprint model mapping with nested fields/dimensions.
     */
    getBlueprintById(id) {
        const stmt = this.db.prepare('SELECT * FROM entity_blueprints WHERE id = ?');
        const row = stmt.get(id);
        if (!row) return null;

        const blueprint = Blueprint.fromRow(row);
        blueprint.fields = this.getBlueprintFields(id);
        blueprint.dimensions = this.getBlueprintDimensions(id);
        return blueprint;
    }

    /**
     * Retrieves metadata fields for a blueprint, optionally filtered by entity role.
     * @method getBlueprintFields
     * @param {number} blueprintId - The blueprint ID.
     * @param {string|null} [entityRole] - Optional filter ('source' or 'target').
     * @returns {Array<BlueprintField>} Array of BlueprintField instances.
     * @why_not_base - Queries separate blueprint_metadata_fields table with optional filter.
     */
    getBlueprintFields(blueprintId, entityRole = null) {
        let stmt;
        if (entityRole) {
            stmt = this.db.prepare('SELECT * FROM blueprint_metadata_fields WHERE blueprint_id = ? AND entity_role = ? ORDER BY id ASC');
            const rows = stmt.all(blueprintId, entityRole);
            return rows.map(row => BlueprintField.fromRow(row));
        }
        stmt = this.db.prepare('SELECT * FROM blueprint_metadata_fields WHERE blueprint_id = ? ORDER BY id ASC');
        const rows = stmt.all(blueprintId);
        return rows.map(row => BlueprintField.fromRow(row));
    }

    /**
     * Retrieves all dimensions linked to a blueprint.
     * @method getBlueprintDimensions
     * @param {number} blueprintId - The blueprint ID.
     * @returns {Array<Object>} Array of dimension objects with camelCase properties.
     * @why_not_base - Requires JOIN between blueprint_dimensions and dimensions tables.
     */
    getBlueprintDimensions(blueprintId) {
        const stmt = this.db.prepare(`
            SELECT d.id, d.name, d.display_name, d.requirement_instruction, d.offering_instruction, d.is_active
            FROM blueprint_dimensions bd
            JOIN dimensions d ON bd.dimension_id = d.id
            WHERE bd.blueprint_id = ?
            ORDER BY d.id ASC
        `);
        const rows = stmt.all(blueprintId);
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            displayName: row.display_name,
            requirementInstruction: row.requirement_instruction,
            offeringInstruction: row.offering_instruction,
            isActive: row.is_active === 1
        }));
    }

    /**
     * Creates a new blueprint with its fields and dimension links atomically.
     * Uses a transaction to ensure all inserts succeed or fail together.
     * @method createBlueprint
     * @param {Object} dto - Data Transfer Object containing blueprint creation data.
     * @param {Object} dto.blueprintData - The blueprint DTO (name, requirementLabelSingular, requirementLabelPlural, offeringLabelSingular, offeringLabelPlural, requirementDocTypeLabel, offeringDocTypeLabel, description, isActive).
     * @param {Array<Object>} dto.fieldsData - Array of field objects {fieldName, fieldType, description, isRequired, entityRole}.
     * @param {Array<number>} dto.dimensionIds - Array of dimension IDs to link.
     * @returns {number} The ID of the newly created blueprint.
     * @why_not_base - Complex transaction involving INSERT into 3 tables (entity_blueprints,
     *                 blueprint_metadata_fields, blueprint_dimensions) and returns lastInsertRowid.
     */
    createBlueprint({ blueprintData, fieldsData, dimensionIds }) {
        return this.db.transaction(() => {
            const insertBlueprint = this.db.prepare(`
                INSERT INTO entity_blueprints (name, requirement_label_singular, requirement_label_plural, offering_label_singular, offering_label_plural, requirement_doc_type_label, offering_doc_type_label, description, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const info = insertBlueprint.run(
                blueprintData.name,
                blueprintData.requirementLabelSingular,
                blueprintData.requirementLabelPlural,
                blueprintData.offeringLabelSingular,
                blueprintData.offeringLabelPlural,
                blueprintData.requirementDocTypeLabel || null,
                blueprintData.offeringDocTypeLabel || null,
                blueprintData.description || null,
                blueprintData.isActive !== undefined ? (blueprintData.isActive ? 1 : 0) : 0
            );
            const blueprintId = info.lastInsertRowid;

            const insertField = this.db.prepare(`
                INSERT INTO blueprint_metadata_fields (blueprint_id, field_name, field_type, description, is_required, entity_role)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            for (const field of fieldsData) {
                insertField.run(
                    blueprintId,
                    field.fieldName,
                    field.fieldType || 'string',
                    field.description,
                    field.isRequired ? 1 : 0,
                    field.entityRole
                );
            }

            const insertDimension = this.db.prepare(`
                INSERT INTO blueprint_dimensions (blueprint_id, dimension_id)
                VALUES (?, ?)
            `);
            for (const dimensionId of dimensionIds) {
                insertDimension.run(blueprintId, dimensionId);
            }

            return blueprintId;
        })();
    }

    /**
     * Updates an existing blueprint with new fields and dimension links.
     * Uses a transaction to ensure atomic updates.
     * @method updateBlueprint
     * @param {number} id - The blueprint ID to update.
     * @param {Object} updateDto - The update data transfer object.
     * @param {Object} updateDto.blueprintDto - The blueprint DTO (name, requirementLabelSingular, requirementLabelPlural, offeringLabelSingular, offeringLabelPlural, requirementDocTypeLabel, offeringDocTypeLabel, description, isActive).
     * @param {Array<Object>} updateDto.fieldsData - Array of field objects {fieldName, fieldType, description, isRequired, entityRole}.
     * @param {Array<number>} updateDto.dimensionIds - Array of dimension IDs to link.
     * @returns {void}
     * @why_not_base - Complex transaction with UPDATE and DELETE/INSERT across 3 tables.
     */
    updateBlueprint(id, updateDto) {
        const { blueprintDto, fieldsData, dimensionIds } = updateDto;
        return this.db.transaction(() => {
            if (blueprintDto.isActive) {
                this.db.prepare('UPDATE entity_blueprints SET is_active = 0').run();
            }

            const stmt = this.db.prepare(`
                UPDATE entity_blueprints
                SET name = ?, requirement_label_singular = ?, requirement_label_plural = ?, offering_label_singular = ?, offering_label_plural = ?, requirement_doc_type_label = ?, offering_doc_type_label = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            stmt.run(
                blueprintDto.name,
                blueprintDto.requirementLabelSingular,
                blueprintDto.requirementLabelPlural,
                blueprintDto.offeringLabelSingular,
                blueprintDto.offeringLabelPlural,
                blueprintDto.requirementDocTypeLabel || null,
                blueprintDto.offeringDocTypeLabel || null,
                blueprintDto.description,
                blueprintDto.isActive ? 1 : 0,
                id
            );

            this.db.prepare('DELETE FROM blueprint_metadata_fields WHERE blueprint_id = ?').run(id);
            this.db.prepare('DELETE FROM blueprint_dimensions WHERE blueprint_id = ?').run(id);

            if (fieldsData && fieldsData.length > 0) {
                const insertField = this.db.prepare(`
                    INSERT INTO blueprint_metadata_fields (blueprint_id, field_name, field_type, description, is_required, entity_role)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                for (const field of fieldsData) {
                    insertField.run(
                        id,
                        field.fieldName,
                        field.fieldType || 'string',
                        field.description,
                        field.isRequired ? 1 : 0,
                        field.entityRole || ENTITY_TYPES.REQUIREMENT
                    );
                }
            }

            if (dimensionIds && dimensionIds.length > 0) {
                const insertDimension = this.db.prepare(`
                    INSERT INTO blueprint_dimensions (blueprint_id, dimension_id)
                    VALUES (?, ?)
                `);
                for (const dimensionId of dimensionIds) {
                    insertDimension.run(id, dimensionId);
                }
            }
        })();
}

    /**
     * Sets a blueprint as the active one using a transaction.
     * Deactivates all blueprints first, then activates the specified one.
     * @method setActiveBlueprint
     * @param {number} id - The blueprint ID to set as active.
     * @returns {void}
     * @why_not_base - Uses transaction to update multiple rows (is_active toggle).
     */
    setActiveBlueprint(id) {
        return this.db.transaction(() => {
            this.db.prepare('UPDATE entity_blueprints SET is_active = 0').run();
            this.db.prepare('UPDATE entity_blueprints SET is_active = 1 WHERE id = ?').run(id);
        })();
    }

    getActiveBlueprint() {
        const stmt = this.db.prepare('SELECT * FROM entity_blueprints WHERE is_active = 1 LIMIT 1');
        const row = stmt.get();
        if (!row) return null;
        return this.getBlueprintById(row.id);
    }
}

module.exports = BlueprintRepo;