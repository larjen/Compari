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
import { Loader2, FileSearch } from 'lucide-react';
import { EmptyState, ContentLoader } from '@/components/shared/PageStates';
import { AnimatedDataGrid } from '@/components/shared/AnimatedDataGrid';
import { EntityMatch } from '@/lib/types';
import { ITEMS_PER_PAGE } from '@/lib/ui-configs';
import { matchApi } from '@/lib/api/matchApi';
import { ENTITY_STATUS } from '@/lib/constants';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: ENTITY_STATUS.PENDING, label: 'Queued' },
  { value: ENTITY_STATUS.PROCESSING, label: 'Processing' },
  { value: ENTITY_STATUS.COMPLETED, label: 'Completed' },
  { value: ENTITY_STATUS.FAILED, label: 'Failed' }
];

function MatchesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchIdParam = searchParams.get('matchId');

  const { addToast } = useToast();
  const { activeModal, closeModal } = useModal();

  const { search, setSearch, debouncedSearch, status, setStatus, page, setPage } = useFilterState('all');

  const { matches, loading, addMatch, deleteMatch, handleMatchUpdate, totalPages, refetch } = useMatches({
    page,
    limit: ITEMS_PER_PAGE,
    search: debouncedSearch,
    status,
  });

  useEffect(() => {
    if (!loading) {
      setIsReady(true);
    }
  }, [loading]);

  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const selectedMatchData = matchIdParam ? matches.find(m => m.id === Number(matchIdParam)) || null : null;

  useEffect(() => {
    if (activeModal === 'create-match') {
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
      addToast('success', 'Match created and assessment queued');
      return matchId;
    } catch (err) {
      addToast('error', 'Failed to create match');
      throw err;
    }
  };

  const handleDeleteMatch = async (id: number) => {
    try {
      await deleteMatch(id);
      addToast('success', 'Match deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete match';
      addToast('error', message);
      throw err;
    }
  };

  const handleRetryProcessing = async (matchId: number) => {
    try {
      await matchApi.retryProcessing(matchId);
      addToast('success', 'Match assessment queued for retry');
      refetch();
    } catch (err) {
      console.error('Failed to retry:', err);
      addToast('error', 'Failed to retry match assessment');
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto min-h-full">
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 transition-opacity duration-500 ease-in-out ${isReady ? 'opacity-100' : 'opacity-0'}`}>
          <FilterBar
            searchTerm={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search matches..."
            filterValue={status}
            onFilterChange={setStatus}
            filterOptions={STATUS_OPTIONS}
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
          <EmptyState icon={FileSearch} title="No matches found" subtitle="Try adjusting your search or filter criteria" />
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