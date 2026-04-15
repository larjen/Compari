'use client';

import { useMemo } from 'react';
import { Loader2, ListChecks } from 'lucide-react';
import { Criterion } from '@/lib/types';
import { getDimensionLabel } from '@/lib/utils';
import { CriterionPill } from '@/components/shared/CriterionPill';
import { useDimensions } from '@/hooks/useDimensions';
import { AnimatedDataGrid } from '@/components/shared/AnimatedDataGrid';

interface CriteriaViewerProps {
  criteria: Criterion[];
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  search?: string;
  status?: string;
  gridKeyPrefix?: string;
}

/**
 * @component CriteriaViewer
 * @description A shared, animated grid for rendering criteria grouped by dimension.
 * @responsibility Consolidates grouping and animation logic so criteria look identical whether viewed on a full page or inside an entity modal.
 */
export function CriteriaViewer({ 
  criteria, 
  isLoading = false, 
  emptyMessage = 'No criteria found.',
  page = 1,
  search = '',
  status = 'all',
  gridKeyPrefix = 'criteria-viewer'
}: CriteriaViewerProps) {
  const { dimensions } = useDimensions();

  // Group and sort criteria exactly as the master page does
  const { displayGroups, sortedDimensions } = useMemo(() => {
    const groups = criteria.reduce((acc, criterion) => {
      const dim = criterion.dimension || 'uncategorized';
      if (!acc[dim]) acc[dim] = [];
      acc[dim].push(criterion);
      return acc;
    }, {} as Record<string, Criterion[]>);

    const sortedDims = Object.keys(groups).sort((a, b) => {
      if (a === 'uncategorized') return 1;
      if (b === 'uncategorized') return -1;

      const dimA = dimensions?.find(d => d.name === a || String(d.id) === a);
      const dimB = dimensions?.find(d => d.name === b || String(d.id) === b);

      const idA = dimA?.id ?? null;
      const idB = dimB?.id ?? null;

      if (idA !== null && idB !== null) {
        if (idA !== idB) return idA - idB;
      } else if (idA !== null) return -1;
      else if (idB !== null) return 1;

      return a.localeCompare(b);
    });

    return { displayGroups: groups, sortedDimensions: sortedDims };
  }, [criteria, dimensions]);

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

  return (
    <AnimatedDataGrid
      loading={isLoading}
      page={page}
      search={search}
      status={status}
      gridKeyPrefix={gridKeyPrefix}
      groups={displayGroups}
      sortedGroups={sortedDimensions}
      renderGroupHeader={(dimension, itemCount) => (
        <h2 className="text-xl font-serif font-semibold border-b border-border-light pb-2 text-accent-forest">
          {getDimensionLabel(dimension as string)}
          <span className="ml-2 text-sm font-sans font-normal text-accent-forest/50">
            ({itemCount})
          </span>
        </h2>
      )}
      renderGroupItem={(criterion) => (
        <CriterionPill
          id={criterion.id}
          label={criterion.displayName}
          dimensionId={criterion.dimensionId ?? 0}
        />
      )}
      className="space-y-10"
      staggerDelay={0.008}
      exitDuration={0.05}
    />
  );
}