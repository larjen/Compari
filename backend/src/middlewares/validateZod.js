/**
 * @module middlewares/validateZod
 * @description Universal Zod validation middleware factory.
 * 
 * @socexplanation
 * - Validates incoming request bodies against Zod schemas.
 * - Centralizes all request body validation logic.
 * - Eliminates repetitive try/catch and validation checks from controllers.
 * - Formats Zod errors into clean 400 responses.
 */

const z = require('zod');

/**
 * Middleware factory that creates a validation middleware for a given Zod schema.
 * 
 * @function validate
 * @param {z.ZodSchema} schema - The Zod schema to validate against.
 * @returns {Function} Express middleware function.
 * 
 * @example
 * const { validate } = require('./validateZod');
 * const { aiModelSchema } = require('../validators/schemas');
 * router.post('/', validate(aiModelSchema), AiModelController.create);
 */
const validate = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map((err) => ({
                    path: err.path.join('.'),
                    message: err.message
                }));
                const validationError = new Error('Validation failed');
                validationError.status = 400;
                validationError.errors = errors;
                return next(validationError);
            }
            next(error);
        }
    };
};

module.exports = { validate };
