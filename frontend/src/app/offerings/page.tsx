'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

import { EntityCard } from '@/components/entities/EntityCard';
import { CreateEntityModal } from '@/components/entities/CreateEntityModal';
import { EntityDetailModal } from '@/components/entities/EntityDetailModal';
import { useEntities } from '@/hooks/useEntities';
import { useFilterState } from '@/hooks/useFilterState';
import { useToast } from '@/hooks/useToast';
import { useSSE } from '@/hooks/useSSE';
import { useModal } from '@/hooks/useModal';
import { useBlueprints } from '@/hooks/useBlueprints';
import { entityApi } from '@/lib/api/entityApi';
import { Entity } from '@/lib/types';
import { CreateEntityData } from '@/lib/api/entityApi';
import { getNuancedEntityName } from '@/lib/utils';
import { ENTITY_STATUS } from '@/lib/constants';
import { Loader2, Users as UsersIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/PageStates';
import { Pagination } from '@/components/shared/Pagination';
import { FilterBar } from '@/components/shared/FilterBar';

const ITEMS_PER_PAGE = 12;

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

function OfferingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityIdParam = searchParams.get('entityId');

  const { addToast } = useToast();
  const { activeModal, closeModal } = useModal();
  
  const { search, setSearch, debouncedSearch, status, setStatus, page, setPage } = useFilterState('all');
  
  const {
    entities: offerings,
    loading,
    addEntity,
    deleteEntity,
    refetch,
    totalPages,
  } = useEntities({
    type: 'offering',
    page,
    limit: ITEMS_PER_PAGE,
    search: debouncedSearch,
    status,
  });
  
  const { blueprints } = useBlueprints();

  const activeBlueprint = blueprints.find(b => b.is_active) || blueprints[0];
  const offeringLabelSingular = activeBlueprint?.offeringLabelSingular || 'Offering';
  const offeringLabelPlural = activeBlueprint?.offeringLabelPlural || 'Offerings';

  const [createEntityOpen, setCreateEntityOpen] = useState(false);

  const selectedEntityData = entityIdParam 
    ? offerings.find(e => e.id === Number(entityIdParam)) || null 
    : null;

  useEffect(() => {
    if (activeModal === 'create-offering') {
      setCreateEntityOpen(true);
      closeModal();
    }
  }, [activeModal, closeModal]);

  /**
   * Handles bulk creation of offering entities.
   * Defers execution to allow the UI modal to close smoothly.
   * @param {File[]} files - Array of selected files to upload.
   */
  const handleCreateEntity = async (files: File[]) => {
    setCreateEntityOpen(false);

    setTimeout(async () => {
      let successCount = 0;
      let failCount = 0;

      for (const file of files) {
        try {
          const name = file.name.replace(/\.[^/.]+$/, '');
          const data: CreateEntityData = {
            type: 'offering',
            name: name,
            blueprintId: activeBlueprint?.id,
          };
          const entityId = await entityApi.createEntity(data);
          await entityApi.uploadFile(entityId, file);
          successCount++;
        } catch (err) {
          console.error('Failed to create offering:', err);
          failCount++;
        }
      }

      if (successCount > 0) {
        addToast('success', `Successfully created ${successCount} ${offeringLabelPlural.toLowerCase()}`);
      }
      if (failCount > 0) {
        addToast('error', `Failed to create ${failCount} ${offeringLabelPlural.toLowerCase()}`);
      }

      refetch();
    }, 300);
  };

  const handleEntityClick = (entity: Entity) => {
    router.push(`?entityId=${entity.id}`);
  };

  const handleEntityClose = () => {
    router.push('/offerings');
  };

  const handleRetryProcessing = async (entityId: number) => {
    try {
      await entityApi.retryProcessing(entityId);
      addToast('success', 'Task queued for retry');
      refetch();
    } catch (err) {
      console.error('Failed to retry:', err);
      addToast('error', 'Failed to retry task');
    }
  };

  /**
   * Wrapper for deleting an entity that handles UI toast notifications.
   */
  const handleDeleteEntity = async (id: number) => {
    try {
      await deleteEntity(id);
      addToast('success', 'Entity deleted successfully');
    } catch (err) {
      addToast('error', 'Failed to delete entity');
    }
  };

  const handleNotification = useCallback(
    (data: { type: 'error' | 'success' | 'info'; message: string }) => {
      addToast(data.type, data.message);
      if (data.type === 'success' || data.type === 'error') {
        refetch();
      }
    },
    [addToast, refetch]
  );

  useSSE({
    onNotification: handleNotification,
    onEntityUpdate: () => refetch(),
  });

return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto min-h-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <FilterBar
            searchTerm={search}
            onSearchChange={setSearch}
            searchPlaceholder={`Search ${offeringLabelPlural}...`}
            filterValue={status}
            onFilterChange={setStatus}
            filterOptions={[
              { value: 'all', label: 'All' },
              { value: ENTITY_STATUS.PENDING, label: 'Queued' },
              { value: ENTITY_STATUS.PROCESSING, label: 'Processing' },
              { value: ENTITY_STATUS.COMPLETED, label: 'Completed' },
              { value: ENTITY_STATUS.FAILED, label: 'Failed' }
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

        {loading && offerings.length === 0 ? (
          <div className="py-20 flex justify-center items-center flex-col gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
            <p className="text-accent-forest/70 font-medium">Loading...</p>
          </div>
        ) : offerings.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={`off-grid-${page}-${debouncedSearch}-${status}`}
              variants={masterContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {offerings.map((entity) => (
                <motion.div key={entity.id} variants={masterItem}>
                  <EntityCard
                    entity={entity}
                    entityLabel={offeringLabelSingular}
                    onClick={() => router.push(`?entityId=${entity.id}`)}
                    onRetry={() => handleRetryProcessing(entity.id)}
                    onDelete={() => handleDeleteEntity(entity.id)}
                    displayName={getNuancedEntityName(entity, blueprints)}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <EmptyState icon={UsersIcon} title={`No ${offeringLabelPlural} yet`} subtitle={`Create a ${offeringLabelSingular.toLowerCase()} to get started`} />
        )}
      </div>

      <CreateEntityModal
        open={createEntityOpen}
        onClose={() => setCreateEntityOpen(false)}
        onCreate={handleCreateEntity}
        entityType="offering"
      />

      <EntityDetailModal
        entity={selectedEntityData}
        open={!!selectedEntityData}
        onClose={handleEntityClose}
        onDelete={handleDeleteEntity}
      />
    </div>
  );
}

// Next.js Requirement: Wrap in Suspense to support useSearchParams during static prerendering.
export default function OfferingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
      </div>
    }>
      <OfferingsPageContent />
    </Suspense>
  );
}