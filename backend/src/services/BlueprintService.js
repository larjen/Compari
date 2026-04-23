/**
 * @module BlueprintService
 * @description Domain Service orchestration for Blueprint lifecycle.
 *
 * @responsibility
 * - Acts as the generic API for creating, updating, and retrieving blueprints.
 * - Handles aggregation of blueprint fields and dimensions.
 * - Wraps BlueprintRepo to abstract database concepts.
 *
 * @boundary_rules
 * - ✅ MAY call Infrastructure Services (EventService) for domain events.
 * - ❌ MUST NOT handle HTTP request/response objects directly.
 * - ❌ MUST NOT contain business rules or workflow logic.
 *
 * @socexplanation
 * - This service provides a high-level API for blueprint management, aggregating data from the repository layer.
 * - It ensures that domain events are emitted consistently after blueprint mutations.
 *
 * @dependency_injection
 * Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
 */
const { APP_EVENTS, HTTP_STATUS } = require('../config/constants');

class BlueprintService {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.blueprintRepo - The BlueprintRepo instance
     * @param {Object} deps.eventService - The EventService instance
     * @dependency_injection Dependencies are injected strictly via the constructor. Defensive getters are not required as instantiation guarantees dependency presence.
     */
    constructor({ blueprintRepo, eventService }) {
        this._blueprintRepo = blueprintRepo;
        this._eventService = eventService;
    }

    /**
     * Retrieves all blueprints, optionally filtered by role.
     * @method getAllBlueprints
     * @param {string|null} [role] - Optional role filter ('source' or 'target').
     * @returns {Array<Object>} Array of Blueprint objects.
     */
    getAllBlueprints(role) {
        return this._blueprintRepo.getAllBlueprints(role);
    }

    /**
     * Retrieves a single blueprint by ID with all associated fields and dimensions.
     * This method aggregates the base blueprint with its related data.
     * @method getBlueprintById
     * @param {number} id - The blueprint ID.
     * @returns {Object|null} The aggregated blueprint object with fields and dimensions, or null if not found.
     */
    getBlueprintById(id) {
        return this._blueprintRepo.getBlueprintById(id);
    }

    /**
     * Creates a new blueprint with fields and dimension links atomically.
     * @method createBlueprint
     * @param {Object} dto - Data Transfer Object containing blueprint creation data.
     * @param {Object} dto.blueprintDto - The blueprint DTO containing name, requirementLabelSingular, requirementLabelPlural, offeringLabelSingular, offeringLabelPlural, requirementDocTypeLabel, offeringDocTypeLabel, description.
     * @param {Array<Object>} dto.fields - Array of field objects {fieldName, fieldType, description, isRequired, entityRole}.
     * @param {Array<number>} dto.dimensionIds - Array of dimension IDs to link.
     * @returns {number} The ID of the newly created blueprint.
     */
    createBlueprint({ blueprintDto, fields, dimensionIds }) {
        const blueprintData = {
            ...blueprintDto,
            isActive: false
        };

        const blueprintId = this._blueprintRepo.createBlueprint({ blueprintData, fieldsData: fields, dimensionIds });

        this._eventService.emit(APP_EVENTS.BLUEPRINT_UPDATE, { timestamp: Date.now() });

        return blueprintId;
    }

    /**
     * Updates an existing blueprint, replacing its fields and dimension links.
     * Delegates to BlueprintRepo for database operations.
     * @method updateBlueprint
     * @param {Object} blueprintUpdateDto - The DTO containing the blueprint update data
     * @param {number} blueprintUpdateDto.id - The blueprint ID to update
     * @param {Object} blueprintUpdateDto.blueprintDto - The blueprint DTO containing name, requirementLabelSingular, requirementLabelPlural, offeringLabelSingular, offeringLabelPlural, requirementDocTypeLabel, offeringDocTypeLabel, description, isActive
     * @param {Array<Object>} blueprintUpdateDto.fields - New array of field objects to replace existing fields
     * @param {Array<number>} blueprintUpdateDto.dimensionIds - New array of dimension IDs to replace existing links
     * @returns {void}
     */
    updateBlueprint({ id, blueprintDto, fields, dimensionIds }) {
        this._blueprintRepo.updateBlueprint(id, { blueprintDto, fieldsData: fields, dimensionIds });
        this._eventService.emit(APP_EVENTS.BLUEPRINT_UPDATE, { timestamp: Date.now() });
    }

    /**
     * Sets a blueprint as the active one (exclusive active blueprint).
     * @method setActiveBlueprint
     * @param {number} id - The blueprint ID to set as active.
     * @returns {void}
     */
    setActiveBlueprint(id) {
        this._blueprintRepo.setActiveBlueprint(id);
        this._eventService.emit(APP_EVENTS.BLUEPRINT_UPDATE, { timestamp: Date.now() });
    }

    getActiveBlueprint() {
        return this._blueprintRepo.getActiveBlueprint();
    }

    /**
     * Deletes a blueprint by ID.
     * Validates that the blueprint is not active before deletion.
     * @method deleteBlueprint
     * @param {number} id - The blueprint ID to delete.
     * @throws {Error} If the blueprint is active and cannot be deleted.
     */
    deleteBlueprint(id) {
        const blueprint = this._blueprintRepo.getBlueprintById(id);
        if (!blueprint) {
            return;
        }

        if (blueprint.isActive) {
            const error = new Error('Cannot delete the active blueprint. Please set another blueprint as active first.');
            error.statusCode = HTTP_STATUS.BAD_REQUEST;
            error.status = HTTP_STATUS.BAD_REQUEST;
            throw error;
        }

        this._blueprintRepo.deleteBlueprint(id);
        this._eventService.emit(APP_EVENTS.BLUEPRINT_UPDATE, { timestamp: Date.now() });
    }
}

module.exports = BlueprintService;