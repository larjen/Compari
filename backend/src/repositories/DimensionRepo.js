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

const db = require('./Database');
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
     */
    constructor() {
        super('dimensions');
    }

    /**
     * Retrieves only active dimensions (where is_active = 1).
     * This is the primary method used for extraction workflows.
     * @method getActiveDimensions
     * @returns {Array<Object>} Array of active dimension objects.
     */
    getActiveDimensions() {
        const stmt = db.prepare('SELECT * FROM dimensions WHERE is_active = 1');
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
        const stmt = db.prepare('SELECT * FROM dimensions WHERE name = ?');
        const row = stmt.get(name);

        return this._mapRow(row);
    }

    /**
     * Creates a new dimension.
     * @method createDimension
     * @param {string} name - The unique dimension name.
     * @param {string} displayName - The display-friendly name.
     * @param {string} requirementInstruction - The instruction for extracting from requirement entities.
     * @param {string} offeringInstruction - The instruction for extracting from offering entities.
     * @param {boolean} [isActive=true] - Whether the dimension is active.
     * @returns {number} The ID of the newly created dimension.
     */
    createDimension(name, displayName, requirementInstruction, offeringInstruction, isActive = true, weight = 1.0) {
        const stmt = db.prepare(`
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
     * @param {Object} updates - The updates to apply.
     * @param {string} [updates.displayName] - The new display name.
     * @param {string} [updates.requirementInstruction] - The new requirement instruction.
     * @param {string} [updates.offeringInstruction] - The new offering instruction.
     * @param {boolean} [updates.isActive] - The new active status.
     * @returns {boolean} True if the dimension was updated, false if not found.
     */
    updateDimension(id, { displayName, requirementInstruction, offeringInstruction, isActive, weight }) {
        const updates = [];
        const values = [];

        if (displayName !== undefined) {
            updates.push('display_name = ?');
            values.push(displayName);
        }
        if (requirementInstruction !== undefined) {
            updates.push('requirement_instruction = ?');
            values.push(requirementInstruction);
        }
        if (offeringInstruction !== undefined) {
            updates.push('offering_instruction = ?');
            values.push(offeringInstruction);
        }
        if (isActive !== undefined) {
            updates.push('is_active = ?');
            values.push(isActive ? 1 : 0);
        }
        if (weight !== undefined) {
            updates.push('weight = ?');
            values.push(weight);
        }

        if (updates.length === 0) {
            return false;
        }

        values.push(id);
        const stmt = db.prepare(`UPDATE dimensions SET ${updates.join(', ')} WHERE id = ?`);
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
        const stmt = db.prepare('UPDATE dimensions SET is_active = ? WHERE id = ?');
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

module.exports = new DimensionRepo();