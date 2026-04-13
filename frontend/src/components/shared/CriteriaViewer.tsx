'use client';

import { motion } from 'framer-motion';
import { Loader2, ListChecks, Tag, Layers } from 'lucide-react';
import { Criterion } from '@/lib/types';
import { cn, getDimensionLabel } from '@/lib/utils';
import { CriterionPill } from '@/components/shared/CriterionPill';
import { useDimensions } from '@/hooks/useDimensions';

interface CriteriaViewerProps {
  criteria: Criterion[];
  isLoading: boolean;
  emptyMessage?: string;
}

export function CriteriaViewer({ criteria, isLoading, emptyMessage = 'No criteria found.' }: CriteriaViewerProps) {
  const { dimensions } = useDimensions();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-accent-forest/50 py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading criteria...</span>
      </div>
    );
  }

  if (criteria.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-accent-forest/40">
        <ListChecks className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm italic">{emptyMessage}</p>
      </div>
    );
  }

  // Group criteria by dimension
  const groupedByDimension = criteria.reduce<Record<string, Criterion[]>>((acc, criterion) => {
    const dimension = criterion.dimension || 'uncategorized';
    if (!acc[dimension]) {
      acc[dimension] = [];
    }
    acc[dimension].push(criterion);
    return acc;
  }, {});

  // Sort dimensions by a specific order
  const dimensionOrder = ['core_competencies', 'experience', 'soft_skills', 'domain_knowledge', 'cultural_fit', 'uncategorized'];
  const sortedDimensions = Object.keys(groupedByDimension).sort((a, b) => {
    const indexA = dimensionOrder.indexOf(a);
    const indexB = dimensionOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="space-y-4">
      {sortedDimensions.map((dimension, index) => {
        const dimensionCriteria = groupedByDimension[dimension];
        const label = getDimensionLabel(dimension);

        return (
          <div key={dimension}>
            <h4 className={cn('text-l font-serif font-semibold uppercase tracking-wide mb-4 flex items-center gap-1', 'text-accent-forest')}>
              <Layers className="w-3 h-3" />
              {label}
            </h4>
            <div className="flex flex-wrap gap-2">
              {dimensionCriteria.map((criterion) => {
                return (
                  <CriterionPill
                    key={criterion.id}
                    id={criterion.id}
                    label={criterion.displayName}
                    dimensionId={criterion.dimensionId ?? 0}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}