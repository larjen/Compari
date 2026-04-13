import { CornerDownRight } from 'lucide-react';
import { CriterionPill } from '@/components/shared/CriterionPill';
import { formatPercentage } from '@/lib/utils';
import { RawMatchItem } from './types';

function FlatMatchCard({ matchItem, fallbackDimensionId, matchType }: { matchItem: RawMatchItem; fallbackDimensionId: number; matchType: 'perfect' | 'partial' | 'missed' }) {
    const percentageStr = matchItem.offCriteria === null
        ? '0%'
        : formatPercentage(matchItem.similarityScore);

    // Enforce black text and add subtle matching borders for all states
    let circleBgClass = "bg-accent-sand/20 text-black border border-accent-sand/30";
    if (matchType === 'perfect') circleBgClass = "bg-emerald-100 text-black border border-emerald-200";
    else if (matchType === 'partial') circleBgClass = "bg-amber-100 text-black border border-amber-200";
    else if (matchType === 'missed') circleBgClass = "bg-rose-100 text-black border border-rose-200";

    const actualDimensionId = matchItem.dimensionId ?? fallbackDimensionId;

    return (
        <div className="flex items-center gap-4 print:gap-3 py-3 print:py-1.5 print:break-inside-avoid">
            {/* Increased size to 72px and applied the new border classes */}
            <div className={`flex items-center justify-center w-[60px] h-[60px] print:w-[36px] print:h-[36px] rounded-full shrink-0 shadow-sm print:shadow-none ${circleBgClass}`}>
                <span className="text-sm print:text-[9px] font-medium">
                    {percentageStr}
                </span>
            </div>

            <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
                <div className="min-w-0 w-full">
                    <CriterionPill
                        id={matchItem.reqId}
                        label={matchItem.reqCriteria}
                        dimensionId={actualDimensionId}
                        className="max-w-full truncate bg-white shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-2 min-w-0 w-full">
                    <CornerDownRight className="w-4 h-4 text-gray-400 shrink-0" />
                    {matchItem.offCriteria === null ? (
                        <div className="px-4 py-2 rounded-full text-sm font-medium border bg-white/60 text-gray-500 border-gray-200 max-w-full truncate">
                            No match found
                        </div>
                    ) : (
                        <div className="min-w-0 flex-1">
                            <CriterionPill
                                id={matchItem.offId!}
                                label={matchItem.offCriteria}
                                dimensionId={actualDimensionId}
                                className="max-w-full truncate bg-white shadow-sm"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export { FlatMatchCard };