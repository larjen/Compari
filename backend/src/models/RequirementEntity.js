/**
 * RequirementEntity - Domain Model representing a Requirement in Class Table Inheritance (CTI) architecture.
 * Extends BaseEntity with job requirement-specific attributes.
 * Maps to the requirements table in the database.
 *
 * @class RequirementEntity
 * @extends BaseEntity
 * @property {string|null} jobUrl - URL to the original job posting
 * @property {Date|null} deadline - Application deadline for the job
 */
class RequirementEntity extends require('./BaseEntity') {
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

module.exports = RequirementEntity;