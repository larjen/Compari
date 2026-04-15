/**
 * @module AIReportGenerator
 * @description Transforms raw matching engine output into structured JSON schemas optimized for LLM summarization.
 *
 * @responsibility
 * - Generates normalized JSON structures with context (requirement/offering info) and analysis (match details).
 * - Preserves granular distinction between perfectMatch, partialMatch, and missedMatch arrays.
 * - Formats match strings to provide maximum context for downstream LLM processing.
 *
 * @boundary_rules
 * - ✅ MUST be a pure function module - no side effects, no database calls, no external services.
 * - ❌ MUST NOT handle logging or persistence.
 * - ❌ MUST NOT have knowledge of databases or external services.
 *
 * @target_schema
 * {
 *   "context": {
 *     "requirement_name": "String",
 *     "offering_name": "String",
 *     "match_score": "Number"
 *   },
 *   "analysis": {
 *     "type": "String ('general' or 'dimension')",
 *     "name": "String",
 *     "weight": "Number",
 *     "perfect_matches": ["Array of Strings"],
 *     "partial_matches": ["Array of Strings"],
 *     "missing_requirements": ["Array of Strings"]
 *   }
 * }
 *
 * @notes
 * - The rawComparison object contains reportInfo (with names, scores, weights) and groups matches into
 *   perfectMatch, partialMatch, and missedMatch arrays based on FLOOR and PERFECT settings.
 * - Perfect matches indicate criteria fully satisfied by the offering.
 * - Partial matches indicate criteria partially satisfied (below perfect threshold but above floor).
 * - Missing requirements are criteria with no matching offering content.
 * - This structure preserves granularity to give downstream LLM maximum context for summarization.
 */

/**
 * Formats a single match object into a descriptive string for LLM consumption.
 * 
 * This helper enables DRY principles by centralizing match string formatting logic.
 * The formatted strings provide clear context about what was required vs what was offered,
 * which helps the downstream LLM understand the nature of each match type.
 * 
 * @param {Object} match - A match object from perfectMatch, partialMatch, or missedMatch arrays.
 * @param {string} match.reqCriteria - The requirement criteria string.
 * @param {string} [match.offCriteria] - The offering criteria string (present for perfect/partial matches).
 * @returns {string} Formatted string describing the match relationship.
 * 
 * @format_rules
 * - Perfect/Partial match (has offCriteria): "Required: '[reqCriteria]' -> Candidate has: '[offCriteria]'"
 * - Missed match (no offCriteria): "[reqCriteria]" (just the requirement criteria)
 */
function _formatMatch(match) {
    if (!match || !match.reqCriteria) {
        return '';
    }

    if (match.offCriteria !== null && match.offCriteria !== undefined) {
        return `Required: '${match.reqCriteria}' -> Candidate has: '${match.offCriteria}'`;
    }

    return match.reqCriteria;
}

/**
 * Transforms raw comparison data into a structured general report for LLM summarization.
 * Dynamically collects matches from all dimensions to feed the LLM a global view,
 * injecting the mathematical formula breakdown for context.
 *
 * @param {Object} rawComparison - The raw comparison object from MatchingEngine.
 * @returns {Object} Structured report matching the target JSON schema.
 */
function generateGeneralAiReport(rawComparison) {
    if (!rawComparison) {
        return {
            context: { requirement_name: null, offering_name: null, match_score: null },
            analysis: { type: "general", name: "overall_summary", weight: 1.0, perfect_matches: [], partial_matches: [], missing_requirements: [] }
        };
    }

    const reportInfo = rawComparison.reportInfo || {};
    const requirementName = reportInfo.requirement?.name || null;
    const offeringName = reportInfo.offering?.name || null;
    const matchScore = reportInfo.metrics?.score !== undefined ? reportInfo.metrics.score : 0;

    const perfectMatches = [];
    const partialMatches = [];
    const missingRequirements = [];

    // Dynamically collect matches from all dimensions to feed the LLM a global view
    const keysToSkip = ['reportInfo'];
    for (const [key, value] of Object.entries(rawComparison)) {
        if (keysToSkip.includes(key) || !value || typeof value !== 'object') continue;
        
        if (value.perfectMatch) perfectMatches.push(...value.perfectMatch.map(_formatMatch).filter(Boolean));
        if (value.partialMatch) partialMatches.push(...value.partialMatch.map(_formatMatch).filter(Boolean));
        if (value.missedMatch) missingRequirements.push(...value.missedMatch.map(_formatMatch).filter(Boolean));
    }

    return {
        context: {
            requirement_name: requirementName,
            offering_name: offeringName,
            match_score: matchScore,
            formula_breakdown: reportInfo.metrics?.formula || null // Give the LLM access to the formula
        },
        analysis: {
            type: "general",
            name: "overall_summary",
            weight: 1.0,
            perfect_matches: perfectMatches,
            partial_matches: partialMatches,
            missing_requirements: missingRequirements
        }
    };
}

/**
 * Transforms raw comparison data into dimension-specific structured reports for LLM summarization.
 * 
 * Iterates over each dimension key (excluding reportInfo and allDimensions), extracting dimension-specific
 * scores, weights, and match arrays. Each dimension report maintains the same schema structure as the
 * general report, enabling consistent LLM processing across all analysis levels.
 * 
 * @param {Object} rawComparison - The raw comparison object from MatchingEngine with grouped structure.
 * @param {Object} rawComparison.reportInfo - Contains overall score and metadata.
 * @param {Object} rawComparison[dimensionKey].metrics - Contains dimension-specific score and weight.
 * @returns {Object} Object keyed by dimension name, each value being a structured report with type "dimension".
 * 
 * @target_structure
 * {
 *   [dimensionKey]: {
 *     "context": { "requirement_name": "...", "offering_name": "...", "match_score": "..." },
 *     "analysis": {
 *       "type": "dimension",
 *       "name": "dimensionKey",
 *       "weight": "Number",
 *       "perfect_matches": ["Array of formatted Strings"],
 *       "partial_matches": ["Array of formatted Strings"],
 *       "missing_requirements": ["Array of requirement Strings"]
 *     }
 *   }
 * }
 * 
 * @example
 * const dimensionalReports = generateDimensionalAiReports(rawComparison);
 * // Returns { core_competencies: {...}, soft_skills: {...}, technical_skills: {...} }
 * 
 * @dry_principles
 * - Uses _formatMatch helper to avoid duplicating match formatting logic across dimensions.
 * - Dynamically iterates over dimension keys to avoid hardcoding dimension names.
 * - Reuses the same schema structure as generateGeneralAiReport for consistent LLM processing.
 * 
 * @null_safety
 * - Handles null/undefined rawComparison gracefully, returning empty object.
 * - Falls back to score 0 and weight 1.0 for dimensions not found in metrics.
 * - Skips non-object values and dimension keys in the skip list.
 */
function generateDimensionalAiReports(rawComparison) {
    if (!rawComparison) {
        return {};
    }

    const reportInfo = rawComparison.reportInfo || {};
    const requirement = reportInfo.requirement || {};
    const offering = reportInfo.offering || {};
    const requirementName = requirement.name || null;
    const offeringName = offering.name || null;

    const result = {};
    const keysToSkip = ['reportInfo', 'allDimensions'];

    for (const [key, value] of Object.entries(rawComparison)) {
        if (keysToSkip.includes(key)) {
            continue;
        }

        if (!value || typeof value !== 'object') {
            continue;
        }

        const dimensionMetrics = value.metrics || {};
        const dimensionScore = dimensionMetrics.score !== undefined ? dimensionMetrics.score : 0;
        const dimensionWeight = dimensionMetrics.weights !== undefined ? dimensionMetrics.weights : 1.0;

        const perfectMatch = value.perfectMatch || [];
        const partialMatch = value.partialMatch || [];
        const missedMatch = value.missedMatch || [];

        const perfectMatches = perfectMatch.map(_formatMatch).filter(Boolean);
        const partialMatches = partialMatch.map(_formatMatch).filter(Boolean);
        const missingRequirements = missedMatch.map(_formatMatch).filter(Boolean);

        result[key] = {
            context: {
                requirement_name: requirementName,
                offering_name: offeringName,
                match_score: dimensionScore
            },
            analysis: {
                type: "dimension",
                name: key,
                weight: dimensionWeight,
                perfect_matches: perfectMatches,
                partial_matches: partialMatches,
                missing_requirements: missingRequirements
            }
        };
    }

    return result;
}

module.exports = { generateGeneralAiReport, generateDimensionalAiReports };