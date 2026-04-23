/**
 * @module MatchingEngine
 * @description Pure mathematical engine for criteria matching using semantic vector similarity.
 *
 * @responsibility
 * - Performs semantic vector comparisons between requirement and offering criteria.
 * - Calculates match scores, dimensional breakdowns, and identifies missing/bonus criteria.
 *
 * @boundary_rules
 * - ❌ MUST NOT contain database calls or AI services.
 * - ❌ MUST NOT have knowledge of databases or external services.
 *
 * @socexplanation
 * Error handling was refactored to explicitly catch and log data corruption/math failures
 * via injected LogService, eliminating silent failures while maintaining graceful degradation.
 */

const { cosineSimilarity } = require('./VectorMath');

/**
 * @class MatchingEngine
 * @description Pure mathematical engine for semantic vector similarity matching.
 */
class MatchingEngine {
    /**
     * @constructor
     * @param {Object} deps - Dependencies object
     * @param {Object} deps.logService - The LogService instance for logging failures
     */
    constructor({ logService }) {
        this._logService = logService;
    }

    /**
     * Calculates scaled points for a match score using a sliding scale.
     * @public
     * @param {number} score - The raw cosine similarity score (0.0 to 1.0).
     * @param {number} minimumFloor - The minimum threshold to score any points.
     * @param {number} perfectScore - The threshold to score maximum points.
     * @returns {number} The scaled points (0.0 to 1.0).
     * @mathematical_reasoning
     * - Scores below the minimumFloor receive 0 points.
     * - Scores between minimumFloor and perfectScore receive partial, proportional credit.
     * - Scores at or above perfectScore are capped at 1.0 (100% credit).
     * - Enforces a single source of truth for match scoring across both fast-evaluations and full reports.
     */
    calculateScaledPoints(score, minimumFloor, perfectScore) {
        if (score < minimumFloor) return 0;
        let rawPoints = (score - minimumFloor) / (perfectScore - minimumFloor);
        return Math.min(rawPoints, 1.0);
    }

    /**
     * Pure vector math function that calculates similarity score between two criteria embeddings.
     * Bypasses the heavy JSON report generation for fast chunked evaluations.
     * @public
     * @param {number[]} reqVector - The requirement criterion embedding vector.
     * @param {number[]} offVector - The offering criterion embedding vector.
     * @returns {number} The similarity score (0 to 1).
     *
     * @architectural_reasoning
     * - This is a lightweight function for chunked evaluations that don't need the full JSON report.
     * - It directly computes cosine similarity without any side effects or logging.
     * - Returns raw similarity between vectors; caller can apply weighted scoring.
     */
    evaluateCriteriaPair(reqVector, offVector) {
        if (!reqVector || !offVector || !Array.isArray(reqVector) || !Array.isArray(offVector)) {
            return 0;
        }

        if (reqVector.length === 0 || offVector.length === 0) {
            return 0;
        }

        try {
            const similarity = cosineSimilarity(reqVector, offVector);
            return Math.max(0, Math.min(1, similarity));
        } catch (err) {
            if (this._logService) {
                this._logService.logSystemFault({ origin: 'MatchingEngine', message: 'Vector math/evaluation failed', errorObj: err });
            }
            return 0;
        }
    }

    /**
     * Fast aggregate scorer that calculates weighted match score between requirement and offering criteria.
     * @description
     * To guarantee 100% score parity with the final Match Report, this function now routes
     * directly through the report generation engine (buildRawComparison). It builds a
     * lightweight report in memory and extracts the final weighted score.
     * @public
     * @param {Object} evaluationDto - The evaluation DTO containing all required data.
     * @param {Object} evaluationDto.criteria - The criteria objects.
     * @param {Array<Object>} evaluationDto.criteria.requirementCriteria - Array of requirement criterion objects.
     * @param {Array<Object>} evaluationDto.criteria.offeringCriteria - Array of offering criterion objects.
     * @param {Array<Object>} evaluationDto.activeDimensions - Array of dimension objects.
     * @param {Object} evaluationDto.matchSettings - Settings object containing minimumFloor and perfectScore.
     * @param {number} [evaluationDto.matchSettings.minimumFloor=0.50] - Minimum similarity threshold.
     * @param {number} [evaluationDto.matchSettings.perfectScore=0.85] - Perfect similarity threshold.
     * @returns {number} The final weighted match score (0 to 1), rounded to 4 decimal places.
     */
    calculateFastMatchScore(evaluationDto) {
        const { criteria, activeDimensions, matchSettings } = evaluationDto || {};
        const requirementCriteria = criteria?.requirementCriteria;
        const offeringCriteria = criteria?.offeringCriteria;

        if (!requirementCriteria || !Array.isArray(requirementCriteria) || requirementCriteria.length === 0) {
            return 0;
        }
        if (!offeringCriteria || !Array.isArray(offeringCriteria) || offeringCriteria.length === 0) {
            return 0;
        }
        if (!activeDimensions || !Array.isArray(activeDimensions) || activeDimensions.length === 0) {
            return 0;
        }

        const rawComparison = this.buildRawComparison({
            entities: {
                requirement: { id: 0, name: 'fast_req' },
                offering: { id: 0, name: 'fast_off' }
            },
            criteria: {
                requirementCriteria,
                offeringCriteria
            },
            activeDimensions,
            matchSettings
        });

        return rawComparison?.reportInfo?.metrics?.score || 0;
    }

    /**
     * SoC: This is a pure mathematical engine responsible for semantic matching.
     * It remains agnostic of database models or AI extraction workflows.
     *
     * Calculates criteria match score between requirement and offering criteria using semantic vector similarity.
     * Returns a rich data object containing the overall score AND dimensional breakdown.
     * @public
     * @param {Array<Object>} requirementCriteria - Array of requirement criterion objects with embedding, displayName, normalizedName, dimension.
     * @param {Array<Object>} offeringCriteria - Array of offering criterion objects with embedding, displayName, normalizedName, dimension.
     * @param {Object} [options={}] - Optional settings for match thresholds.
     * @param {number} [options.perfectScore=0.85] - Threshold for strong/perfect matches.
     * @param {number} [options.minimumFloor=0.50] - Minimum threshold for partial matches.
     * @returns {Object} Object containing score, globalMetrics, and dimensional breakdown.
     * @throws {Error} If requirement or offering criteria arrays are empty.
     *
     * @return_structure
     * {
     *   score: number,
     *   globalMetrics: { total, strong, partial, missing, achievedPoints },
     *   dimensions: {
     *     [dimKey]: {
     *       score: number|null,
     *       metrics: { requiredMet: number, requiredTotal: number },
     *       matched: [{ targetCriterion: string, sourceCriterion: string, similarity: number }],
     *       matchedStrong: [{ targetCriterion: string, sourceCriterion: string, similarity: number }],
     *       matchedPartial: [{ targetCriterion: string, sourceCriterion: string, similarity: number }],
     *       missingRequired: [string],
     *       bonus: [string]
     *     }
     *   }
     * }
     */
    calculate(requirementCriteria, offeringCriteria, { perfectScore = 0.85, minimumFloor = 0.50 } = {}) {
        if (!requirementCriteria || requirementCriteria.length === 0) {
            throw new Error('Requirement entity has no criteria to match with.');
        }

        if (!offeringCriteria || offeringCriteria.length === 0) {
            throw new Error('Offering entity has no criteria to match against.');
        }

        const allDims = new Set([
            ...requirementCriteria.map(c => c.dimension || 'uncategorized'),
            ...offeringCriteria.map(c => c.dimension || 'uncategorized')
        ]);

        const dimensionsResult = {};
        for (const dim of allDims) {
            dimensionsResult[dim] = {
                score: null,
                metrics: { requiredMet: 0, requiredTotal: 0 },
                matched: [],
                matchedStrong: [],
                matchedPartial: [],
                missingRequired: [],
                bonus: []
            };
        }

        const offeringPool = offeringCriteria;
        const consumedIds = new Set();

        const globalMetrics = {
            total: requirementCriteria.length,
            strong: 0,
            partial: 0,
            missing: 0,
            achievedPoints: 0
        };

        for (const req of requirementCriteria) {
            const reqDim = req.dimension || 'uncategorized';
            const reqDimResult = dimensionsResult[reqDim];

            if (!req.embedding || !Array.isArray(req.embedding) || req.embedding.length === 0) {
                reqDimResult.missingRequired.push({ id: req.id, label: req.displayName || req.normalizedName });
                reqDimResult.metrics.requiredTotal++;
                globalMetrics.missing++;
                continue;
            }

            let bestMatch = null;
            let bestSimilarity = -1;
            let bestOfferingId = null;

            for (const offering of offeringPool) {
                if (consumedIds.has(offering.id)) {
                    continue;
                }

                const similarity = this.evaluateCriteriaPair(req.embedding, offering.embedding);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        targetId: req.id,
                        targetCriterion: req.displayName || req.normalizedName,
                        sourceId: offering.id,
                        sourceCriterion: offering.displayName || offering.normalizedName,
                        similarity: similarity
                    };
                    bestOfferingId = offering.id;
                }
            }

            reqDimResult.metrics.requiredTotal++;

            if (bestMatch && bestSimilarity >= minimumFloor) {
                reqDimResult.matched.push(bestMatch);

                if (bestSimilarity >= perfectScore) {
                    reqDimResult.matchedStrong.push(bestMatch);
                    reqDimResult.metrics.requiredMet++;
                    globalMetrics.strong++;
                    globalMetrics.achievedPoints += 1;
                } else {
                    reqDimResult.matchedPartial.push(bestMatch);
                    reqDimResult.metrics.requiredMet++;
                    globalMetrics.partial++;
                    globalMetrics.achievedPoints += 0.5;
                }

                if (bestOfferingId) {
                    consumedIds.add(bestOfferingId);
                }
            } else {
                reqDimResult.missingRequired.push({ id: req.id, label: req.displayName || req.normalizedName });
                globalMetrics.missing++;
            }
        }

        for (const offering of offeringPool) {
            if (!consumedIds.has(offering.id)) {
                const offeringDim = offering.dimension || 'uncategorized';
                dimensionsResult[offeringDim].bonus.push({ id: offering.id, label: offering.displayName || offering.normalizedName });
            }
        }

        for (const dim of allDims) {
            const dimResult = dimensionsResult[dim];
            const reqCount = dimResult.metrics.requiredTotal;
            const metCount = dimResult.metrics.requiredMet;

            if (reqCount > 0) {
                dimResult.score = Number((metCount / reqCount).toFixed(4));
            }
        }

        const score = globalMetrics.total > 0
            ? Number((globalMetrics.achievedPoints / globalMetrics.total).toFixed(4))
            : 0;

        return {
            score,
            globalMetrics: {
                total: globalMetrics.total,
                strong: globalMetrics.strong,
                partial: globalMetrics.partial,
                missing: globalMetrics.missing
            },
            dimensions: dimensionsResult
        };
    }

    /**
     * Helper function to group matches into semantic categories based on similarity scores.
     *
     * @param {Array<Object>} matchesArray - Flat array of match objects with similarityScore and offCriteria properties.
     * @param {number} minFloor - Minimum similarity threshold for partial matches.
     * @param {number} perfScore - Perfect similarity threshold for perfect matches.
     * @returns {Object} Grouped matches object with perfectMatch, partialMatch, and missedMatch arrays.
     *
     * @return_structure
     * {
     *   perfectMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number }],
     *   partialMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number }],
     *   missedMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number }]
     * }
     */
    groupMatches(matchesArray, minFloor, perfScore) {
        const perfectMatch = [];
        const partialMatch = [];
        const missedMatch = [];

        if (!matchesArray || !Array.isArray(matchesArray)) {
            return { perfectMatch, partialMatch, missedMatch };
        }

        for (const match of matchesArray) {
            const score = match.similarityScore || 0;
            const hasOffCriteria = match.offCriteria !== null && match.offCriteria !== undefined;

            if (score >= perfScore) {
                perfectMatch.push(match);
            } else if (score >= minFloor && hasOffCriteria) {
                partialMatch.push(match);
            } else {
                missedMatch.push(match);
            }
        }

        return { perfectMatch, partialMatch, missedMatch };
    }

    /**
     * Performs semantic matching for a single dimension by comparing requirement criteria
     * against offering criteria using cosine similarity on embedding vectors.
     *
     * @param {Array<Object>} reqCriteria - Array of requirement criteria for this dimension.
     * @param {Array<Object>} offCriteria - Array of offering criteria for this dimension.
     * @returns {Array<Object>} Sorted array of match objects (descending by similarityScore).
     *
     * @return_structure
     * [{
     *   reqCriteria: string,
     *   reqId: number,
     *   offCriteria: string|null,
     *   offId: number|null,
     *   similarityScore: number,
     *   dimension: string,
     *   dimensionId: number
     * }]
     *
     * @dry_principles
     * - Extracts the repeated matching logic from buildRawComparison's if/else blocks.
     * - Encapsulates the nested loop that finds best matches using cosine similarity.
     * - Returns sorted results (highest similarity first).
     */
    _matchCriteriaForDimension(reqCriteria, offCriteria) {
        const dimMatches = [];

        for (const req of reqCriteria) {
            let bestMatch = null;
            let bestSimilarity = -1;

            if (!req.embedding || !Array.isArray(req.embedding) || req.embedding.length === 0) {
                dimMatches.push({
                    reqCriteria: req.displayName || req.normalizedName,
                    reqId: req.id,
                    offCriteria: null,
                    offId: null,
                    similarityScore: 0,
                    dimension: req.dimension || 'uncategorized',
                    dimensionId: req.dimensionId || req.dimension_id || 0
                });
                continue;
            }

            for (const off of offCriteria) {
                const similarity = this.evaluateCriteriaPair(req.embedding, off.embedding);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        reqCriteria: req.displayName || req.normalizedName,
                        reqId: req.id,
                        offCriteria: off.displayName || off.normalizedName,
                        offId: off.id,
                        similarityScore: Number(similarity.toFixed(2)),
                        dimension: req.dimension || 'uncategorized',
                        dimensionId: req.dimensionId || req.dimension_id || 0
                    };
                }
            }

            if (bestMatch) {
                dimMatches.push(bestMatch);
            } else {
                dimMatches.push({
                    reqCriteria: req.displayName || req.normalizedName,
                    reqId: req.id,
                    offCriteria: null,
                    offId: null,
                    similarityScore: 0,
                    dimension: req.dimension || 'uncategorized',
                    dimensionId: req.dimensionId || req.dimension_id || 0
                });
            }
        }

        dimMatches.sort((a, b) => b.similarityScore - a.similarityScore);
        return dimMatches;
    }

    /**
     * Builds a raw comparison object with requirement and offering entities nested in reportInfo.
     * Contains dimension-specific matches grouped at root level with metrics colocated for LLM readability.
     * Dimensions are sorted descending by similarityScore, and the order matches the activeDimensions array order.
     * Scores are calculated internally using the overloaded calculateWeightedMatchScore function.
     * @public
     * @param {Object} evaluationDto - The evaluation DTO containing all required data.
     * @param {Object} evaluationDto.entities - The entity objects.
     * @param {Object} evaluationDto.entities.requirement - The requirement entity object with id and name.
     * @param {Object} evaluationDto.entities.offering - The offering entity object with id and name.
     * @param {Object} evaluationDto.criteria - The criteria objects.
     * @param {Array<Object>} evaluationDto.criteria.requirementCriteria - Array of requirement criterion objects.
     * @param {Array<Object>} evaluationDto.criteria.offeringCriteria - Array of offering criterion objects.
     * @param {Array<Object>} evaluationDto.activeDimensions - Array of dimension objects with name and weight properties.
     * @param {Object} [evaluationDto.matchSettings] - Settings object containing minimumFloor and perfectScore thresholds. If omitted, defaults to 0.50 and 0.85 respectively.
     * @returns {Object} Object containing unified dimension objects with metrics + matches at root level.
     *
     * @return_structure
     * {
     *   reportInfo: {
     *     offering: { id: number, name: string },
     *     requirement: { id: number, name: string },
     *     overall_score: number,
     *     overall_score_formula: string,
     *     similarityForPerfectMatch: number,
     *     similarityForPartialMatch: number
     *   },
     *   [dimKey]: {
     *     metrics: { score: number, weights: number, matches: number, partialMatches: number, missedMatches: number, calculationDetails: {...} },
     *     perfectMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }],
     *     partialMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }],
     *     missedMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }]
     *   }
     * }
     *
     * @notes
     * - similarityScore is a float between 0.0 and 1.0, rounded to two decimal places.
     * - Metrics are now colocated with matches inside each dimension object for better LLM readability.
     * - activeDimensions is iterated in exact order to maintain settings page ordering.
     * - allDimensions and each dimension array are sorted descending by similarityScore within each group.
     * - The root level contains reportInfo first, then allDimensions, then each dimension key.
     * - Scores are calculated internally using the overloaded calculateWeightedMatchScore function.
     * - tempReport passed to calculateWeightedMatchScore uses flat arrays for scoring compatibility.
     *
     * @dry_principles
     * - Reuses groupMatches helper for both allDimensions and dimensional arrays.
     * - Reuses calculateWeightedMatchScore with targetDimension parameter for both overall and per-dimension scoring.
     * - Builds dimensionWeights from activeDimensions to maintain ordering.
     * - Iterates through activeDimensions in order rather than extracting dimensions dynamically.
     * - Uses _matchCriteriaForDimension helper to eliminate DRY violation in dimension matching loops.
     * - Unifies if/else logic by determining dimension keys first, then iterating with single loop.
     */
    buildRawComparison(evaluationDto) {
        const { entities, criteria, activeDimensions, matchSettings } = evaluationDto || {};
        const requirement = entities?.requirement;
        const offering = entities?.offering;
        const requirementCriteria = criteria?.requirementCriteria;
        const offeringCriteria = criteria?.offeringCriteria;

        const minFloor = matchSettings?.minimumFloor ?? 0.50;
        const perfScore = matchSettings?.perfectScore ?? 0.85;

        const dimensionWeights = {};
        const dimensionDisplayNames = {};

        if (activeDimensions && Array.isArray(activeDimensions)) {
            for (const dim of activeDimensions) {
                dimensionWeights[dim.name] = dim.weight || 1.0;
                dimensionDisplayNames[dim.name] = dim.displayName || dim.name;
            }
        }

        const dimensionalMatches = {};

        if (!requirementCriteria || requirementCriteria.length === 0 || !offeringCriteria || offeringCriteria.length === 0) {
            if (activeDimensions && Array.isArray(activeDimensions)) {
                for (const dim of activeDimensions) {
                    dimensionalMatches[dim.name] = [];
                }
            }
            const emptyReport = {
                reportInfo: {
                    offering: { id: offering.id, name: offering.name },
                    requirement: { id: requirement.id, name: requirement.name },
                    metrics: {
                        score: 0,
                        formula: 'No criteria to match - returning 0%',
                        similarityForPerfectMatch: perfScore,
                        similarityForPartialMatch: minFloor
                    }
                }
            };
            for (const dim of Object.keys(dimensionWeights)) {
                emptyReport[dim] = { metrics: { score: 0, weights: dimensionWeights[dim], matches: 0, partialMatches: 0, missedMatches: 0 }, perfectMatch: [], partialMatch: [], missedMatch: [] };
            }
            return emptyReport;
        }

        const reqDimensionsSet = new Set(requirementCriteria.map(c => c.dimension || 'uncategorized'));

        const dimensionKeysToProcess = (activeDimensions && Array.isArray(activeDimensions))
            ? activeDimensions
                .map(dim => dim.name)
                .filter(dimName => reqDimensionsSet.has(dimName))
            : [...reqDimensionsSet];

        for (const dimKey of dimensionKeysToProcess) {
            const reqCriteriaInDim = requirementCriteria.filter(c => (c.dimension || 'uncategorized') === dimKey);
            const offCriteriaInDim = offeringCriteria.filter(c => (c.dimension || 'uncategorized') === dimKey);

            dimensionalMatches[dimKey] = this._matchCriteriaForDimension(reqCriteriaInDim, offCriteriaInDim);
        }

        const tempReport = {};
        for (const dimKey of Object.keys(dimensionWeights || {})) {
            tempReport[dimKey] = {
                metrics: { weights: dimensionWeights[dimKey] },
                perfectMatch: dimensionalMatches[dimKey] || []
            };
        }

        const matchScores = {};
        const formulaNumerator = [];
        const formulaDenominator = [];
        let totalPossiblePoints = 0;
        let totalAchievedPoints = 0;

        for (const dimKey of Object.keys(dimensionWeights || {})) {
            const matches = dimensionalMatches[dimKey] || [];
            const weight = dimensionWeights[dimKey] || 1.0;
            const totalReqs = matches.length;

            let dimPoints = 0;
            let perfectCount = 0;
            let partialCount = 0;
            let missedCount = 0;
            const matchPoints = [];

            for (const match of matches) {
                const score = match.similarityScore !== undefined ? match.similarityScore : 0;
                const hasOff = match.offCriteria !== null && match.offCriteria !== undefined;

                const scaledPoints = this.calculateScaledPoints(score, minFloor, perfScore);
                dimPoints += scaledPoints;

                const matchMath = `(${score.toFixed(2)} - ${minFloor.toFixed(2)}) / (${perfScore.toFixed(2)} - ${minFloor.toFixed(2)}) = ${scaledPoints.toFixed(2)}`;
                matchPoints.push(matchMath);

                if (score >= perfScore) perfectCount++;
                else if (score >= minFloor && hasOff) partialCount++;
                else missedCount++;
            }

            const dimScoreObj = this.calculateWeightedMatchScore({ matchReport: tempReport, minimumFloor: minFloor, perfectScore: perfScore, targetDimension: dimKey });

            let dimFormula = `No criteria to match.`;
            if (totalReqs > 0) {
                const floorPct = Math.round(minFloor * 100);
                const perfPct = Math.round(perfScore * 100);

                const dimResultDecimal = dimPoints / totalReqs;
                const dimResultPct = Math.round(dimResultDecimal * 100);

                dimFormula = `
 **Scoring Rules (Sliding Scale):** Below ${floorPct}% similarity = 0, Proportional credit between ${floorPct}% and ${perfPct}%, at or above ${perfPct}% similarity = 1
 **Points per match (${totalReqs} total):** ${matchPoints.join(' + ')}
 **Result:** ${Number(dimPoints.toFixed(2))} / ${totalReqs} = ${dimResultDecimal.toFixed(2)} = ${dimResultPct}%
 `.trim();
            }

            matchScores[dimKey] = {
                score: dimScoreObj.score,
                formula: dimFormula,
                weights: weight,
                matches: perfectCount,
                partialMatches: partialCount,
                missedMatches: missedCount
            };

            if (totalReqs > 0) {
                const dimAchieved = dimPoints * weight;
                const dimPossible = totalReqs * weight;
                totalAchievedPoints += dimAchieved;
                totalPossiblePoints += dimPossible;

                const niceName = dimensionDisplayNames[dimKey] || dimKey;

                formulaNumerator.push(`(${niceName}) ${Number(dimPoints.toFixed(2))} × ${weight}`);
                formulaDenominator.push(`(${niceName}) ${totalReqs} × ${weight}`);
            }
        }

        const calculatedOverallScore = totalPossiblePoints > 0 ? Number((totalAchievedPoints / totalPossiblePoints).toFixed(4)) : 0;
        const overallPct = Math.round(calculatedOverallScore * 100);

        const overall_score_formula = `
 **Formula:** Sum(Dimension Points × Weight) / Sum(Total Requirements × Weight)
 **Numerator:** ${formulaNumerator.join(' + ')}
 **Denominator:** ${formulaDenominator.join(' + ')}
 **Result:** ${Number(totalAchievedPoints.toFixed(2))} / ${Number(totalPossiblePoints.toFixed(2))} = ${calculatedOverallScore.toFixed(2)} = ${overallPct}%
 `.trim();

        const finalReport = {
            reportInfo: {
                offering: { id: offering.id, name: offering.name },
                requirement: { id: requirement.id, name: requirement.name },
                metrics: {
                    score: calculatedOverallScore,
                    formula: overall_score_formula,
                    similarityForPerfectMatch: perfScore,
                    similarityForPartialMatch: minFloor
                }
            }
        };

        for (const dim of Object.keys(dimensionWeights || {})) {
            if (dimensionalMatches[dim]) {
                const grouped = this.groupMatches(dimensionalMatches[dim], minFloor, perfScore);

                finalReport[dim] = {
                    metrics: matchScores[dim],
                    perfectMatch: grouped.perfectMatch,
                    partialMatch: grouped.partialMatch,
                    missedMatch: grouped.missedMatch
                };
            }
        }

        return finalReport;
    }

    /**
     * Calculates a weighted overall match percentage from a raw JSON match report.
     * Uses a sliding scale to award partial credit for conceptual matches.
     *
     * This function reads weights from the unified dimension objects (metrics property)
     * and iterates over dimension keys present at the root level of the matchReport.
     *
     * When targetDimension is provided, this function calculates the score for only that specific dimension,
     * enabling targeted dimensional scoring while keeping logic DRY. When targetDimension is null,
     * it calculates the overall score across all dimensions.
     * @public
     * @param {Object} dto - Data Transfer Object containing all configuration for score calculation.
     * @param {Object} dto.matchReport - The parsed match_report.json object with new unified structure.
     * @param {number} [dto.minimumFloor=0.50] - Minimum similarity threshold (as float, e.g., 0.50 for 50%). Below this score earns zero points.
     * @param {number} [dto.perfectScore=0.85] - Perfect similarity threshold (as float, e.g., 0.85 for 85%). At or above this score earns full points.
     * @param {string|null} [dto.targetDimension=null] - Optional dimension key to calculate score for. If a dimension name is provided (e.g., "skills", "experience"), it calculates the score only for that specific dimension. If null, it calculates the overall score across all dimensions.
     * @returns {number} The final match score as a percentage (e.g., 42.5)
     *
     * @architectural_decision
     * Enforces Anti-Parameter Creep policy (ARCHITECTURE.md Section 6). Function accepts 4 parameters
     * which exceeds the 3-parameter threshold, so a single DTO is used instead of positional arguments.
     * This improves maintainability and reduces the risk of argument order errors.
     *
     * @dry_principles
     * - Uses single function overload to handle both overall and targeted dimensional scoring.
     * - Reads weights dynamically from dimension metrics, avoiding duplicate weight definitions.
     * - Iterates over dimension keys at root level without hardcoding specific dimension names.
     */
    calculateWeightedMatchScore({ matchReport, minimumFloor = 0.50, perfectScore = 0.85, targetDimension = null }) {
        let totalPossibleWeightedPoints = 0;
        let achievedWeightedPoints = 0;

        if (!matchReport) {
            return { score: 0, calculationDetails: null };
        }

        const dimensionKeysToSkip = ['reportInfo', 'allDimensions'];

        const dimensionMatches = {};
        for (const [key, value] of Object.entries(matchReport)) {
            if (dimensionKeysToSkip.includes(key)) {
                continue;
            }
            if (value && typeof value === 'object' && (value.perfectMatch || value.partialMatch || value.missedMatch)) {
                dimensionMatches[key] = value.perfectMatch || [];
            }
        }

        for (const [dimension, matches] of Object.entries(dimensionMatches)) {
            if (targetDimension !== null && dimension !== targetDimension) {
                continue;
            }

            const dimData = matchReport[dimension];
            const weight = dimData?.metrics?.weights !== undefined ? dimData.metrics.weights : 1.0;

            if (!matches || !Array.isArray(matches)) {
                continue;
            }

            totalPossibleWeightedPoints += (matches.length * weight);

            for (const match of matches) {
                let score = match.similarityScore !== undefined
                    ? match.similarityScore
                    : (match.similarityPercentage / 100) || 0;

                const scaledPoints = this.calculateScaledPoints(score, minimumFloor, perfectScore);
                achievedWeightedPoints += (scaledPoints * weight);
            }
        }

        if (totalPossibleWeightedPoints === 0) {
            return { score: 0, calculationDetails: null };
        }

        const finalPercentage = achievedWeightedPoints / totalPossibleWeightedPoints;
        const finalPercentageRounded = Number(finalPercentage.toFixed(4));

        return { score: finalPercentageRounded };
    }
}

module.exports = MatchingEngine;