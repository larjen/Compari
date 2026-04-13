/**
 * @fileoverview Express middleware utility for async route handler error catching.
 * @description Eliminates duplicate try/catch boilerplate in controllers by automatically
 *            catching rejected promises and forwarding errors to the Express error middleware.
 * 
 * @responsibility
 * - Wraps async route handlers to catch synchronous and asynchronous errors
 * - Passes caught errors to next(error) for centralized error handling
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business logic
 * - ❌ MUST NOT make database or service calls directly
 * - ✅ MUST be used by Controllers only
 * 
 * @socexplanation
 * - Removes repetitive try/catch boilerplate from every controller method
 * - Allows controllers to focus purely on HTTP transport (parameter extraction, response formatting)
 * - Ensures ALL errors are consistently passed to the global error middleware
 * - Prevents unhandled promise rejections that would crash the Node process
 * 
 * @example
 * // Before: Each controller method has duplicate boilerplate
 * static async getAll(req, res, next) {
 *   try {
 *     const users = userService.getAllUsers();
 *     res.json({ users });
 *   } catch (error) {
 *     next(error);
 *   }
 * }
 * 
 * // After: Clean controller focused on transport only
 * static getAll = asyncHandler(async (req, res, next) => {
 *   const users = userService.getAllUsers();
 *   res.json({ users });
 * });
 * 
 * @param {Function} asyncHandler - Async route handler function to wrap
 * @returns {Function} Express middleware function with error catching
 */
function asyncHandler(asyncHandler) {
    return (req, res, next) => {
        Promise.resolve(asyncHandler(req, res, next)).catch(next);
    };
}

module.exports = asyncHandler;
