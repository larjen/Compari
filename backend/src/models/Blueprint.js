/**
 * @class Blueprint
 * @description Domain Model representing an Entity Blueprint.
 * * @responsibility
 * - Encapsulates the data structure for entity blueprints (e.g., "Employment Match").
 * - Provides static factory methods to map database rows to objects.
 * - Provides serialization methods (`toJSON`) for API responses.
 * * @boundary_rules
 * - ❌ MUST NOT contain Active Record logic (e.g., no `this.save()` that calls the DB).
 * - ❌ MUST NOT require or import Repositories, Services, or the Database.
 * - ✅ Pure data object; strictly for structure and transformation.
 */
class Blueprint {
    /**
     * Creates a new Blueprint instance.
     * @constructor
     * @param {Object} data - The blueprint data.
     * @param {number|null} [data.id] - The blueprint ID.
     * @param {string} [data.name] - The blueprint name.
     * @param {string} [data.requirementLabelSingular] - The singular label for requirement entities.
     * @param {string} [data.requirementLabelPlural] - The plural label for requirement entities.
     * @param {string} [data.offeringLabelSingular] - The singular label for offering entities.
     * @param {string} [data.offeringLabelPlural] - The plural label for offering entities.
     * @param {string|null} [data.requirementDocTypeLabel] - The document type guidance label for requirements.
     * @param {string|null} [data.offeringDocTypeLabel] - The document type guidance label for offerings.
     * @param {string|null} [data.description] - The blueprint description.
     * @param {boolean} [data.isActive] - Whether the blueprint is active.
     * @param {string|null} [data.createdAt] - Creation timestamp.
     * @param {string|null} [data.updatedAt] - Last update timestamp.
     * @param {Array} [data.fields] - Associated BlueprintField objects.
     * @param {Array} [data.dimensions] - Associated dimension objects.
     */
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || null;
        this.requirementLabelSingular = data.requirementLabelSingular || null;
        this.requirementLabelPlural = data.requirementLabelPlural || null;
        this.offeringLabelSingular = data.offeringLabelSingular || null;
        this.offeringLabelPlural = data.offeringLabelPlural || null;
        this.requirementDocTypeLabel = data.requirementDocTypeLabel || null;
        this.offeringDocTypeLabel = data.offeringDocTypeLabel || null;
        this.description = data.description || null;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.createdAt = data.createdAt || null;
        this.updatedAt = data.updatedAt || null;
        this.fields = data.fields || [];
        this.dimensions = data.dimensions || [];
    }

    /**
     * Creates a Blueprint instance from a database row.
     * @static
     * @param {Object} row - The SQLite row object.
     * @returns {Blueprint}
     */
    static fromRow(row) {
        if (!row) return null;

        return new Blueprint({
            id: row.id,
            name: row.name,
            requirementLabelSingular: row.requirement_label_singular,
            requirementLabelPlural: row.requirement_label_plural,
            offeringLabelSingular: row.offering_label_singular,
            offeringLabelPlural: row.offering_label_plural,
            requirementDocTypeLabel: row.requirement_doc_type_label,
            offeringDocTypeLabel: row.offering_doc_type_label,
            description: row.description,
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            fields: row.fields || [],
            dimensions: row.dimensions || []
        });
    }

    /**
     * Converts the model to a JSON-ready object for API responses.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            requirementLabelSingular: this.requirementLabelSingular,
            requirementLabelPlural: this.requirementLabelPlural,
            offeringLabelSingular: this.offeringLabelSingular,
            offeringLabelPlural: this.offeringLabelPlural,
            requirementDocTypeLabel: this.requirementDocTypeLabel,
            offeringDocTypeLabel: this.offeringDocTypeLabel,
            description: this.description,
            is_active: this.isActive,
            created_at: this.createdAt,
            updated_at: this.updatedAt,
            fields: this.fields.map(f => f.toJSON ? f.toJSON() : f),
            dimensions: this.dimensions
        };
    }
}

module.exports = Blueprint;
