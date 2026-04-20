'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCriteria } from '@/hooks/useCriteria';
import { useEntities } from '@/hooks/useEntities';
import { useModal } from '@/hooks/useModal';
import { useDimensions } from '@/hooks/useDimensions';
import { useFilterState } from '@/hooks/useFilterState';
import { useDeepLinkedResource } from '@/hooks/useDeepLinkedResource';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { EmptyState, ContentLoader } from '@/components/shared/PageStates';
import { Criterion } from '@/lib/types';
import { CriterionDetailModal, EntityDetailModal } from '@/components/modals';
import { Pagination } from '@/components/shared/Pagination';
import { FilterBar } from '@/components/shared/FilterBar';
import { CriteriaViewer } from '@/components/shared/CriteriaViewer';
import { AnimatedPageHeader } from '@/components/shared/AnimatedPageHeader';
import { criteriaApi } from '@/lib/api/criteriaApi';

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
  const { closeModal } = useModal();

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

  const criterionIdParam = searchParams.get('criterionId');
  const sourceIdParam = searchParams.get('sourceId');
  const targetIdParam = searchParams.get('targetId');

  const { entities: allEntities, loading: entitiesLoading, refetch: refetchEntities } = useEntities({ immediate: !!(sourceIdParam || targetIdParam) });
  const { dimensions } = useDimensions();

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

  const selectedCriterion = useDeepLinkedResource(criterionIdParam, criteria, 'id', criteriaApi.getCriterion);

  const inspectedSource = sourceIdParam
    ? allEntities.find(e => e.id === Number(sourceIdParam)) || null
    : null;
  const inspectedTarget = targetIdParam
    ? allEntities.find(e => e.id === Number(targetIdParam)) || null
    : null;

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto w-full min-h-full">
        <AnimatedPageHeader loading={loading}>
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
        </AnimatedPageHeader>

        {loading && criteria.length === 0 ? (
          <ContentLoader text="Loading criteria..." />
        ) : criteria.length > 0 ? (
          <CriteriaViewer
            criteria={criteria}
            isLoading={loading}
            page={page}
            search={debouncedSearch}
            status={selectedDimension}
            gridKeyPrefix="criteria-grid"
          />
        ) : (
          <EmptyState
            icon="CRITERIA"
            title={search ? "No matching criteria" : "No criteria yet"}
            subtitle={search ? "Try a different search term" : "Criteria will be extracted from entities automatically"}
          />
        )}
      </div>
      <CriterionDetailModal
        criterion={selectedCriterion}
        open={!!selectedCriterion}
        onClose={() => {
          closeModal();
          router.push('/criteria');
        }}
        onDelete={deleteCriterion}
        onSourceClick={(entity) => router.push(`/?entityId=${entity.id}`)}
        onTargetClick={(entity) => router.push(`/offerings?entityId=${entity.id}`)}
        onMerged={() => {
          closeModal();
          router.push('/criteria');
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