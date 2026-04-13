/**
 * @module VectorMath
 * @description Utility for performing vector mathematical operations.
 * @responsibility
 * - Provides pure mathematical functions for vector operations.
 * - Used for semantic similarity calculations.
 * @boundary_rules
 * - ✅ MAY be called by any service or repository.
 * - ❌ MUST NOT contain business logic or database operations.
 */

/**
 * Calculates the cosine similarity between two vectors.
 * Cosine similarity measures the cosine of the angle between two vectors,
 * ranging from -1 (opposite) to 1 (identical), with 0 indicating orthogonality.
 * 
 * Formula: cos(A, B) = (A · B) / (||A|| * ||B||)
 * Where:
 *   - A · B is the dot product of vectors A and B
 *   - ||A|| is the magnitude (Euclidean norm) of vector A
 *   - ||B|| is the magnitude (Euclidean norm) of vector B
 * 
 * @param {number[]} vecA - First vector as an array of numbers.
 * @param {number[]} vecB - Second vector as an array of numbers.
 * @returns {number} The cosine similarity score between -1 and 1.
 * @throws {Error} If vectors have different lengths or are empty.
 */
function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
        throw new Error('Both arguments must be arrays');
    }
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
    }
    if (vecA.length === 0) {
        throw new Error('Vectors cannot be empty');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const magnitudeA = Math.sqrt(normA);
    const magnitudeB = Math.sqrt(normB);

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

module.exports = { cosineSimilarity };