'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { CreateMatchModal } from '@/components/modals/CreateMatchModal';
import { MatchDetailModal } from '@/components/modals/MatchDetailModal';
import { MatchCard } from '@/components/matches/MatchCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { Pagination } from '@/components/shared/Pagination';
import { useMatches } from '@/hooks/useMatches';
import { useFilterState } from '@/hooks/useFilterState';
import { useToast } from '@/hooks/useToast';
import { useModal } from '@/hooks/useModal';
import { useSSE } from '@/hooks/useSSE';
import { useDeepLinkedResource } from '@/hooks/useDeepLinkedResource';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { EmptyState, ContentLoader } from '@/components/shared/PageStates';
import { AnimatedDataGrid } from '@/components/shared/AnimatedDataGrid';
import { AnimatedPageHeader } from '@/components/shared/AnimatedPageHeader';
import { EntityMatch } from '@/lib/types';
import { UI_CONFIG } from '@/lib/constants';
import { matchApi } from '@/lib/api/matchApi';
import { ENTITY_STATUS, TOAST_TYPES, MODAL_TYPES, STATUS_FILTER_OPTIONS } from '@/lib/constants';

function MatchesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchIdParam = searchParams.get('matchId');

  const { addToast } = useToast();
  const { activeModal, closeModal } = useModal();

  const { search, setSearch, debouncedSearch, status, setStatus, page, setPage } = useFilterState('all');

  const { matches, loading, addMatch, deleteMatch, handleMatchUpdate, totalPages, refetch } = useMatches({
    page,
    limit: UI_CONFIG.PAGINATION.ITEMS_PER_PAGE,
    search: debouncedSearch,
    status,
  });

  const [createMatchOpen, setCreateMatchOpen] = useState(false);

  const selectedMatchData = useDeepLinkedResource(matchIdParam, matches, 'id', matchApi.getMatch);

  useEffect(() => {
    if (activeModal === MODAL_TYPES.CREATE_MATCH) {
      setCreateMatchOpen(true);
      closeModal();
    }
  }, [activeModal, closeModal]);

  useSSE({
    onMatchUpdate: handleMatchUpdate,
  });

  const handleCreateMatch = async (sourceId: number, targetId: number): Promise<number> => {
    try {
      const matchId = await addMatch(sourceId, targetId);
      addToast(TOAST_TYPES.SUCCESS, 'Match created and assessment queued');
      return matchId;
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to create match');
      throw err;
    }
  };

  const handleDeleteMatch = async (id: number) => {
    try {
      await deleteMatch(id);
      addToast(TOAST_TYPES.SUCCESS, 'Match deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete match';
      addToast(TOAST_TYPES.ERROR, message);
      throw err;
    }
  };

  const handleRetryProcessing = async (matchId: number) => {
    try {
      await matchApi.retryProcessing(matchId);
      addToast(TOAST_TYPES.SUCCESS, 'Match assessment queued for retry');
      refetch();
    } catch (err) {
      console.error('Failed to retry:', err);
      addToast(TOAST_TYPES.ERROR, 'Failed to retry match assessment');
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto min-h-full">
        <AnimatedPageHeader loading={loading}>
          <FilterBar
            searchTerm={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search matches..."
            filterValue={status}
            onFilterChange={setStatus}
            filterOptions={STATUS_FILTER_OPTIONS}
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

        {loading && matches.length === 0 ? (
          <ContentLoader />
        ) : matches.length > 0 ? (
          <AnimatedDataGrid
            items={matches}
            loading={loading}
            page={page}
            search={debouncedSearch}
            status={status}
            gridKeyPrefix="match-grid"
            renderItem={(match) => (
              <MatchCard
                match={match}
                onClick={() => router.push(`?matchId=${match.id}`)}
                onDelete={() => handleDeleteMatch(match.id)}
                onRetry={() => handleRetryProcessing(match.id)}
              />
            )}
          />
        ) : (
          <EmptyState icon="MATCH" title="No matches found" subtitle="Try adjusting your search or filter criteria" />
        )}
      </div>

      <CreateMatchModal
        open={createMatchOpen}
        onClose={() => setCreateMatchOpen(false)}
        onCreateMatch={handleCreateMatch}
      />

      <MatchDetailModal
        match={selectedMatchData}
        open={!!selectedMatchData}
        onClose={() => router.push('/matches')}
        onDelete={handleDeleteMatch}
      />
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<ContentLoader delay={200} />}>
      <MatchesPageContent />
    </Suspense>
  );
}