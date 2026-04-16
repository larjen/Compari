'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { EntityCard } from '@/components/entities/EntityCard';
import { EntityDetailModal } from '@/components/entities/EntityDetailModal';
import { CreateEntityModal } from '@/components/entities/CreateEntityModal';
import { useToast } from '@/hooks/useToast';
import { useEntities } from '@/hooks/useEntities';
import { useFilterState } from '@/hooks/useFilterState';
import { useSSE } from '@/hooks/useSSE';
import { useModal } from '@/hooks/useModal';
import { useBlueprints } from '@/hooks/useBlueprints';
import { entityApi } from '@/lib/api/entityApi';
import { Entity, ToastType } from '@/lib/types';
import { CreateEntityData } from '@/lib/api/entityApi';
import { getEntityDisplayNames } from '@/lib/utils';
import { ENTITY_STATUS, ENTITY_ROLES, TOAST_TYPES, MODAL_TYPES, UI_CONFIG } from '@/lib/constants';
import { Loader2, Scale } from 'lucide-react';
import { EmptyState, ContentLoader } from '@/components/shared/PageStates';
import { FilterBar } from '@/components/shared/FilterBar';
import { Pagination } from '@/components/shared/Pagination';
import { AnimatedDataGrid } from '@/components/shared/AnimatedDataGrid';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityIdParam = searchParams.get('entityId');
  
  const { addToast } = useToast();
  const { activeModal, closeModal } = useModal();
  
  const { search, setSearch, debouncedSearch, status, setStatus, page, setPage } = useFilterState('all');
  
  const {
    entities,
    loading,
    refetch: refetchEntities,
    deleteEntity,
    totalPages,
  } = useEntities({
    type: ENTITY_ROLES.REQUIREMENT,
    page,
    limit: UI_CONFIG.PAGINATION.ITEMS_PER_PAGE,
    search: debouncedSearch,
    status,
  });

  useEffect(() => {
    if (!loading) {
      setIsReady(true);
    }
  }, [loading]);
  
  const { blueprints } = useBlueprints();

  const activeBlueprint = blueprints.find(b => b.is_active) || blueprints[0];
  const requirementLabelSingular = activeBlueprint?.requirementLabelSingular || 'Requirement';
  const requirementLabelPlural = activeBlueprint?.requirementLabelPlural || 'Requirements';

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [deepLinkedEntity, setDeepLinkedEntity] = useState<Entity | null>(null);
  const [isFetchingDeepLink, setIsFetchingDeepLink] = useState(false);

  // Deep-link fallback: fetch entity directly if not in local array
  const entityId = entityIdParam ? parseInt(entityIdParam, 10) : null;
  const localEntity = entityId ? entities.find((e: any) => e.id === entityId) : null;

  useEffect(() => {
    if (entityId && !localEntity && !deepLinkedEntity && !isFetchingDeepLink) {
      const fetchDeepLink = async () => {
        setIsFetchingDeepLink(true);
        try {
          const response = await fetch(`/api/entities/${entityId}`);
          if (response.ok) {
            const data = await response.json();
            setDeepLinkedEntity(data);
          }
        } catch (error) {
          console.error("Failed to fetch deep-linked entity:", error);
        } finally {
          setIsFetchingDeepLink(false);
        }
      };
      fetchDeepLink();
    }
  }, [entityId, localEntity, deepLinkedEntity, isFetchingDeepLink]);

  useEffect(() => {
    if (!entityId && deepLinkedEntity) {
      setDeepLinkedEntity(null);
    }
  }, [entityId, deepLinkedEntity]);

  const selectedEntity = localEntity || deepLinkedEntity;

  useEffect(() => {
    if (activeModal === MODAL_TYPES.CREATE_REQUIREMENT) {
      setCreateModalOpen(true);
      closeModal();
    }
  }, [activeModal, closeModal]);

  const handleEntityUpdate = useCallback(() => {
    refetchEntities();
  }, [refetchEntities]);

  const handleNotification = useCallback(
    (data: { type: ToastType; message: string }) => {
      addToast(data.type, data.message);
      if (data.type === TOAST_TYPES.SUCCESS || data.type === TOAST_TYPES.ERROR) {
        refetchEntities();
      }
    },
    [addToast, refetchEntities]
  );

  useSSE({
    onEntityUpdate: handleEntityUpdate,
    onNotification: handleNotification,
  });

  /**
   * Handles bulk creation of entities from uploaded files.
   * Creates a separate entity for each file uploaded, processing them sequentially
   * to avoid overwhelming the backend or database connections.
   *
   * The heavy upload loop is deferred via setTimeout to allow the modal's exit animation
   * to complete smoothly before computationally expensive operations begin.
   *
   * @param files - Array of files to upload and create entities from
   * @returns Promise<void>
   */
  const handleCreateEntity = async (files: File[]) => {
    let successCount = 0;
    let failCount = 0;
    const labelPlural = requirementLabelPlural.toLowerCase();

    setTimeout(async () => {
      try {
        for (const file of files) {
          try {
            const name = file.name.replace(/\.[^/.]+$/, '');
            const data: CreateEntityData = {
              type: 'requirement',
              name,
              blueprintId: activeBlueprint?.id,
            };
            const entityId = await entityApi.createEntity(data);
            await entityApi.uploadFile(entityId, file);
            successCount++;
          } catch (fileErr) {
            console.error(`Failed to create entity from file ${file.name}:`, fileErr);
            failCount++;
          }
        }

        if (successCount > 0) {
          addToast(TOAST_TYPES.SUCCESS, `Successfully created ${successCount} ${labelPlural}`);
        }
        if (failCount > 0) {
          addToast(TOAST_TYPES.ERROR, `Failed to create ${failCount} ${labelPlural}`);
        }

        if (successCount > 0) {
          setTimeout(() => refetchEntities(), 1000);
        }
      } catch (err: any) {
        addToast(TOAST_TYPES.ERROR, err.message || 'Failed to create entities');
        throw err;
      }
    }, 300);
  };

  const handleDeleteEntity = async (id: number) => {
    try {
      await deleteEntity(id);
      addToast(TOAST_TYPES.SUCCESS, 'Entity deleted');
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to delete entity');
    }
  };

  const handleRetryProcessing = async (entityId: number) => {
    try {
      await entityApi.retryProcessing(entityId);
      addToast(TOAST_TYPES.SUCCESS, 'Task queued for retry');
      refetchEntities();
    } catch (err) {
      console.error('Failed to retry:', err);
      addToast(TOAST_TYPES.ERROR, 'Failed to retry task');
    }
  };

return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto min-h-full">
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 transition-opacity duration-500 ease-in-out ${isReady ? 'opacity-100' : 'opacity-0'}`}>
          <FilterBar
            searchTerm={search}
            onSearchChange={setSearch}
            searchPlaceholder={`Search ${requirementLabelPlural}...`}
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

        {loading && entities.length === 0 ? (
          <ContentLoader />
        ) : entities.length > 0 ? (
          <AnimatedDataGrid
            items={entities}
            loading={loading}
            page={page}
            search={debouncedSearch}
            status={status}
            gridKeyPrefix="req-grid"
            renderItem={(entity) => (
              <EntityCard
                entity={entity}
                entityLabel={requirementLabelSingular}
                onClick={() => router.push(`?entityId=${entity.id}`)}
                onRetry={() => handleRetryProcessing(entity.id)}
                onDelete={() => handleDeleteEntity(entity.id)}
              />
            )}
          />
        ) : (
          <EmptyState icon={Scale} title={`No ${requirementLabelPlural} yet`} subtitle={`Create a ${requirementLabelSingular.toLowerCase()} to get started`} />
        )}
      </div>

      <CreateEntityModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateEntity}
        entityType="requirement"
      />

      <EntityDetailModal
        entity={selectedEntity}
        open={!!selectedEntity}
        onClose={() => router.push('/')}
        onDelete={handleDeleteEntity}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<ContentLoader delay={200} />}>
      <DashboardContent />
    </Suspense>
  );
}