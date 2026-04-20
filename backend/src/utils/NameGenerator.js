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
 * @public
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
    const fallbackName = parsedMetadata?.title || parsedMetadata?.name || 'Unnamed Entity';

    if (!parsedMetadata || typeof parsedMetadata !== 'object') {
        return { ...parsedMetadata, nicename: fallbackName, niceNameLine1: 'Unknown', niceNameLine2: 'Unknown' };
    }

    if (!Array.isArray(blueprintFields) || blueprintFields.length === 0) {
        return { ...parsedMetadata, nicename: fallbackName, niceNameLine1: 'Unknown', niceNameLine2: 'Unknown' };
    }

    const requiredFields = blueprintFields
        .filter(f => f.isRequired === true || f.is_required === true || f.isRequired === 1 || f.is_required === 1)
        .sort((a, b) => (a.id || 0) - (b.id || 0));

    if (requiredFields.length === 0) {
        return { ...parsedMetadata, nicename: fallbackName, niceNameLine1: 'Unknown', niceNameLine2: 'Unknown' };
    }

    const extractValue = (field) => {
        if (!field) return null;
        const key = field.fieldName || field.name || field.field_name;
        const val = parsedMetadata[key];
        return (val != null && val !== '' && val !== 'Unknown') ? val : null;
    };

    const val1 = extractValue(requiredFields[0]);
    const val2 = extractValue(requiredFields[1]);

    const line1 = val1 || 'Unknown';
    const line2 = val2 || 'Unknown';

    let nicename = val1 ? val1 : fallbackName;
    if (val1 && val2) {
        nicename = `${val1} - ${val2}`;
        if (nicename.length > MAX_NAME_LENGTH) {
            nicename = nicename.substring(0, MAX_NAME_LENGTH - 3) + '...';
        }
    }

    return {
        ...parsedMetadata,
        nicename,
        niceNameLine1: line1,
        niceNameLine2: line2
    };
}

module.exports = {
    injectNiceName
};