'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

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
import { EmptyState } from '@/components/shared/PageStates';
import { EntityMatch } from '@/lib/types';

const ITEMS_PER_PAGE = 12;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'error', label: 'Error' },
];

const masterContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      when: "beforeChildren"
    }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const masterItem = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { 
      duration: 0.45,
      ease: "easeOut" as const
    } 
  }
};

function MatchesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchIdParam = searchParams.get('matchId');

  const { addToast } = useToast();
  const { activeModal, closeModal } = useModal();
  
  const { search, setSearch, debouncedSearch, status, setStatus, page, setPage } = useFilterState('all');

  const { matches, loading, addMatch, deleteMatch, handleMatchUpdate, totalPages } = useMatches({
    page,
    limit: ITEMS_PER_PAGE,
    search: debouncedSearch,
    status,
  });

  const [createMatchOpen, setCreateMatchOpen] = useState(false);

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

return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto min-h-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
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
          <div className="py-20 flex justify-center items-center flex-col gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
            <p className="text-accent-forest/70 font-medium">Loading...</p>
          </div>
        ) : matches.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={`match-grid-${page}-${debouncedSearch}-${status}`}
              variants={masterContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {matches.map((match) => (
                <motion.div key={match.id} variants={masterItem}>
                  <MatchCard
                    match={match}
                    onClick={() => router.push(`?matchId=${match.id}`)}
                    onDelete={() => handleDeleteMatch(match.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
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
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-accent-sage" /></div>}>
      <MatchesPageContent />
    </Suspense>
  );
}