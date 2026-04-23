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
     * Primary output is intended for master.md in the entity vault folder.
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

    /**
     * Generates an Obsidian-compatible master markdown file for a Match entity.
     * Uses Wiki Links ([[FileName]]) for vault traversal between Requirement, Offering, and Matched Criteria.
     *
     * @method generateMatchMaster
     * @memberof MarkdownGenerator
     */
    static generateMatchMaster({ matchFolderName, reqFolderName, offFolderName, executiveSummary, matchId, matchedCriteriaLinks }) {
        const safeMatchName = matchFolderName || "Unknown Match";
        const safeReqName = reqFolderName || "Unknown Requirement";
        const safeOffName = offFolderName || "Unknown Offering";
        const safeSummary = executiveSummary || "No summary available.";
        const criteriaLinks = Array.isArray(matchedCriteriaLinks) ? matchedCriteriaLinks : [];

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const deeplink = matchId ? `${baseUrl}/matches?matchId=${matchId}` : baseUrl;

        let criteriaSection;
        if (criteriaLinks.length > 0) {
            const criteriaList = criteriaLinks.map(c => `- [[${c}]]`).join('\n');
            criteriaSection = `## Matched Criteria\n${criteriaList}\n\n---\n\n`;
        } else {
            criteriaSection = `---\n\n`;
        }

        return `# ${safeMatchName}

**[View Match in Compari](${deeplink})**

**Requirement:** [[${safeReqName}]]
**Offering:** [[${safeOffName}]]

${criteriaSection}${safeSummary}`;
    }

    /**
     * Generates an Obsidian-compatible master markdown file for an Entity with associated Criteria.
     * Uses Wiki Links for vault traversal to linked Criteria folders.
     *
     * @method generateEntityMaster
     * @memberof MarkdownGenerator
     * @param {Object} dto - The data transfer object.
     * @param {string} dto.entityFolderName - The name of the entity folder (H1 title).
     * @param {string} dto.entityType - The entity type (requirement/offering).
     * @param {Array<string>} dto.criteriaFolderNames - Array of criterion folder names for Wiki Links.
     * @param {string} dto.deeplink - The deep link URL to view the entity in Compari.
     * @returns {string} The formatted Obsidian-compatible markdown content.
     *
     * @socexplanation
     * Generates Obsidian-compatible Wiki Links for vault traversal. The Associated Criteria
     * section creates clickable links to each criterion's vault file for cross-referencing.
     */
    static generateEntityMaster({ entityFolderName, entityType, criteriaFolderNames, deeplink, associatedFiles }) {
        const safeEntityName = entityFolderName || "Unknown Entity";
        const safeType = entityType || "entity";
        const safeDeeplink = deeplink || "#";
        const criteriaLinks = Array.isArray(criteriaFolderNames) ? criteriaFolderNames : [];
        const fileLinks = Array.isArray(associatedFiles) ? associatedFiles : [];

        let filesSection = "";
        if (fileLinks.length > 0) {
            const filesList = fileLinks
                .map(file => `- [[${file}]]`)
                .join('\n');
            filesSection = `## Associated Files\n${filesList}\n`;
        }

        let criteriaSection = "";
        if (criteriaLinks.length > 0) {
            const criteriaList = criteriaLinks
                .map(criterion => `- [[${criterion}]]`)
                .join('\n');
            criteriaSection = `## Associated Criteria\n${criteriaList}\n`;
        }

        return `# ${safeEntityName}

**[View ${safeType} in Compari](${safeDeeplink})**

${filesSection}
${criteriaSection}`;
    }

    /**
     * Generates an Obsidian-compatible master markdown file for a Criterion.
     * Uses Wiki Links for vault traversal to associated Requirements and Offerings.
     *
     * @method generateCriterionMaster
     * @memberof MarkdownGenerator
     * @param {Object} dto - The data transfer object.
     * @param {string} dto.criterionFolderName - The name of the criterion folder (H1 title).
     * @param {string} dto.dimension - The dimension/category of the criterion.
     * @param {Array<string>} dto.reqFolderNames - Array of requirement folder names for Wiki Links.
     * @param {Array<string>} dto.offFolderNames - Array of offering folder names for Wiki Links.
     * @returns {string} The formatted Obsidian-compatible markdown content.
     *
     * @socexplanation
     * Generates Obsidian-compatible Wiki Links for vault traversal. The Associated Requirements
     * and Offerings sections create clickable links to each entity's vault file, enabling
     * bidirectional navigation between criteria and linked entities.
     */
    static generateCriterionMaster({ criterionFolderName, dimension, reqFolderNames, offFolderNames, similarCriterionNames, mergedNames }) {
        const safeCriterionName = criterionFolderName || "Unknown Criterion";
        const safeDimension = dimension || "uncategorized";
        const reqLinks = Array.isArray(reqFolderNames) ? reqFolderNames : [];
        const offLinks = Array.isArray(offFolderNames) ? offFolderNames : [];
        const similarLinks = Array.isArray(similarCriterionNames) ? similarCriterionNames : [];
        const mergeLinks = Array.isArray(mergedNames) ? mergedNames : [];

        let reqSection = "";
        if (reqLinks.length > 0) {
            const reqList = reqLinks.map(req => `- [[${req}]]`).join('\n');
            reqSection = `## Associated Requirements\n${reqList}\n`;
        }

        let offSection = "";
        if (offLinks.length > 0) {
            const offList = offLinks.map(off => `- [[${off}]]`).join('\n');
            offSection = `## Associated Offerings\n${offList}\n`;
        }

        let similarSection = "";
        if (similarLinks.length > 0) {
            const similarList = similarLinks.map(sim => `- [[${sim}]]`).join('\n');
            similarSection = `## Closest Criteria\n${similarList}\n`;
        }

        let mergedSection = "";
        if (mergeLinks.length > 0) {
            const mergeList = mergeLinks.map(name => `- ${name}`).join('\n');
            mergedSection = `## Merged Criteria (Synonyms)\n${mergeList}\n`;
        }

        return `# ${safeCriterionName}

**Dimension:** ${safeDimension}

${reqSection}${offSection}${similarSection}${mergedSection}`;
    }
}

module.exports = MarkdownGenerator;
