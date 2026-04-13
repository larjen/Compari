'use client';

import { motion } from 'framer-motion';
import { formatPercentage, getDimensionColors } from '@/lib/utils';
import { MatchReportData, CategorizedMatches, RawMatchItem, ScoreMetrics, MatchScores, ReportInfo } from './report/types';
import { SummaryBox } from './report/SummaryBox';
import { ScoreSummaryRow } from './report/ScoreSummaryRow';
import { MatchCategorySection } from './report/MatchCategorySection';

export type { RawMatchItem, ScoreMetrics, MatchScores, ReportInfo, CategorizedMatches, MatchReportData };
export { ScoreSummaryRow };

interface MatchReportViewerProps {
    reportData: MatchReportData | null;
    matchId?: number;
    isPrintMode?: boolean;
}

/**
 * Main component for displaying the match report in a flat, dumbed-down manner.
 * Uses the new report structure:
 * - reportInfo for requirement/offering names and matchScores (weights + scores)
 * - allDimensions at root for global pool-wide matches
 * - Dimension keys at root for each dimension's matches
 * No categorization into strong/partialMatch/missing - just the raw flat list.
 *
 * @dry_principles
 * - Uses reportInfo for entity names instead of duplicating requirement/offering at root.
 * - Dynamically iterates over dimension keys at root level (excluding reportInfo, allDimensions).
 */
export function MatchReportViewer({ reportData, matchId, isPrintMode = false }: MatchReportViewerProps) {
    if (!reportData) {
        return (
            <div className="flex items-center justify-center h-40 text-accent-forest/40">
                <p className="text-sm">No report data available</p>
            </div>
        );
    }

    const reportInfo = reportData.reportInfo || { requirement: { id: 0, name: '' }, offering: { id: 0, name: '' }, matchScores: {} };
    const matchScores = reportInfo.matchScores || {};

    const availableDimensionKeys = Object.keys(reportData).filter(key => 
        key !== 'reportInfo' && 
        key !== 'allDimensions' && 
        !key.startsWith('_') && // Filter out injected metadata keys from Phase 1
        typeof reportData[key] === 'object' && 
        reportData[key] !== null
    );

    const sortedDimensions = availableDimensionKeys;

    return (
        <div className="space-y-4">
            <motion.div
                id="match-report-content"
                initial={isPrintMode ? false : { opacity: 0, y: 10 }}
                animate={isPrintMode ? false : { opacity: 1, y: 0 }}
                className={`space-y-8 pb-8 ${isPrintMode ? 'bg-white text-black print:p-0 print:m-0 w-full max-w-none' : ''}`}
            >
            {/* MATCH REPORT HEADER */}
            <div className="text-center pb-2 mb-6">
                <h2 className="text-2xl font-black text-accent-forest mb-2 uppercase tracking-tight">
                    Match Assessment Report
                </h2>
                <h3 className="text-lg font-semibold text-accent-forest/90">
                    {reportInfo.requirement.name}
                </h3>
                <h3 className="text-lg font-medium text-accent-forest/70 mt-1">
                    {reportInfo.offering.name}
                </h3>
            </div>

            {/* DIMENSION SCORES SECTION */}
            <section id="section-dimension-scores" className="pb-0 mb-8 print:mb-4">
                <div className="border-b border-accent-sand/30 pb-3 mb-4">
                    <h3 className="text-xl font-bold text-accent-forest uppercase tracking-wide">
                        Dimension Scores
                    </h3>
                </div>

                <div className="space-y-0">
                    {/* Global Score Row */}
                    {matchScores.allDimensions && (
                        <ScoreSummaryRow 
                            title="Global Match Score" 
                            metrics={matchScores.allDimensions} 
                            barColorClass="text-accent-forest" 
                            onClick={() => document.getElementById('section-global')?.scrollIntoView({ behavior: 'smooth' })}
                        />
                    )}

                    {/* Individual Dimension Score Rows */}
                    {sortedDimensions.map((dimKey) => {
                        const dimMetrics = matchScores[dimKey];
                        if (!dimMetrics) return null;
                        
                        const dimId = (reportData as any)._metadata?.dimension_ids?.[dimKey] || 0;
                        const dimensionColors = getDimensionColors(dimId);
                        const barColor = dimensionColors?.text || 'text-accent-forest';

                        return (
                            <ScoreSummaryRow 
                                key={`summary-${dimKey}`}
                                title={dimKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                metrics={dimMetrics}
                                barColorClass={barColor}
                                onClick={() => document.getElementById(`section-${dimKey}`)?.scrollIntoView({ behavior: 'smooth' })}
                            />
                        );
                    })}
                </div>
            </section>

            {sortedDimensions.length === 0 && availableDimensionKeys.length === 0 && (
                <p className="text-sm text-accent-forest/40 italic py-4">No match data available</p>
            )}

            {/* EXECUTIVE SUMMARY SECTION */}
            {(reportData as any)?._ai_summary_executive && (
                <section id="section-executive-summary" className="space-y-2 pt-0 mb-8">
                    <div className="border-b border-accent-sand/30 pb-3 mb-2">
                        <h3 className="text-xl font-bold text-accent-forest uppercase tracking-wide">
                            Executive Summary
                        </h3>
                    </div>
                    <SummaryBox content={(reportData as any)?._ai_summary_executive} />
                </section>
            )}

            {/* GLOBAL REQUIREMENTS SECTION */}
            {reportData.allDimensions && (reportData.allDimensions.perfectMatch?.length > 0 || reportData.allDimensions.partialMatch?.length > 0 || reportData.allDimensions.missedMatch?.length > 0) && (
                <section id="section-global" className="space-y-2 pt-2 mb-12 print:break-before-page">
                    <div className="flex items-center justify-between border-b border-accent-sand/30 pb-3 mb-2">
                        <h3 className="text-xl font-bold text-accent-forest uppercase tracking-wide">
                            Global Requirements
                        </h3>
                        {matchScores.allDimensions && (
                            <span className="text-sm font-medium text-accent-forest/70">
                                Weight: {formatPercentage(matchScores.allDimensions.weights)}
                                {matchScores.allDimensions.score !== null && matchScores.allDimensions.score !== undefined && (
                                    <> | Score: {formatPercentage(matchScores.allDimensions.score)}</>
                                )}
                            </span>
                        )}
                    </div>
                    
                    <MatchCategorySection items={reportData.allDimensions.perfectMatch} title="Perfect Matches" dimensionId={0} matchType="perfect" />
                    <MatchCategorySection items={reportData.allDimensions.partialMatch} title="Partial Matches" dimensionId={0} matchType="partial" />
                    <MatchCategorySection items={reportData.allDimensions.missedMatch} title="Missed Matches" dimensionId={0} matchType="missed" />
                </section>
            )}

            {/* INDIVIDUAL DIMENSIONS LOOP */}
            {sortedDimensions.map((dimKey) => {
                const categoryData = reportData[dimKey] as CategorizedMatches | undefined;
                const dimMatchScore = matchScores[dimKey];
                const currentDimId = (reportData as any)._metadata?.dimension_ids?.[dimKey] || 0;
                const currentDimColors = getDimensionColors(currentDimId);
                
                if (!categoryData) return null;

                return (
                    <section key={dimKey} id={`section-${dimKey}`} className="space-y-2 pt-6 mb-12 print:break-before-page">
                        <div className="flex items-center justify-between border-b border-accent-sand/30 pb-3 mb-2">
                            <h3 className="text-xl font-bold text-accent-forest uppercase tracking-wide">
                                {dimKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h3>
                            {dimMatchScore && (
                                <span className="text-sm font-medium text-accent-forest/70">
                                    Weight: {formatPercentage(dimMatchScore.weights)}
                                    {dimMatchScore.score !== null && dimMatchScore.score !== undefined && (
                                        <> | Score: {formatPercentage(dimMatchScore.score)}</>
                                    )}
                                </span>
                            )}
                        </div>
                        
                        <SummaryBox 
                            content={(reportData as any)?._ai_summaries_dimensional?.[dimKey]} 
                        />
                        
                        <MatchCategorySection items={categoryData.perfectMatch} title="Perfect Matches" dimensionId={currentDimId} matchType="perfect" />
                        <MatchCategorySection items={categoryData.partialMatch} title="Partial Matches" dimensionId={currentDimId} matchType="partial" />
                        <MatchCategorySection items={categoryData.missedMatch} title="Missed Matches" dimensionId={currentDimId} matchType="missed" />
                    </section>
                );
            })}

            {/* Fallback: No additional dimensions needed */}
        </motion.div>
        </div>
    );
}