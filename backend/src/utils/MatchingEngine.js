/**
 * @module MatchingEngine
 * @description Pure mathematical engine for criteria matching using semantic vector similarity.
 * 
 * @responsibility
 * - Performs semantic vector comparisons between requirement and offering criteria.
 * - Calculates match scores, dimensional breakdowns, and identifies missing/bonus criteria.
 * 
 * @boundary_rules
 * - ✅ MUST be a pure function - no side effects, no database calls, no AI services.
 * - ❌ MUST NOT handle logging or persistence.
 * - ❌ MUST NOT have knowledge of databases or external services.
 * 
 * SoC: This is a pure mathematical engine. It has no knowledge of databases or AI services.
 * It only performs semantic vector comparisons.
 */

const { cosineSimilarity } = require('./VectorMath');
const logService = require('../services/LogService');

/**
 * Calculates scaled points for a match score using a sliding scale.
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
function calculateScaledPoints(score, minimumFloor, perfectScore) {
    if (score < minimumFloor) return 0;
    let rawPoints = (score - minimumFloor) / (perfectScore - minimumFloor);
    return Math.min(rawPoints, 1.0);
}

const STRONG_MATCH_THRESHOLD = 0.85;
const PARTIAL_MATCH_THRESHOLD = 0.70;

/**
 * Pure vector math function that calculates similarity score between two criteria embeddings.
 * Bypasses the heavy JSON report generation for fast chunked evaluations.
 * 
 * @param {number[]} reqVector - The requirement criterion embedding vector.
 * @param {number[]} offVector - The offering criterion embedding vector.
 * @returns {number} The similarity score (0 to 1).
 * 
 * @architectural_reasoning
 * - This is a lightweight function for chunked evaluations that don't need the full JSON report.
 * - It directly computes cosine similarity without any side effects or logging.
 * - Returns raw similarity between vectors; caller can apply weighted scoring.
 */
function evaluateCriteriaPair(reqVector, offVector) {
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
        return 0;
    }
}

/**
 * Fast aggregate scorer that calculates weighted match score between requirement and offering criteria.
 * @description
 * To guarantee 100% score parity with the final Match Report, this function now routes 
 * directly through the report generation engine (buildRawComparison). It builds a 
 * lightweight report in memory and extracts the final weighted score.
 * * @param {Array<Object>} requirementCriteria - Array of requirement criterion objects.
 * @param {Array<Object>} offeringCriteria - Array of offering criterion objects.
 * @param {Array<Object>} activeDimensions - Array of dimension objects.
 * @param {number} [minimumFloor=0.50] - Minimum similarity threshold.
 * @param {number} [perfectScore=0.85] - Perfect similarity threshold.
 * @returns {number} The final weighted match score (0 to 1), rounded to 4 decimal places.
 */
function calculateFastMatchScore(requirementCriteria, offeringCriteria, activeDimensions, minimumFloor = 0.50, perfectScore = 0.85) {
    // 1. Return 0 if we are missing required arrays
    if (!requirementCriteria || !Array.isArray(requirementCriteria) || requirementCriteria.length === 0) {
        return 0;
    }
    if (!offeringCriteria || !Array.isArray(offeringCriteria) || offeringCriteria.length === 0) {
        return 0;
    }
    if (!activeDimensions || !Array.isArray(activeDimensions) || activeDimensions.length === 0) {
        return 0;
    }

    // 2. Package the thresholds for the report builder
    const matchSettings = { minimumFloor, perfectScore };

    // 3. Build the raw comparison report in memory using dummy entity objects 
    // (since we only care about the calculated score, not the entity names)
    const rawComparison = buildRawComparison(
        { id: 0, name: 'fast_req' },
        { id: 0, name: 'fast_off' },
        activeDimensions,
        matchSettings,
        requirementCriteria,
        offeringCriteria
    );

    // 4. Extract and return the exact overall score that the report calculated
    return rawComparison?.reportInfo?.matchScores?.allDimensions?.score || 0;
}

/**
 * SoC: This is a pure mathematical engine responsible for semantic matching.
 * It remains agnostic of database models or AI extraction workflows.
 * 
 * Calculates criteria match score between requirement and offering criteria using semantic vector similarity.
 * Returns a rich data object containing the overall score AND dimensional breakdown.
 * 
 * @param {Array<Object>} requirementCriteria - Array of requirement criterion objects with embedding, displayName, normalizedName, dimension.
 * @param {Array<Object>} offeringCriteria - Array of offering criterion objects with embedding, displayName, normalizedName, dimension.
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
function calculate(requirementCriteria, offeringCriteria) {
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

            if (!offering.embedding || !Array.isArray(offering.embedding) || offering.embedding.length === 0) {
                continue;
            }

            try {
                const similarity = cosineSimilarity(req.embedding, offering.embedding);

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
            } catch (err) {
                logService.logTerminal('WARN', 'WARNING', 'MatchingEngine', `Vector similarity calculation failed: ${err.message}`);
                continue;
            }
        }

        reqDimResult.metrics.requiredTotal++;

        if (bestMatch && bestSimilarity >= PARTIAL_MATCH_THRESHOLD) {
            reqDimResult.matched.push(bestMatch);
            
            if (bestSimilarity >= STRONG_MATCH_THRESHOLD) {
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
function groupMatches(matchesArray, minFloor, perfScore) {
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
 * SoC: Raw comparison builder for JSON export purposes.
 * This function is separate from the scoring engine - it produces a simplified
 * structure focusing only on closest similarities (dimensional and global),
 * excluding missed/bonus skills for backward compatibility with existing features.
 *
 * Builds a raw comparison object with requirement and offering entities nested in reportInfo.
 * Contains dimension-specific matches grouped at root level and allDimensions for global pool-wide matches.
 * Dimensions are sorted descending by similarityScore, and the order matches the activeDimensions array order.
 * Scores are calculated internally using the overloaded calculateWeightedMatchScore function.
 *
 * @param {Object} requirement - The requirement entity object with id and name.
 * @param {Object} offering - The offering entity object with id and name.
 * @param {Array<Object>} activeDimensions - Array of dimension objects with name and weight properties.
 * @param {Object} [matchSettings] - Settings object containing minimumFloor and perfectScore thresholds. If omitted, defaults to 0.50 and 0.85 respectively.
 * @param {Array<Object>} requirementCriteria - Array of requirement criterion objects.
 * @param {Array<Object>} offeringCriteria - Array of offering criterion objects.
 * @returns {Object} Object containing reportInfo (with matchScores), allDimensions, and grouped dimension matches at root level.
 *
 * @return_structure
 * {
 *   reportInfo: {
 *     matchScores: {
 *       allDimensions: { score: number, weights: number, matches: number, partialMatches: number, missedMatches: number },
 *       [dimKey]: { score: number, weights: number, matches: number, partialMatches: number, missedMatches: number }
 *     },
 *     offering: { id: number, name: string },
 *     requirement: { id: number, name: string },
 *     similarityForPerfectMatch: number,
 *     similarityForPartialMatch: number
 *   },
 *   allDimensions: {
 *     perfectMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }],
 *     partialMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }],
 *     missedMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }]
 *   },
 *   [dimKey]: {
 *     perfectMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }],
 *     partialMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }],
 *     missedMatch: [{ reqCriteria: string, reqId: number, offCriteria: string|null, offId: number|null, similarityScore: number, dimensionId: number }]
 *   }
 * }
 *
 * @notes
 * - similarityScore is a float between 0.0 and 1.0, rounded to two decimal places.
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
 */
function buildRawComparison(requirement, offering, activeDimensions, matchSettings, requirementCriteria, offeringCriteria) {
    const minFloor = matchSettings?.minimumFloor ?? 0.50;
    const perfScore = matchSettings?.perfectScore ?? 0.85;

    const dimensionWeights = {};
    if (activeDimensions && Array.isArray(activeDimensions)) {
        for (const dim of activeDimensions) {
            dimensionWeights[dim.name] = dim.weight || 1.0;
        }
    }

    const dimensionalMatches = {};

    if (!requirementCriteria || requirementCriteria.length === 0 || !offeringCriteria || offeringCriteria.length === 0) {
        if (activeDimensions && Array.isArray(activeDimensions)) {
            for (const dim of activeDimensions) {
                dimensionalMatches[dim.name] = [];
            }
        }
        const finalReport = {
            reportInfo: {
                matchScores: {
                    allDimensions: { score: 0, weights: 1, matches: 0, partialMatches: 0, missedMatches: 0 }
                },
                offering: { id: offering.id, name: offering.name },
                requirement: { id: requirement.id, name: requirement.name },
                similarityForPerfectMatch: perfScore,
                similarityForPartialMatch: minFloor
            },
            allDimensions: { perfectMatch: [], partialMatch: [], missedMatch: [] }
        };
        for (const dim of Object.keys(dimensionWeights)) {
            finalReport[dim] = { perfectMatch: [], partialMatch: [], missedMatch: [] };
        }
        return finalReport;
    }

    const reqDimensionsSet = new Set(requirementCriteria.map(c => c.dimension || 'uncategorized'));

    if (activeDimensions && Array.isArray(activeDimensions)) {
        for (const dim of activeDimensions) {
            const dimName = dim.name;
            if (!reqDimensionsSet.has(dimName)) {
                continue;
            }
            const dimKey = dimName;

            const reqCriteriaInDim = requirementCriteria.filter(c => (c.dimension || 'uncategorized') === dimKey);
            const offCriteriaInDim = offeringCriteria.filter(c => (c.dimension || 'uncategorized') === dimKey);

            const dimMatches = [];

            for (const req of reqCriteriaInDim) {
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

                for (const off of offCriteriaInDim) {
                    if (!off.embedding || !Array.isArray(off.embedding) || off.embedding.length === 0) {
                        continue;
                    }

                    try {
                        const similarity = cosineSimilarity(req.embedding, off.embedding);
                        if (similarity > bestSimilarity) {
                            bestSimilarity = similarity;
                            bestMatch = {
                                reqCriteria: req.displayName || req.normalizedName,
                                reqId: req.id,
                                offCriteria: off.displayName || off.normalizedName,
                                offId: off.id,
                                similarityScore: Number(Math.max(0, similarity).toFixed(2)),
                                dimension: req.dimension || 'uncategorized',
                                dimensionId: req.dimensionId || req.dimension_id || 0
                            };
                        }
                    } catch (err) {
                        logService.logTerminal('WARN', 'WARNING', 'MatchingEngine', `Vector similarity calculation failed: ${err.message}`);
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
            dimensionalMatches[dimKey] = dimMatches;
        }
    } else {
        const autoDimensions = [...reqDimensionsSet];
        for (const dimKey of autoDimensions) {
            const reqCriteriaInDim = requirementCriteria.filter(c => (c.dimension || 'uncategorized') === dimKey);
            const offCriteriaInDim = offeringCriteria.filter(c => (c.dimension || 'uncategorized') === dimKey);

            const dimMatches = [];

            for (const req of reqCriteriaInDim) {
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

                for (const off of offCriteriaInDim) {
                    if (!off.embedding || !Array.isArray(off.embedding) || off.embedding.length === 0) {
                        continue;
                    }

                    try {
                        const similarity = cosineSimilarity(req.embedding, off.embedding);
                        if (similarity > bestSimilarity) {
                            bestSimilarity = similarity;
                            bestMatch = {
                                reqCriteria: req.displayName || req.normalizedName,
                                reqId: req.id,
                                offCriteria: off.displayName || off.normalizedName,
                                offId: off.id,
                                similarityScore: Number(Math.max(0, similarity).toFixed(2)),
                                dimension: req.dimension || 'uncategorized',
                                dimensionId: req.dimensionId || req.dimension_id || 0
                            };
                        }
                    } catch (err) {
                        logService.logTerminal('WARN', 'WARNING', 'MatchingEngine', `Vector similarity calculation failed: ${err.message}`);
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
            dimensionalMatches[dimKey] = dimMatches;
        }
    }

    const allDimensionsMatches = [];

    for (const req of requirementCriteria) {
        let bestMatch = null;
        let bestSimilarity = -1;

        if (!req.embedding || !Array.isArray(req.embedding) || req.embedding.length === 0) {
            allDimensionsMatches.push({
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

        for (const off of offeringCriteria) {
            if (!off.embedding || !Array.isArray(off.embedding) || off.embedding.length === 0) {
                continue;
            }

            try {
                const similarity = cosineSimilarity(req.embedding, off.embedding);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        reqCriteria: req.displayName || req.normalizedName,
                        reqId: req.id,
                        offCriteria: off.displayName || off.normalizedName,
                        offId: off.id,
                        similarityScore: Number(Math.max(0, similarity).toFixed(2)),
                        dimension: req.dimension || 'uncategorized',
                        dimensionId: req.dimensionId || req.dimension_id || 0
                    };
                }
            } catch (err) {
                logService.logTerminal('WARN', 'WARNING', 'MatchingEngine', `Vector similarity calculation failed: ${err.message}`);
            }
        }

        if (bestMatch) {
            allDimensionsMatches.push(bestMatch);
        } else {
            allDimensionsMatches.push({
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

    allDimensionsMatches.sort((a, b) => b.similarityScore - a.similarityScore);

    // Construct a mock report structure so calculateWeightedMatchScore can parse it correctly
    const tempReport = {
        reportInfo: {
            matchScores: {}
        }
    };

    // 1. Inject the weights into the mock reportInfo
    for (const dimKey of Object.keys(dimensionWeights || {})) {
        tempReport.reportInfo.matchScores[dimKey] = { weights: dimensionWeights[dimKey] };
    }

    // 2. Flatten the dimension arrays into the root level of the mock report
    for (const [dimKey, matches] of Object.entries(dimensionalMatches)) {
        tempReport[dimKey] = matches;
    }

    // Helper to count perfect, partial, and missed matches
    const countMatches = (matchesArray) => {
        let matches = 0;
        let partialMatches = 0;
        let missedMatches = 0;
        if (!matchesArray) return { matches, partialMatches, missedMatches };

        for (const match of matchesArray) {
            const score = match.similarityScore || 0;
            const hasOffCriteria = match.offCriteria !== null && match.offCriteria !== undefined;
            
            if (score >= perfScore) {
                matches++;
            } else if (score >= minFloor && hasOffCriteria) {
                partialMatches++;
            } else {
                missedMatches++;
            }
        }
        return { matches, partialMatches, missedMatches };
    };

    // Count and assign for all dimensions
    const allDimsCounts = countMatches(allDimensionsMatches);
    const calculatedOverallScore = calculateWeightedMatchScore(tempReport, minFloor, perfScore, null);

    const matchScores = {
        allDimensions: {
            score: calculatedOverallScore,
            weights: 1,
            matches: allDimsCounts.matches,
            partialMatches: allDimsCounts.partialMatches,
            missedMatches: allDimsCounts.missedMatches
        }
    };

    // Count and assign for each specific dimension
    for (const dimKey of Object.keys(dimensionWeights || {})) {
        const dimCounts = countMatches(dimensionalMatches[dimKey]);
        const dimScore = calculateWeightedMatchScore(tempReport, minFloor, perfScore, dimKey);

        matchScores[dimKey] = {
            score: dimScore,
            weights: dimensionWeights[dimKey],
            matches: dimCounts.matches,
            partialMatches: dimCounts.partialMatches,
            missedMatches: dimCounts.missedMatches
        };
    }

    const finalReport = {
        reportInfo: {
            matchScores: matchScores,
            offering: { id: offering.id, name: offering.name },
            requirement: { id: requirement.id, name: requirement.name },
            similarityForPerfectMatch: perfScore,
            similarityForPartialMatch: minFloor
        },
        allDimensions: groupMatches(allDimensionsMatches, minFloor, perfScore)
    };

    for (const dim of Object.keys(dimensionWeights || {})) {
        if (dimensionalMatches[dim]) {
            finalReport[dim] = groupMatches(dimensionalMatches[dim], minFloor, perfScore);
        }
    }

    return finalReport;
}

/**
 * Calculates a weighted overall match percentage from a raw JSON match report.
 * Uses a sliding scale to award partial credit for conceptual matches.
 * 
 * This function reads weights from reportInfo.matchScores and iterates over dimension keys
 * present at the root level of the matchReport (excluding reportInfo and allDimensions).
 * 
 * When targetDimension is provided, this function calculates the score for only that specific dimension,
 * enabling targeted dimensional scoring while keeping logic DRY. When targetDimension is null,
 * it calculates the overall score across all dimensions.
 *
 * @param {Object} matchReport - The parsed raw_json_comparison.json object with new structure.
 * @param {number} [minimumFloor=0.50] - Minimum similarity threshold (as float, e.g., 0.50 for 50%). Below this score earns zero points.
 * @param {number} [perfectScore=0.85] - Perfect similarity threshold (as float, e.g., 0.85 for 85%). At or above this score earns full points.
 * @param {string|null} [targetDimension=null] - Optional dimension key to calculate score for. If a dimension name is provided (e.g., "skills", "experience"), it calculates the score only for that specific dimension. If null, it calculates the overall score across all dimensions.
 * @returns {number} The final match score as a percentage (e.g., 42.5)
 *
 * @dry_principles
 * - Uses single function overload to handle both overall and targeted dimensional scoring.
 * - Reads weights dynamically from reportInfo.matchScores, avoiding duplicate weight definitions.
 * - Iterates over dimension keys at root level without hardcoding specific dimension names.
 */
function calculateWeightedMatchScore(matchReport, minimumFloor = 0.50, perfectScore = 0.85, targetDimension = null) {
    let totalPossibleWeightedPoints = 0;
    let achievedWeightedPoints = 0;

    if (!matchReport) {
        return 0;
    }

    const matchScores = matchReport.reportInfo && matchReport.reportInfo.matchScores ? matchReport.reportInfo.matchScores : {};
    const dimensionKeysToSkip = ['reportInfo', 'allDimensions'];

    const dimensionMatches = {};
    for (const [key, value] of Object.entries(matchReport)) {
        if (dimensionKeysToSkip.includes(key)) {
            continue;
        }
        if (Array.isArray(value)) {
            dimensionMatches[key] = value;
        }
    }

    for (const [dimension, matches] of Object.entries(dimensionMatches)) {
        if (targetDimension !== null && dimension !== targetDimension) {
            continue;
        }

        const weightInfo = matchScores[dimension];
        const weight = weightInfo && weightInfo.weights !== undefined ? weightInfo.weights : 1.0;
        
        if (!matches || !Array.isArray(matches)) {
            continue;
        }

        const totalRequirements = matches.length;
        totalPossibleWeightedPoints += (totalRequirements * weight);

        for (const match of matches) {
            let score = match.similarityScore !== undefined 
                ? match.similarityScore 
                : (match.similarityPercentage / 100) || 0;

            const scaledPoints = calculateScaledPoints(score, minimumFloor, perfectScore);
            achievedWeightedPoints += (scaledPoints * weight);
        }
    }

    if (totalPossibleWeightedPoints === 0) return 0;
    const finalPercentage = (achievedWeightedPoints / totalPossibleWeightedPoints);
    return Number(finalPercentage.toFixed(4)); 
}

module.exports = { calculate, buildRawComparison, calculateWeightedMatchScore, evaluateCriteriaPair, calculateFastMatchScore, calculateScaledPoints };
