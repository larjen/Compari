/**
 * @module DimensionService
 * @description Domain Service for Dimension operations.
 * @responsibility
 * - Wraps DimensionRepo to provide dimension data to controllers.
 * - Provides business logic for creating, updating, and deleting dimensions.
 * @boundary_rules
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 */
const dimensionRepo = require('../repositories/DimensionRepo');

class DimensionService {
    /**
     * Retrieves all active dimensions.
     * @method getActiveDimensions
     * @returns {Array<Object>} Array of active dimension objects.
     */
    getActiveDimensions() {
        return dimensionRepo.getActiveDimensions();
    }

    /**
     * Retrieves all dimensions.
     * @method getAllDimensions
     * @returns {Array<Object>} Array of all dimension objects.
     */
    getAllDimensions() {
        return dimensionRepo.getAllDimensions();
    }

    /**
     * Retrieves a single dimension by ID.
     * @method getDimensionById
     * @param {number} id - The dimension ID.
     * @returns {Object|null} Dimension object or null if not found.
     */
    getDimensionById(id) {
        return dimensionRepo.getDimensionById(id);
    }

    /**
     * Creates a new dimension.
     * @method createDimension
     * @param {string} name - The unique dimension name (system key).
     * @param {string} displayName - The display-friendly name.
     * @param {string} requirementInstruction - The instruction for requirement entities.
     * @param {string} offeringInstruction - The instruction for offering entities.
     * @param {boolean} [isActive=true] - Whether the dimension is active.
     * @returns {number} The ID of the newly created dimension.
     */
    createDimension(name, displayName, requirementInstruction, offeringInstruction, isActive = true, weight = 1.0) {
        return dimensionRepo.createDimension(name, displayName, requirementInstruction, offeringInstruction, isActive, weight);
    }

    /**
     * Updates an existing dimension.
     * @method updateDimension
     * @param {number} id - The dimension ID to update.
     * @param {Object} updates - The updates to apply.
     * @param {string} [updates.displayName] - The new display name.
     * @param {string} [updates.description] - The new description.
     * @param {boolean} [updates.isActive] - The new active status.
     * @returns {boolean} True if updated, false if not found.
     */
    updateDimension(id, updates) {
        return dimensionRepo.updateDimension(id, updates);
    }

    /**
     * Deletes a dimension by ID.
     * @method deleteDimension
     * @param {number} id - The dimension ID to delete.
     * @returns {boolean} True if deleted, false if not found.
     */
    deleteDimension(id) {
        return dimensionRepo.deleteById(id) ? true : false;
    }

    /**
     * Sets the active status of a dimension.
     * @method setDimensionActive
     * @param {number} id - The dimension ID.
     * @param {boolean} isActive - The new active status.
     * @returns {boolean} True if updated, false if not found.
     */
    setDimensionActive(id, isActive) {
        return dimensionRepo.setDimensionActive(id, isActive);
    }
}

module.exports = new DimensionService();