/**
 * MatchEntity - Domain Model representing a Match between Requirement and Offering in Class Table Inheritance (CTI) architecture.
 * Extends BaseEntity with match-specific attributes.
 * Maps to the matches table in the database.
 *
 * @class MatchEntity
 * @extends BaseEntity
 * @property {number|null} requirementId - Foreign key to the associated requirement
 * @property {number|null} offeringId - Foreign key to the associated offering
 * @property {number|null} matchScore - Calculated match score between requirement and offering
 * @property {string|null} reportPath - Virtual property populated from the documents table
 */
class MatchEntity extends require('./BaseEntity') {
    constructor(data = {}) {
        super(data);
        this.requirementId = data.requirementId || data.requirement_id || null;
        this.offeringId = data.offeringId || data.offering_id || null;
        this.matchScore = data.matchScore !== undefined ? data.matchScore : data.match_score;
        this.reportPath = data.reportPath || data.report_path || null;
    }

    /**
     * Converts the entity to a JSON-serializable object
     * @returns {object} JSON representation of the entity
     */
    toJSON() {
        return {
            ...super.toJSON(),
            requirementId: this.requirementId,
            offeringId: this.offeringId,
            matchScore: this.matchScore,
            reportPath: this.reportPath
        };
    }
}

module.exports = MatchEntity;