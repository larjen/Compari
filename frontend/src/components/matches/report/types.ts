/**
 * Raw match item representing a 1-to-1 mapping between a requirement criterion
 * and its best matched offering criterion within a specific dimension.
 */
export interface RawMatchItem {
    reqCriteria: string;
    reqId: number;
    offCriteria: string | null;
    offId: number | null;
    similarityScore: number;
    dimension?: string;
    dimensionName?: string;
    dimensionId?: number;
}

/**
 * Detailed scoring metrics for a specific dimension or global pool.
 */
export interface ScoreMetrics {
    score: number;
    weights: number;
    matches: number;        // Represents perfect matches
    partialMatches: number; // Represents partial matches
    missedMatches: number;  // Represents missed matches
}

/**
 * Match scores object containing metrics for all dimensions and specific dimensions.
 */
export interface MatchScores {
    allDimensions: ScoreMetrics;
    [dimensionKey: string]: ScoreMetrics;
}

/**
 * Report info containing requirement, offering, and match scores.
 */
export interface ReportInfo {
    requirement: { id: number; name: string };
    offering: { id: number; name: string };
    matchScores: MatchScores;
}

/**
 * Represents the sliced arrays of criteria matches based on their similarity scores.
 */
export interface CategorizedMatches {
    perfectMatch: RawMatchItem[];
    partialMatch: RawMatchItem[];
    missedMatch: RawMatchItem[];
}

/**
 * Complete match report data structure with categorized match sections.
 * Includes AI-generated summaries for executive summary and dimensional breakdowns.
 */
export interface MatchReportData {
    reportInfo: ReportInfo;
    allDimensions: CategorizedMatches;
    _ai_summary_executive?: string;
    _ai_summaries_dimensional?: Record<string, string>;
    [dimensionKey: string]: CategorizedMatches | ReportInfo | string | Record<string, string> | undefined;
}