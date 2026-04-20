/**
 * OfferingEntity - Domain Model representing an Offering (Candidate CV) in Class Table Inheritance (CTI) architecture.
 * Extends BaseEntity with candidate offering-specific attributes.
 * Maps to the offerings table in the database.
 *
 * @class OfferingEntity
 * @extends BaseEntity
 * @property {string|null} cvPath - Path to the CV document file
 */
class OfferingEntity extends require('./BaseEntity') {
    constructor(data = {}) {
        super(data);
    }

    /**
     * Converts the entity to a JSON-serializable object
     * @returns {object} JSON representation of the entity
     */
    toJSON() {
        return {
            ...super.toJSON()
        };
    }
}

module.exports = OfferingEntity;