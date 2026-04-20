import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { CriterionPill } from '@/components/shared/CriterionPill';
import { formatPercentage } from '@/lib/utils';
import { RawMatchItem } from './types';
import { MatchCategory, MATCH_CATEGORIES } from '@/lib/constants';

function FlatMatchCard({ matchItem, fallbackDimensionId, matchType }: { matchItem: RawMatchItem; fallbackDimensionId: number; matchType: MatchCategory }) {
    const percentageStr = matchItem.offCriteria === null
        ? '0%'
        : formatPercentage(matchItem.similarityScore);

    // Enforce black text and add subtle matching borders for all states
    let circleBgClass = "bg-accent-sand/20 text-black border border-accent-sand/30";
    if (matchType === MATCH_CATEGORIES.PERFECT) circleBgClass = "bg-emerald-100 text-black border border-emerald-200";
    else if (matchType === MATCH_CATEGORIES.PARTIAL) circleBgClass = "bg-amber-100 text-black border border-amber-200";
    else if (matchType === MATCH_CATEGORIES.MISSED) circleBgClass = "bg-rose-100 text-black border border-rose-200";

    const actualDimensionId = matchItem.dimensionId ?? fallbackDimensionId;

    return (
        <div className="flex items-center gap-4 print:gap-3 pt-3 pb-0 print:pt-1.5 print:pb-0 print:break-inside-avoid">
            {/* Screen circle remains 50px, print circle shrinks proportionally to 36px */}
            <div className={`flex items-center justify-center w-[50px] h-[50px] print:w-[36px] print:h-[36px] rounded-full shrink-0 shadow-sm print:shadow-none ${circleBgClass}`}>
                <span className="text-[0.7rem] print:text-[10px] font-medium pl-[5px] print:pl-[3px]">
                    {percentageStr}
                </span>
            </div>

            <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
                <div className="min-w-0 w-full">
                    <CriterionPill
                        id={matchItem.reqId}
                        label={matchItem.reqCriteria}
                        dimensionId={actualDimensionId}
                        className="max-w-full truncate bg-white shadow-sm text-xs px-2.5 py-1 print:px-2 print:py-0.5 print:text-[8px]"
                    />
                </div>

                <div className="flex items-center gap-2 min-w-0 w-full">
                    <DOMAIN_ICONS.INDENT className="w-4 h-4 text-gray-400 shrink-0" />
                    {matchItem.offCriteria === null ? (
                        <div className="px-2.5 py-1 print:px-2 print:py-0.5 rounded-full text-xs print:text-[8px] font-medium border bg-white/60 text-gray-500 border-gray-200 max-w-full truncate">
                            No match found
                        </div>
                    ) : (
                        <div className="min-w-0 flex-1">
                            <CriterionPill
                                id={matchItem.offId!}
                                label={matchItem.offCriteria}
                                dimensionId={actualDimensionId}
                                className="max-w-full truncate bg-white shadow-sm text-xs px-2.5 py-1 print:px-2 print:py-0.5 print:text-[8px]"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export { FlatMatchCard };