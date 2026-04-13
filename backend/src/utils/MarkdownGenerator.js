// src/utils/MarkdownGenerator.js

/**
 * @module MarkdownGenerator
 * @description Utility for generating Markdown-formatted documents.
 * 
 * @responsibility
 * - Generates clean Markdown strings for various document types.
 * - Isolates presentation/formatting logic from domain calculation logic.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain business logic or domain calculations.
 * - ❌ MUST NOT perform data fetching or persistence.
 * - ✅ Pure presentation layer - takes data and returns formatted strings.
 * 
 * @socexplanation
 * - This module isolates presentation/formatting logic from domain calculation logic.
 * - Match report generation is a formatting concern, not a domain concern.
 * - The domain layer calculates match data; this generator formats it for human-readable output.
 */
class MarkdownGenerator {

    /**
     * Generates a standard markdown document for an entity profile.
     * 
     * @method generateEntityProfile
     * @memberof MarkdownGenerator
     * @param {string} title - The title of the entity profile.
     * @param {string} organization - The name of the organization.
     * @param {Object} extractedData - Metadata extracted from the entity profile document.
     * @returns {string} The formatted markdown content.
     */
    static generateEntityProfile(title, organization, extractedData = {}) {
        const safeTitle = title || "Unknown";
        const safeOrganization = organization || "Unknown";

        return `# ${safeTitle}
## ${safeOrganization}  
----
### Information
* Title: ${safeTitle}  
* Organization: ${safeOrganization}  
* Posted: ${extractedData.postedDate || "Unknown"}
* Deadline: ${extractedData.deadline || "Ongoing"}  
* URL: ${extractedData.url || "Unknown"}

# Entity Profile
----
${extractedData.verbatimPosting || extractedData.rawText || "No text parsed."}`;
    }
}

module.exports = MarkdownGenerator;
