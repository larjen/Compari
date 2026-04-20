/**
 * @module HashGenerator
 * @description Utility for generating versioned cryptographic hashes for entities.
 * Uses the Versioned Hash Pattern (e.g., "sha256:hex") to future-proof the database.
 */
const crypto = require('crypto');
const { HASH_ALGORITHM } = require('../config/constants');

class HashGenerator {
    /**
     * Generates a globally unique hash using a random UUID.
     * Used for dynamic entities like Requirements, Offerings, and Matches.
     * @returns {string} Versioned hash string.
     */
    static generateUniqueHash() {
        const hash = crypto.createHash(HASH_ALGORITHM).update(crypto.randomUUID()).digest('hex');
        return `${HASH_ALGORITHM}:${hash}`;
    }

    /**
     * Generates a deterministic hash from a specific input string.
     * Used for structural entities like Criteria to prevent duplicates across datasets.
     * @param {string} input - The string to hash.
     * @returns {string} Versioned hash string.
     */
    static generateDeterministicHash(input) {
        const hash = crypto.createHash(HASH_ALGORITHM).update(input).digest('hex');
        return `${HASH_ALGORITHM}:${hash}`;
    }
}

module.exports = HashGenerator;