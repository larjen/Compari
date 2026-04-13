import { RawMatchItem } from './types';
import { FlatMatchCard } from './FlatMatchCard';

/**
 * Renders a specific category of matches (e.g., Perfect, Partial, Missed).
 */
function MatchCategorySection({ items, title, dimensionId, matchType }: { items: RawMatchItem[] | undefined, title: string, dimensionId: number, matchType: 'perfect' | 'partial' | 'missed' }) {
    if (!items || items.length === 0) return null;

    const sortedItems = [...items].sort((a, b) => b.similarityScore - a.similarityScore);

    return (
        <div className="mt-8 space-y-3">
            <h4 className="flex items-center gap-2 text-lg font-semibold text-accent-forest/80 uppercase tracking-wider border-b border-accent-forest/10 pb-2 pt-2 print:break-after-avoid">
                {title} 
                <span className="font-sans text-sm font-bold tracking-normal text-accent-forest bg-accent-forest/10 px-2.5 py-0.5 rounded-full">
                    {items.length}
                </span>
            </h4>
            {sortedItems.map((item, idx) => (
                <FlatMatchCard
                    key={`card-${item.reqId}-${idx}`}
                    matchItem={item}
                    fallbackDimensionId={dimensionId}
                    matchType={matchType}
                />
            ))}
        </div>
    );
}

export { MatchCategorySection };