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
 */
const eventService = require('./EventService');
const { APP_EVENTS } = require('../config/constants');

class BlueprintService {
    constructor({
        blueprintRepo
    } = {}) {
        this._blueprintRepo = blueprintRepo;
    }

    get _repo() {
        if (!this._blueprintRepo) {
            this._blueprintRepo = require('../repositories/BlueprintRepo');
        }
        return this._blueprintRepo;
    }

    /**
     * Retrieves all blueprints, optionally filtered by role.
     * @method getAllBlueprints
     * @param {string|null} [role] - Optional role filter ('source' or 'target').
     * @returns {Array<Object>} Array of Blueprint objects.
     */
    getAllBlueprints(role) {
        return this._repo.getAllBlueprints(role);
    }

    /**
     * Retrieves a single blueprint by ID with all associated fields and dimensions.
     * This method aggregates the base blueprint with its related data.
     * @method getBlueprintById
     * @param {number} id - The blueprint ID.
     * @returns {Object|null} The aggregated blueprint object with fields and dimensions, or null if not found.
     */
    getBlueprintById(id) {
        return this._repo.getBlueprintById(id);
    }

    /**
     * Creates a new blueprint with fields and dimension links atomically.
     * @method createBlueprint
     * @param {string} name - The blueprint name.
     * @param {string} requirementLabelSingular - The singular label for requirement (e.g., "Job Listing").
     * @param {string} requirementLabelPlural - The plural label for requirement (e.g., "Job Listings").
     * @param {string} offeringLabelSingular - The singular label for offering (e.g., "Candidate").
     * @param {string} offeringLabelPlural - The plural label for offering (e.g., "Candidates").
     * @param {string|null} requirementDocTypeLabel - The document type guidance label for requirements.
     * @param {string|null} offeringDocTypeLabel - The document type guidance label for offerings.
     * @param {string|null} [description] - The blueprint description.
     * @param {Array<Object>} fields - Array of field objects {fieldName, fieldType, description, isRequired, entityRole}.
     * @param {Array<number>} dimensionIds - Array of dimension IDs to link.
     * @returns {number} The ID of the newly created blueprint.
     */
    createBlueprint(name, requirementLabelSingular, requirementLabelPlural, offeringLabelSingular, offeringLabelPlural, requirementDocTypeLabel, offeringDocTypeLabel, description, fields, dimensionIds) {
        const blueprintData = {
            name,
            requirementLabelSingular,
            requirementLabelPlural,
            offeringLabelSingular,
            offeringLabelPlural,
            requirementDocTypeLabel,
            offeringDocTypeLabel,
            description,
            isActive: false // Ensures new blueprints are inactive by default
        };

        const blueprintId = this._repo.createBlueprint(blueprintData, fields, dimensionIds);
        
        eventService.emit(APP_EVENTS.BLUEPRINT_UPDATE, { timestamp: Date.now() });
        
        return blueprintId;
    }

    /**
     * Updates an existing blueprint, replacing its fields and dimension links.
     * Delegates to BlueprintRepo for database operations.
     * @method updateBlueprint
     * @param {number} id - The blueprint ID to update.
     * @param {Object} updates - The blueprint updates (name, requirementLabelSingular, requirementLabelPlural, offeringLabelSingular, offeringLabelPlural, requirementDocTypeLabel, offeringDocTypeLabel, description, isActive).
     * @param {Array<Object>} fields - New array of field objects to replace existing fields.
     * @param {Array<number>} dimensionIds - New array of dimension IDs to replace existing links.
     * @returns {void}
     */
    updateBlueprint(id, updates, fields, dimensionIds) {
        this._repo.updateBlueprint(id, updates, fields, dimensionIds);
        eventService.emit(APP_EVENTS.BLUEPRINT_UPDATE, { timestamp: Date.now() });
    }

    /**
     * Sets a blueprint as the active one (exclusive active blueprint).
     * @method setActiveBlueprint
     * @param {number} id - The blueprint ID to set as active.
     * @returns {void}
     */
    setActiveBlueprint(id) {
        this._repo.setActiveBlueprint(id);
        eventService.emit(APP_EVENTS.BLUEPRINT_UPDATE, { timestamp: Date.now() });
    }

    /**
     * Deletes a blueprint by ID.
     * @method deleteBlueprint
     * @param {number} id - The blueprint ID to delete.
     * @returns {void}
     */
    deleteBlueprint(id) {
        this._repo.deleteBlueprint(id);
        eventService.emit(APP_EVENTS.BLUEPRINT_UPDATE, { timestamp: Date.now() });
    }
}

module.exports = new BlueprintService();