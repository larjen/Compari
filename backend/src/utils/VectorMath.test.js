import { describe, it, expect } from 'vitest';
const { cosineSimilarity } = require('./VectorMath');

describe('VectorMath.cosineSimilarity', () => {
  it('calculates similarity for identical vectors', () => {
    const vecA = [1, 2, 3];
    const vecB = [1, 2, 3];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1);
  });

  it('calculates similarity for orthogonal vectors', () => {
    const vecA = [1, 0];
    const vecB = [0, 1];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  it('calculates similarity for opposite vectors', () => {
    const vecA = [1, 1];
    const vecB = [-1, -1];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1);
  });

  it('calculates similarity for vectors with different magnitudes', () => {
    const vecA = [1, 1];
    const vecB = [2, 2];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1);
  });

  it('returns 0 if one vector has zero magnitude', () => {
    const vecA = [0, 0];
    const vecB = [1, 1];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  it('throws error for different length vectors', () => {
    const vecA = [1, 2];
    const vecB = [1, 2, 3];
    expect(() => cosineSimilarity(vecA, vecB)).toThrow('Vectors must have the same length');
  });

  it('throws error for empty vectors', () => {
    const vecA = [];
    const vecB = [];
    expect(() => cosineSimilarity(vecA, vecB)).toThrow('Vectors cannot be empty');
  });

  it('throws error for non-array arguments', () => {
    expect(() => cosineSimilarity(null, [1])).toThrow('Both arguments must be arrays');
    expect(() => cosineSimilarity([1], 'string')).toThrow('Both arguments must be arrays');
  });
});
