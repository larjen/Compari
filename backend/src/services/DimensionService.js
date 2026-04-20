/**
 * @module DimensionService
 * @description Domain Service for Dimension operations.
 * @responsibility
 * - Wraps DimensionRepo to provide dimension data to controllers.
 * - Provides business logic for creating, updating, and deleting dimensions.
 * @boundary_rules
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */

class DimensionService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.dimensionRepo - The DimensionRepo instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ dimensionRepo }) {
        this._dimensionRepo = dimensionRepo;
    }

    /**
     * Retrieves all active dimensions.
     * @method getActiveDimensions
     * @returns {Array<Object>} Array of active dimension objects.
     */
    getActiveDimensions() {
        return this._dimensionRepo.getActiveDimensions();
    }

    /**
     * Retrieves all dimensions.
     * @method getAllDimensions
     * @returns {Array<Object>} Array of all dimension objects.
     */
    getAllDimensions() {
        return this._dimensionRepo.getAllDimensions();
    }

    /**
     * Retrieves a single dimension by ID.
     * @method getDimensionById
     * @param {number} id - The dimension ID.
     * @returns {Object|null} Dimension object or null if not found.
     */
    getDimensionById(id) {
        return this._dimensionRepo.getDimensionById(id);
    }

    /**
     * Creates a new dimension.
     * @method createDimension
     * @param {Object} dimensionDto - The dimension DTO object containing all dimension properties.
     * @param {string} dimensionDto.name - The unique dimension name (system key).
     * @param {string} dimensionDto.displayName - The display-friendly name.
     * @param {string} dimensionDto.requirementInstruction - The instruction for requirement entities.
     * @param {string} dimensionDto.offeringInstruction - The instruction for offering entities.
     * @param {boolean} [dimensionDto.isActive=true] - Whether the dimension is active.
     * @param {number} [dimensionDto.weight=1.0] - The dimension weight.
     * @returns {number} The ID of the newly created dimension.
     */
    createDimension(dimensionDto) {
        return this._dimensionRepo.createDimension(dimensionDto);
    }

    /**
     * Updates an existing dimension.
     * @method updateDimension
     * @param {number} id - The dimension ID to update.
     * @param {Object} dimensionDto - The dimension DTO with updates.
     * @param {string} [dimensionDto.displayName] - The new display name.
     * @param {string} [dimensionDto.requirementInstruction] - The new requirement instruction.
     * @param {string} [dimensionDto.offeringInstruction] - The new offering instruction.
     * @param {boolean} [dimensionDto.isActive] - The new active status.
     * @param {number} [dimensionDto.weight] - The new weight.
     * @returns {boolean} True if updated, false if not found.
     */
    updateDimension(id, dimensionDto) {
        return this._dimensionRepo.updateDimension(id, dimensionDto);
    }

    /**
     * Deletes a dimension by ID.
     * @method deleteDimension
     * @param {number} id - The dimension ID to delete.
     * @returns {boolean} True if deleted, false if not found.
     */
    deleteDimension(id) {
        return this._dimensionRepo.deleteById(id) ? true : false;
    }

    /**
     * Sets the active status of a dimension.
     * @method setDimensionActive
     * @param {number} id - The dimension ID.
     * @param {boolean} isActive - The new active status.
     * @returns {boolean} True if updated, false if not found.
     */
    setDimensionActive(id, isActive) {
        return this._dimensionRepo.setDimensionActive(id, isActive);
    }
}

module.exports = DimensionService;