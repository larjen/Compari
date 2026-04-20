/**
 * @fileoverview Express middleware utility for async route handler error catching
 * and global task batching.
 * * @responsibility
 * - Wraps async route handlers to catch synchronous and asynchronous errors.
 * - Enforces global concurrency limits strictly at the application level.
 */

/**
 * Express middleware to catch async route handler errors.
 * @param {Function} fn - Async route handler function to wrap
 * @returns {Function} Express middleware function with error catching
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Processes an array of async tasks either concurrently or sequentially.
 * * @socexplanation 
 * - Enforces global concurrency limits strictly at the application level.
 * - Centralizes iteration logic (DRY) to prevent workflows from manually managing promises, 
 * protecting LLM API rate limits when concurrency is globally disabled.
 * * @param {Array<any>} items - The array of items to iterate over.
 * @param {Function} asyncCallback - The async function to execute for each item. Takes (item) as argument.
 * @param {boolean} allowConcurrent - If true, uses Promise.all. If false, uses for...of sequential execution.
 * @returns {Promise<Array<any>>} Array of resolved results mapped to the input items.
 */
const processAiTasks = async (items, asyncCallback, allowConcurrent) => {
    if (allowConcurrent) {
        return await Promise.all(items.map(item => asyncCallback(item)));
    }

    const results = [];
    for (const item of items) {
        // Sequential execution enforced by user settings
        const result = await asyncCallback(item);
        results.push(result);
    }
    return results;
};

// 1. Export the middleware as the primary module export so controllers don't break
module.exports = asyncHandler;

// 2. Attach the batch processing utility so workflows can destructure it: 
// const { processAiTasks } = require('../utils/asyncHandler');
module.exports.processAiTasks = processAiTasks;