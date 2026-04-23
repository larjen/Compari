/**
 * @module DimensionRepo
 * @description Data Access Layer for the dimensions table.
 * @responsibility
 * - Executes all SQL CRUD queries related to dimension configuration.
 * - Maps raw SQLite rows into dimension objects.
 * - Extends BaseRepository for common CRUD operations.
 * @boundary_rules
 * - ❌ MUST NOT contain business rules or workflow logic.
 * - ❌ MUST NOT emit events.
 * - ❌ MUST NOT interact with the file system or AI.
 */

const BaseRepository = require('./BaseRepository');

/**
 * @class DimensionRepo
 * @description Repository for dimension configuration CRUD operations.
 * @extends BaseRepository
 */
class DimensionRepo extends BaseRepository {
    /**
     * Creates a new DimensionRepo instance.
     * @constructor
     * @param {Object} deps - Dependencies object.
     * @param {Object} deps.db - The database instance.
     */
    constructor({ db }) {
        super('dimensions', { db });
    }

    /**
     * Retrieves only active dimensions (where is_active = 1).
     * This is the primary method used for extraction workflows.
     * @method getActiveDimensions
     * @returns {Array<Object>} Array of active dimension objects.
     */
    getActiveDimensions() {
        const stmt = this.db.prepare('SELECT * FROM dimensions WHERE is_active = 1');
        const rows = stmt.all();

        return rows.map(row => this._mapRow(row));
    }

    /**
     * Retrieves a single dimension by its ID with custom column mapping.
     * @method getDimensionById
     * @param {number} id - The dimension ID.
     * @returns {Object|null} Dimension object or null if not found.
     */
    getDimensionById(id) {
        const row = super.findById(id);
        return this._mapRow(row);
    }

    /**
     * Retrieves a single dimension by its unique name.
     * @method getDimensionByName
     * @param {string} name - The dimension name (e.g., 'core_competencies').
     * @returns {Object|null} Dimension object or null if not found.
     */
    getDimensionByName(name) {
        const stmt = this.db.prepare('SELECT * FROM dimensions WHERE name = ?');
        const row = stmt.get(name);

        return this._mapRow(row);
    }

    /**
     * Creates a new dimension.
     * @method createDimension
     * @param {Object} dimensionDto - The dimension DTO object.
     * @param {string} dimensionDto.name - The unique dimension name.
     * @param {string} dimensionDto.displayName - The display-friendly name.
     * @param {string} dimensionDto.requirementInstruction - The instruction for extracting from requirement entities.
     * @param {string} dimensionDto.offeringInstruction - The instruction for extracting from offering entities.
     * @param {boolean} [dimensionDto.isActive=true] - Whether the dimension is active.
     * @param {number} [dimensionDto.weight=1.0] - The dimension weight.
     * @returns {number} The ID of the newly created dimension.
     */
    createDimension(dimensionDto) {
        const { name, displayName, requirementInstruction, offeringInstruction, isActive = true, weight = 1.0 } = dimensionDto;
        const stmt = this.db.prepare(`
            INSERT INTO dimensions (name, display_name, requirement_instruction, offering_instruction, is_active, weight)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(name, displayName, requirementInstruction, offeringInstruction, isActive ? 1 : 0, weight);
        return result.lastInsertRowid;
    }

    /**
     * Updates an existing dimension.
     * @method updateDimension
     * @param {number} id - The dimension ID to update.
     * @param {Object} dimensionDto - The dimension DTO with updates.
     * @returns {boolean} True if the dimension was updated, false if not found.
     */
    updateDimension(id, dimensionDto) {
        const updates = [];
        const values = [];

        const fieldMap = {
            displayName: 'display_name',
            requirementInstruction: 'requirement_instruction',
            offeringInstruction: 'offering_instruction',
            isActive: 'is_active',
            weight: 'weight'
        };

        for (const [dtoKey, columnName] of Object.entries(fieldMap)) {
            const value = dimensionDto[dtoKey];
            if (value !== undefined) {
                updates.push(`${columnName} = ?`);
                if (dtoKey === 'isActive') {
                    values.push(value ? 1 : 0);
                } else {
                    values.push(value);
                }
            }
        }

        if (updates.length === 0) {
            return false;
        }

        values.push(id);
        const stmt = this.db.prepare(`UPDATE dimensions SET ${updates.join(', ')} WHERE id = ?`);
        const result = stmt.run(...values);
        return result.changes > 0;
    }

    /**
     * Activates or deactivates a dimension.
     * @method setDimensionActive
     * @param {number} id - The dimension ID.
     * @param {boolean} isActive - The new active status.
     * @returns {boolean} True if updated, false if not found.
     */
    setDimensionActive(id, isActive) {
        const stmt = this.db.prepare('UPDATE dimensions SET is_active = ? WHERE id = ?');
        const result = stmt.run(isActive ? 1 : 0, id);
        return result.changes > 0;
    }

    /**
     * Retrieves all dimensions from the database.
     * @method getAllDimensions
     * @returns {Array<Object>} Array of all dimension objects.
     */
    getAllDimensions() {
        const rows = super.findAll();
        return rows.map(row => this._mapRow(row));
    }

    /**
     * Maps a database row to a dimension object.
     * @method _mapRow
     * @private
     * @param {Object} row - The database row.
     * @returns {Object|null} Dimension object or null if row is null/undefined.
     */
    _mapRow(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            displayName: row.display_name,
            requirementInstruction: row.requirement_instruction,
            offeringInstruction: row.offering_instruction,
            isActive: row.is_active === 1,
            weight: row.weight ?? 1.0
        };
    }
}

module.exports = DimensionRepo;