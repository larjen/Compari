/**
 * @class BlueprintField
 * @description Domain Model representing a metadata field definition within a Blueprint.
 * * @responsibility
 * - Encapsulates the data structure for blueprint metadata fields.
 * - Provides static factory methods to map database rows to objects.
 * - Provides serialization methods (`toJSON`) for API responses.
 * * @boundary_rules
 * - ❌ MUST NOT contain Active Record logic (e.g., no `this.save()` that calls the DB).
 * - ❌ MUST NOT require or import Repositories, Services, or the Database.
 * - ✅ Pure data object; strictly for structure and transformation.
 */
class BlueprintField {
    /**
     * Creates a new BlueprintField instance.
     * @constructor
     * @param {Object} data - The field data.
     * @param {number|null} [data.id] - The field ID.
     * @param {number|null} [data.blueprintId] - The blueprint ID this field belongs to.
     * @param {string} [data.fieldName] - The field name/key.
     * @param {string} [data.fieldType] - The field type ('string', 'date', 'number', 'boolean').
     * @param {string} [data.description] - AI extraction instruction/description.
     * @param {boolean} [data.isRequired] - Whether the field is required.
     * @param {string} [data.entityRole] - The entity role ('requirement' or 'offering') this field belongs to.
     */
    constructor(data = {}) {
        this.id = data.id || null;
        this.blueprintId = data.blueprintId || null;
        this.fieldName = data.fieldName || null;
        this.fieldType = data.fieldType || 'string';
        this.description = data.description || null;
        this.isRequired = data.isRequired !== undefined ? data.isRequired : false;
        this.entityRole = data.entityRole || null;
    }

    /**
     * Creates a BlueprintField instance from a database row.
     * @static
     * @param {Object} row - The SQLite row object.
     * @returns {BlueprintField}
     */
    static fromRow(row) {
        if (!row) return null;

        return new BlueprintField({
            id: row.id,
            blueprintId: row.blueprint_id,
            fieldName: row.field_name,
            fieldType: row.field_type,
            description: row.description,
            // FIX: Explicitly cast SQLite integer (1/0) to strict boolean
            isRequired: Boolean(row.is_required),
            entityRole: row.entity_role
        });
    }

    /**
     * Converts the model to a JSON-ready object for API responses.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            blueprint_id: this.blueprintId,
            field_name: this.fieldName,
            field_type: this.fieldType,
            description: this.description,
            is_required: this.isRequired,
            entity_role: this.entityRole
        };
    }
}

module.exports = BlueprintField;