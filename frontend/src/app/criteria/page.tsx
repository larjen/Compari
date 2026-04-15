'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCriteria } from '@/hooks/useCriteria';
import { useEntities } from '@/hooks/useEntities';
import { useModal } from '@/hooks/useModal';
import { useDimensions } from '@/hooks/useDimensions';
import { useFilterState } from '@/hooks/useFilterState';
import { Loader2, ListChecks } from 'lucide-react';
import { EmptyState, ContentLoader } from '@/components/shared/PageStates';
import { Criterion } from '@/lib/types';
import { CriterionDetailModal, EntityDetailModal } from '@/components/modals';
import { Pagination } from '@/components/shared/Pagination';
import { FilterBar } from '@/components/shared/FilterBar';
import { CriteriaViewer } from '@/components/shared/CriteriaViewer';

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

  const [isReady, setIsReady] = useState(false);
  const [deepLinkedCriterion, setDeepLinkedCriterion] = useState<Criterion | null>(null);
  const [isFetchingDeepLink, setIsFetchingDeepLink] = useState(false);

  const criterionIdParam = searchParams.get('criterionId');
  const sourceIdParam = searchParams.get('sourceId');
  const targetIdParam = searchParams.get('targetId');

  useEffect(() => {
    if (!loading) {
      setIsReady(true);
    }
  }, [loading]);

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

  // Deep-link fallback: fetch criterion directly if not in local array
  const criterionId = criterionIdParam ? parseInt(criterionIdParam, 10) : null;
  const localCriterion = criterionId ? criteria.find((c: any) => c.id === criterionId) : null;

  useEffect(() => {
    if (criterionId && !localCriterion && !deepLinkedCriterion && !isFetchingDeepLink) {
      const fetchDeepLink = async () => {
        setIsFetchingDeepLink(true);
        try {
          const response = await fetch(`/api/criteria/${criterionId}`);
          if (response.ok) {
            const data = await response.json();
            setDeepLinkedCriterion(data);
          }
        } catch (error) {
          console.error("Failed to fetch deep-linked criterion:", error);
        } finally {
          setIsFetchingDeepLink(false);
        }
      };
      fetchDeepLink();
    }
  }, [criterionId, localCriterion, deepLinkedCriterion, isFetchingDeepLink]);

  useEffect(() => {
    if (!criterionId && deepLinkedCriterion) {
      setDeepLinkedCriterion(null);
    }
  }, [criterionId, deepLinkedCriterion]);

  const selectedCriterion = localCriterion || deepLinkedCriterion;

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
            icon={ListChecks}
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