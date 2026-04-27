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
         * Uses Wiki Links ([[FileName]]) for vault traversal between Requirement and Offering.
         *
         * @method generateMatchMaster
         * @memberof MarkdownGenerator
         */
    static generateMatchMaster({ matchFolderName, reqFolderName, offFolderName, executiveSummary, dimensionalSummaries, matchId, matchScore, associatedFiles }) {
        const safeMatchName = matchFolderName || "Unknown Match";
        const safeReqName = reqFolderName || "Unknown Requirement";
        const safeOffName = offFolderName || "Unknown Offering";
        const fileLinks = Array.isArray(associatedFiles) ? associatedFiles : [];

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const safeDeeplink = matchId ? `${baseUrl}/matches?matchId=${matchId}` : baseUrl;

        let frontmatter = "---\n";
        frontmatter += `Type: "Match Report"\n`;
        frontmatter += `Compari Link: "${safeDeeplink}"\n`;

        if (matchScore !== undefined && matchScore !== null) {
            frontmatter += `Match Score: "${matchScore}"\n`;
        }

        frontmatter += "---\n\n";

        let filesSection = "";
        if (fileLinks.length > 0) {
            filesSection = `## Associated Files\n${fileLinks.map(file => `- [[${file}]]`).join('\n')}\n\n`;
        }

        let summarySection = "";
        if (executiveSummary && executiveSummary.trim() !== "") {
            summarySection += `## Executive Summary\n\n${executiveSummary}\n\n`;
        }

        if (Array.isArray(dimensionalSummaries) && dimensionalSummaries.length > 0) {
            for (const dim of dimensionalSummaries) {
                if (dim.summary && dim.summary.trim() !== "") {
                    summarySection += `### ${dim.displayName}\n\n${dim.summary}\n\n`;
                }
            }
        }

        return `${frontmatter}# ${safeMatchName}

**Requirement:** [[${safeReqName}]]
**Offering:** [[${safeOffName}]]

---

${filesSection}${summarySection}`;
    }

    /**
     * Generates an Obsidian-compatible master markdown file for an Entity (Requirement/Offering).
     * Dynamically renders extracted metadata into the YAML frontmatter.
     *
     * @method generateEntityMaster
     * @memberof MarkdownGenerator
     * @param {Object} dto - The data transfer object.
     * @param {number} dto.entityId - The entity ID for building the deep link.
     * @param {string} dto.entityFolderName - The name of the entity folder (H1 title).
     * @param {string} dto.entityType - The entity type (requirement/offering).
     * @param {Object} dto.metadata - The extracted metadata object with dynamic key-value pairs.
     * @param {string} dto.verbatimContent - The verbatim extraction content.
     * @param {Array<string>} dto.criteriaFolderNames - Array of criterion folder names for Wiki Links.
     * @param {Array<string>} dto.associatedFiles - Array of associated file names.
     * @returns {string} The formatted Obsidian-compatible markdown content.
     */
    static generateEntityMaster({ entityId, entityFolderName, entityType, blueprintLabel, metadata, verbatimContent, criteriaFolderNames, associatedFiles }) {
        const safeEntityName = entityFolderName || "Unknown Entity";
        const safeType = entityType || "entity";
        const criteriaLinks = Array.isArray(criteriaFolderNames) ? criteriaFolderNames : [];
        const fileLinks = Array.isArray(associatedFiles) ? associatedFiles : [];

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const routePrefix = safeType.toLowerCase() === 'requirement' ? 'requirements' : 'offerings';
        const safeDeeplink = entityId ? `${baseUrl}/${routePrefix}?entityId=${entityId}` : baseUrl;

        let frontmatter = "---\n";
        const formattedType = safeType.charAt(0).toUpperCase() + safeType.slice(1);
        const displayType = blueprintLabel || formattedType;
        frontmatter += `Type: "${displayType}"\n`;
        frontmatter += `Compari Link: "${safeDeeplink}"\n`;

        if (metadata && Object.keys(metadata).length > 0) {
            for (const [key, value] of Object.entries(metadata)) {
                if (key.startsWith('_') || key === 'processingStartedAt' || key === 'processingCompletedAt' || key === 'processingFileName') continue;

                let safeValue = value;
                if (Array.isArray(value)) {
                    safeValue = value.join(', ');
                } else if (typeof value === 'object' && value !== null) {
                    safeValue = JSON.stringify(value);
                }

                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                frontmatter += `${formattedKey}: "${safeValue}"\n`;
            }
        }
        frontmatter += "---\n\n";

        let verbatimSection = "";
        if (verbatimContent && verbatimContent.trim()) {
            verbatimSection = `\n---\n\n## Verbatim Profile\n\n${verbatimContent}\n`;
        }

        let filesSection = "";
        if (fileLinks.length > 0) {
            const filesList = fileLinks
                .map(file => `- [[${file}]]`)
                .join('\n');
            filesSection = `\n---\n\n## Associated Files\n${filesList}\n`;
        }

        let criteriaSection = "";
        if (criteriaLinks.length > 0) {
            const criteriaList = criteriaLinks
                .map(criterion => `- [[${criterion}]]`)
                .join('\n');
            criteriaSection = `\n---\n\n## Associated Criteria\n${criteriaList}\n`;
        }

        return `${frontmatter}# ${safeEntityName}\n${verbatimSection}${filesSection}${criteriaSection}`;
    }

    /**
     * Generates an Obsidian-compatible master markdown file for a Criterion.
     * Uses Wiki Links for vault traversal to associated Requirements and Offerings.
     *
     * @method generateCriterionMaster
     * @memberof MarkdownGenerator
     * @param {Object} dto - The data transfer object.
     * @param {number} dto.criterionId - The criterion ID for building the deep link.
     * @param {string} dto.criterionFolderName - The name of the criterion folder (H1 title).
     * @param {string} dto.dimension - The dimension/category of the criterion.
     * @param {string} dto.dimensionDisplayName - The user-friendly dimension display name.
     * @param {Array<string>} dto.reqFolderNames - Array of requirement folder names for Wiki Links.
     * @param {Array<string>} dto.offFolderNames - Array of offering folder names for Wiki Links.
     * @param {Array<string>} dto.similarCriterionNames - Array of similar criterion names.
     * @param {Array<string>} dto.mergedNames - Array of merged criterion names.
     * @returns {string} The formatted Obsidian-compatible markdown content.
     *
     * @socexplanation
     * Generates Obsidian-compatible Wiki Links for vault traversal. The Associated Requirements
     * and Offerings sections create clickable links to each entity's vault file, enabling
     * bidirectional navigation between criteria and linked entities.
     */
    static generateCriterionMaster({ criterionId, criterionFolderName, dimension, dimensionDisplayName, reqFolderNames, offFolderNames, similarCriterionNames, mergedNames }) {
        const safeCriterionName = criterionFolderName || "Unknown Criterion";
        const safeDimension = dimension || "uncategorized";
        const safeDimensionNiceName = dimensionDisplayName || safeDimension;
        const reqLinks = Array.isArray(reqFolderNames) ? reqFolderNames : [];
        const offLinks = Array.isArray(offFolderNames) ? offFolderNames : [];
        const similarLinks = Array.isArray(similarCriterionNames) ? similarCriterionNames : [];
        const mergeLinks = Array.isArray(mergedNames) ? mergedNames : [];

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const safeDeeplink = criterionId ? `${baseUrl}/criteria?criterionId=${criterionId}` : baseUrl;

        let frontmatter = "---\n";
        frontmatter += `Type: "Criterion"\n`;
        frontmatter += `Compari Link: "${safeDeeplink}"\n`;
        frontmatter += `Dimension: "${safeDimensionNiceName}"\n`;
        frontmatter += "---\n\n";

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

        return `${frontmatter}# ${safeCriterionName}

${reqSection}${offSection}${similarSection}${mergedSection}`;
    }
}

module.exports = MarkdownGenerator;
