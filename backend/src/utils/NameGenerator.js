/**
 * @module NameGenerator
 * @description Pure utility for generating user-friendly display names ("nice_name") for extracted entities.
 * 
 * @responsibility
 * - Isolates all string-manipulation logic for display name generation away from AI workflows.
 * - Generates a human-readable name by combining values from required blueprint fields.
 * - Provides truncation guards to ensure UI safety (max 200 chars with "...").
 * - Injects the generated name directly into the metadata payload.
 * 
 * @design_rationale
 * - This is a SEPARATION OF CONCERNS (SoC) isolation layer.
 * - The display name is generated from the EXTRACTED METADATA values, not the AI prompt/response cycle.
 * - This ensures the "nice_name" is a derived property from the raw data,
 *   not a separate LLM generation that could hallucinate or drift.
 * - By injecting it into the standard metadata JSON object, the database saves it
 *   automatically, and the existing frontend metadata editor renders it as editable.
 * 
 * @boundary_rules
 * - ✅ Pure function with no side effects (no DB, no file I/O, no external calls).
 * - ✅ Accepts parsed metadata and blueprint field definitions as input.
 * - ✅ Returns a new metadata object with the nice_name injected.
 * - ❌ MUST NOT contain business logic or workflow orchestration.
 * - ❌ MUST NOT call services, repositories, or infrastructure.
 * 
 * @soc_explanation
 * - The "nice_name" is a PRESENTATION-LAYER concern (how to display an entity).
 * - By isolating it here, we prevent this presentation logic from leaking into the
 *   DocumentProcessorWorkflow or EntityService, keeping those focused on orchestration.
 * - The AI extraction workflow only deals with raw data; this utility transforms
 *   that data into a display-friendly format.
 */
const MAX_NAME_LENGTH = 200;

/**
 * Generates a human-friendly display name ("nice_name") by combining values from required blueprint fields.
 * 
 * @param {Object} parsedMetadata - The extracted metadata object from AI processing.
 *                           Keys should match blueprint field names.
 * @param {Array<Object>} blueprintFields - Array of blueprint field definitions.
 *                           Each should have properties: name or fieldName, isRequired.
 * @returns {Object} A new metadata object with the nice_name injected.
 * 
 * @logic
 * 1. Filter blueprintFields to find only those where isRequired === true.
 * 2. Take up to the first two required fields.
 * 3. Look up their corresponding values in parsedMetadata.
 * 4. Filter out any missing/falsy values.
 * 5. Join the remaining values with " - ".
 * 6. If length exceeds 200 chars, truncate and append "...".
 * 7. If no values found, use fallback "Unnamed Entity".
 * 8. Return new metadata object with nice_name key.
 * 
 * @example
 * const metadata = { jobTitle: "Senior Engineer", company: "Acme Corp", location: "Remote" };
 * const fields = [
 *   { fieldName: "jobTitle", isRequired: true },
 *   { fieldName: "company", isRequired: true },
 *   { fieldName: "location", isRequired: false }
 * ];
 * const result = injectNiceName(metadata, fields);
 * // result.nice_name === "Senior Engineer - Acme Corp"
 */
function injectNiceName(parsedMetadata, blueprintFields) {
    if (!parsedMetadata || typeof parsedMetadata !== 'object') {
        return { ...parsedMetadata, nice_name: 'Unnamed Entity' };
    }

    if (!Array.isArray(blueprintFields) || blueprintFields.length === 0) {
        const fallbackName = parsedMetadata.title || parsedMetadata.name || 'Unnamed Entity';
        return { ...parsedMetadata, nice_name: fallbackName };
    }

    // Step 1: Filter for required fields
    // Resilient check: Handles strict booleans, SQLite integers (1), and snake_case API payload variations
    const requiredFields = blueprintFields.filter(field => 
        field.isRequired === true || 
        field.is_required === true || 
        field.isRequired === 1 || 
        field.is_required === 1
    );

    if (requiredFields.length === 0) {
        const fallbackName = parsedMetadata.title || parsedMetadata.name || 'Unnamed Entity';
        return { ...parsedMetadata, nice_name: fallbackName };
    }

    // Step 2: Take up to first two required fields
    const targetFields = requiredFields.slice(0, 2);

    // Step 3 & 4: Look up values and filter out missing/falsy
    const fieldValues = targetFields
        .map(field => {
            // Support both 'fieldName' and 'name' property
            const key = field.fieldName || field.name || field.field_name;
            return parsedMetadata[key];
        })
        .filter(value => value != null && value !== '' && value !== 'Unknown');

    // Step 5: Join values with " - "
    let niceName = fieldValues.length > 0 
        ? fieldValues.join(' - ') 
        : null;

    // Step 6: Truncation guard
    if (niceName && niceName.length > MAX_NAME_LENGTH) {
        niceName = niceName.substring(0, MAX_NAME_LENGTH - 3) + '...';
    }

    // Step 7: Fallback if no values found
    if (!niceName) {
        niceName = 'Unnamed Entity';
    }

    // Step 8: Return new metadata object with nice_name injected
    return {
        ...parsedMetadata,
        nice_name: niceName
    };
}

module.exports = {
    injectNiceName
};