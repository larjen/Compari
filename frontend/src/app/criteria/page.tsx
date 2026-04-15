'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCriteria } from '@/hooks/useCriteria';
import { useEntities } from '@/hooks/useEntities';
import { useModal } from '@/hooks/useModal';
import { useDimensions } from '@/hooks/useDimensions';
import { useFilterState } from '@/hooks/useFilterState';
import { Loader2, Target } from 'lucide-react';
import { EmptyState, ContentLoader } from '@/components/shared/PageStates';
import { CriterionPill } from '@/components/shared/CriterionPill';
import { Criterion } from '@/lib/types';
import { getDimensionLabel, cn } from '@/lib/utils';
import { CriterionDetailModal, EntityDetailModal } from '@/components/modals';
import { Pagination } from '@/components/shared/Pagination';
import { FilterBar } from '@/components/shared/FilterBar';
import { AnimatedDataGrid } from '@/components/shared/AnimatedDataGrid';

/**
 * Global variants for the criteria results list.
 * @description
 * - masterContainer: Orchestrates a single stagger effect across the entire page.
 * - masterItem: A simple pure-fade for headers and pills.
 */

/**
 * Criteria page content component.
 * Implements server-side pagination and filtering for scalable criteria management.
 * 
 * @critical_architecture
 * - Server-side: Pagination, filtering by search/dimension, and sorting by dimension then displayName.
 * - Client-side: Only grouping logic (reduce) to organize criteria by dimension for display.
 * - This eliminates the critical flaw of loading all criteria into frontend memory at once.
 */
function CriteriaPageContent() {
  // =============================================================================
  // HOOK INITIALIZATION BLOCK
  // =============================================================================
  // All hooks must be called unconditionally at the top level to comply with
  // React Rules of Hooks. This ensures consistent hook call order across renders.
  // See: https://react.dev/warnings/invalid-hook-call-warning

  const router = useRouter();
  const searchParams = useSearchParams();
  const { originatingViewID, closeModal } = useModal();

  const { search, setSearch, debouncedSearch, status: selectedDimension, setStatus: setSelectedDimension, page, setPage } = useFilterState('all');
  
  const LIMIT = 200;
  
  const { 
    criteria, 
    totalPages, 
    totalCount,
    loading, 
    error, 
    refetch, 
    deleteCriterion 
  } = useCriteria({ 
    page, 
    limit: LIMIT, 
    search: debouncedSearch, 
    dimension: selectedDimension === 'all' ? undefined : selectedDimension,
    immediate: true
  });

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setIsReady(true);
    }
  }, [loading]);

  const { entities: allEntities, loading: entitiesLoading, refetch: refetchEntities } = useEntities({ immediate: true });
  const { dimensions } = useDimensions();

  const criterionIdParam = searchParams.get('criterionId');
  const sourceIdParam = searchParams.get('sourceId');
  const targetIdParam = searchParams.get('targetId');

  // =============================================================================
  // CLIENT-SIDE GROUPING BLOCK
  // =============================================================================
  // Only groups criteria by dimension. Sorting is done server-side.
  // The server returns criteria sorted by dimension (alphabetically, nulls last),
  // then by displayName (alphabetically). This ensures dimension headers persist across pages.
  
  /**
   * Groups and sorts criteria by dimension database ID.
   * @description 
   * - Groups criteria by their dimension property.
   * - Sorts groups based on the numeric database ID.
   * - Gracefully handles missing dimension data and 'uncategorized' fallbacks.
   */
  const { displayGroups, sortedDimensions } = useMemo(() => {
    // Group criteria
    const groups = criteria.reduce((acc, criterion) => {
      const dim = criterion.dimension || 'uncategorized';
      if (!acc[dim]) acc[dim] = [];
      acc[dim].push(criterion);
      return acc;
    }, {} as Record<string, Criterion[]>);

    // Sort dimension names based on their database IDs
    const sortedDims = Object.keys(groups).sort((a, b) => {
      // 1. Force 'uncategorized' to the very bottom
      if (a === 'uncategorized') return 1;
      if (b === 'uncategorized') return -1;

      // 2. Identify numeric IDs
      // Check if 'a' is already a stringified ID or find the ID in the dimensions list
      const dimA = dimensions?.find(d => d.name === a || String(d.id) === a);
      const dimB = dimensions?.find(d => d.name === b || String(d.id) === b);

      const idA = dimA?.id ?? null;
      const idB = dimB?.id ?? null;

      // 3. Numerical Comparison (Handle nulls/missing data)
      if (idA !== null && idB !== null) {
        if (idA !== idB) return idA - idB;
      } else if (idA !== null) {
        return -1; // Found ID comes before missing ID
      } else if (idB !== null) {
        return 1;
      }

      // 4. Final Fallback: Stable alphabetical sort by the name
      return a.localeCompare(b);
    });

    return {
      displayGroups: groups,
      sortedDimensions: sortedDims
    };
  }, [criteria, dimensions]);

  // =============================================================================
  // CONDITIONAL RENDERING BLOCK
  // =============================================================================
  // All hooks have been called above. Safe to perform conditional returns now.

  const isLoading = loading || entitiesLoading;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <p className="text-red-600 font-medium">Error: {error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-accent-sage text-white rounded-md hover:bg-accent-sage/80 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  // =============================================================================
  // RENDER LOGIC BLOCK
  // =============================================================================

  const selectedCriterion = criterionIdParam
    ? criteria.find(c => c.id === Number(criterionIdParam)) || null
    : null;

  const inspectedSource = sourceIdParam
    ? allEntities.find(e => e.id === Number(sourceIdParam)) || null
    : null;
  const inspectedTarget = targetIdParam
    ? allEntities.find(e => e.id === Number(targetIdParam)) || null
    : null;

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto w-full min-h-full">
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 transition-opacity duration-500 ease-in-out ${isReady ? 'opacity-100' : 'opacity-0'}`}>
          <FilterBar
            searchTerm={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search criteria..."
            filterValue={selectedDimension}
            onFilterChange={setSelectedDimension}
            filterOptions={[
              { value: 'all', label: 'All' },
              ...(dimensions?.map(dim => ({ value: dim.name, label: dim.displayName })) || [])
            ]}
            className="flex-1"
          />
          
          {totalPages > 1 && (
            <Pagination 
              currentPage={page} 
              totalPages={totalPages} 
              onPageChange={setPage} 
            />
          )}
        </div>

        {loading && criteria.length === 0 ? (
          <ContentLoader text="Loading criteria..." />
        ) : criteria.length > 0 ? (
          <AnimatedDataGrid
            loading={loading}
            page={page}
            search={debouncedSearch}
            status={selectedDimension}
            gridKeyPrefix="criteria-grid"
            groups={displayGroups}
            sortedGroups={sortedDimensions}
            renderGroupHeader={(dimension, itemCount) => (
              <h2 className="text-xl font-serif font-semibold border-b border-border-light pb-2 text-accent-forest">
                {getDimensionLabel(dimension)}
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
        ) : (
          <EmptyState
            icon={Target}
            title={search ? "No matching criteria" : "No criteria yet"}
            subtitle={search ? "Try a different search term" : "Criteria will be extracted from entities automatically"}
          />
        )}
      </div>
      <CriterionDetailModal
        criterion={selectedCriterion}
        open={!!selectedCriterion}
        onClose={() => {
          const path = originatingViewID || '/criteria';
          closeModal();
          router.push(path);
        }}
        onDelete={deleteCriterion}
        onSourceClick={(entity) => router.push(`?sourceId=${entity.id}&criterionId=${selectedCriterion?.id}`)}
        onTargetClick={(entity) => router.push(`?targetId=${entity.id}&criterionId=${selectedCriterion?.id}`)}
        onMerged={() => {
          const path = originatingViewID || '/criteria';
          closeModal();
          router.push(path);
        }}
      />
      <EntityDetailModal
        entity={inspectedSource}
        open={!!inspectedSource}
        onClose={() => router.push(criterionIdParam ? `?criterionId=${criterionIdParam}` : '/criteria')}
        onDelete={async () => { }}
      />
      <EntityDetailModal
        entity={inspectedTarget}
        open={!!inspectedTarget}
        onClose={() => router.push(criterionIdParam ? `?criterionId=${criterionIdParam}` : '/criteria')}
        onDelete={async () => { }}
      />
    </div>
  );
}

export default function CriteriaPage() {
  return (
    <Suspense fallback={<ContentLoader delay={200} />}>
      <CriteriaPageContent />
    </Suspense>
  );
}
