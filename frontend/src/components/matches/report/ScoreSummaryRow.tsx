import { formatPercentage } from '@/lib/utils';
import { ScoreMetrics } from './types';

/**
 * Renders a single row in the summary header displaying score, progress bar, and metrics.
 * @description
 * - SoC: Isolates the presentation of scoring data from the main report layout.
 * - Places the percentage in a plain text field on the far left.
 * - Consolidates all title and metric information (Perfect, Partial, Missed, Weight) 
 * into a single line above the progress bar to save vertical space.
 * * @param {string} title - The name of the dimension or "Global Match Score".
 * @param {ScoreMetrics} metrics - The score data object containing counts and weights.
 * @param {string} barColorClass - Tailwind text color class (e.g., 'text-blue-700') to be used as the fill.
 * @param {function} [onClick] - Optional click handler to scroll to the detailed section.
 */
export function ScoreSummaryRow({ title, metrics, barColorClass, onClick }: { title: string, metrics: ScoreMetrics, barColorClass: string, onClick?: () => void }) {
    if (!metrics) return null;
    
    const rawScore = typeof metrics.score === 'number' ? metrics.score : 0;
    const percentage = Math.round(rawScore * 100);

    return (
        <div 
            onClick={onClick}
            className="flex items-center gap-3 py-1 print:py-0 hover:bg-accent-sand/5 transition-colors cursor-pointer print:break-inside-avoid"
        >
            {/* Percentage Field on the Left */}
            <div className="w-16 print:w-12 shrink-0 text-center">
                <span className="text-lg print:text-sm font-medium text-accent-forest">{formatPercentage(rawScore)}</span>
            </div>

            {/* Right Side: Top Row (Title + Metrics) & Bottom Row (Bar) */}
            <div className="flex-1 flex flex-col justify-center py-1 min-w-0">
                
                {/* Top Row: Title and Metrics */}
                <div className="flex items-center justify-between mb-1.5 w-full gap-4">
                    <span className="text-sm print:text-xs font-semibold text-accent-forest/80 truncate" title={title}>
                        {title}
                    </span>
                    
                    {/* Metrics: Perfect, Partial, Missed, Weight aligned to the right */}
                    <div className="flex items-center text-xs print:text-[10px] text-accent-forest/60 gap-3 print:gap-2 shrink-0">
                        <span className="flex gap-1">
                            <span className="font-medium text-accent-forest">{metrics.matches || 0}</span> Perfect
                        </span>
                        <span className="flex gap-1">
                            <span className="font-medium text-accent-forest">{metrics.partialMatches || 0}</span> Partial
                        </span>
                        <span className="flex gap-1">
                            <span className="font-medium text-accent-forest">{metrics.missedMatches || 0}</span> Missed
                        </span>
                        <span className="flex gap-1">
                            <span className="font-medium text-accent-forest">{formatPercentage(metrics.weights)}</span> Weight
                        </span>
                    </div>
                </div>
                
                {/* Bottom Row: Progress Bar */}
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300/50">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 bg-current opacity-75 ${barColorClass}`} 
                        style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }} 
                    />
                </div>
                
            </div>
        </div>
    );
}