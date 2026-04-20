'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { EntityCard } from '@/components/entities/EntityCard';
import { CreateEntityModal } from '@/components/entities/CreateEntityModal';
import { EntityDetailModal } from '@/components/entities/EntityDetailModal';
import { useEntities } from '@/hooks/useEntities';
import { useFilterState } from '@/hooks/useFilterState';
import { useToast } from '@/hooks/useToast';
import { useSSE } from '@/hooks/useSSE';
import { useModal } from '@/hooks/useModal';
import { useTerminology } from '@/hooks/useTerminology';
import { useDeepLinkedResource } from '@/hooks/useDeepLinkedResource';
import { useEntityOperations } from '@/hooks/useEntityOperations';
import { entityApi } from '@/lib/api/entityApi';
import { EntityType, ToastType } from '@/lib/types';
import { ENTITY_ROLES, TOAST_TYPES, MODAL_TYPES, UI_CONFIG, STATUS_FILTER_OPTIONS } from '@/lib/constants';
import { EmptyState, ContentLoader } from '@/components/shared/PageStates';
import { Pagination } from '@/components/shared/Pagination';
import { FilterBar } from '@/components/shared/FilterBar';
import { AnimatedDataGrid } from '@/components/shared/AnimatedDataGrid';
import { AnimatedPageHeader } from '@/components/shared/AnimatedPageHeader';

/**
 * @module EntityDashboard
 * @description Unified dashboard component for rendering entity grids (Requirements and Offerings).
 * @responsibility Consolidates duplicated dashboard logic from Requirements and Offerings pages into a single,
 * reusable component. Eliminates WET (Write Everything Twice) code by parameterizing entity role, terminology,
 * and routing behavior. All UI/presentation logic remains in this component while state management is delegated
 * to underlying hooks.
 * @boundary_rules
 * - ❌ MUST NOT directly mutate entity data; MUST use useEntityOperations for mutations.
 * - ❌ MUST NOT hardcode entity role strings; MUST use ENTITY_ROLES constants.
 * - ❌ MUST NOT use inline terminology; MUST use useTerminology hook for label resolution.
 * - ✅ MUST accept entityRole prop to determine dashboard behavior.
 * - ✅ MUST use useDeepLinkedResource for URL parameter entity selection.
 * - ✅ MUST delegate SSE updates via useSSE hook.
 */
interface EntityDashboardProps {
  /**
   * The entity role determining which type of entities to display.
   * Must be one of: 'requirement' or 'offering'
   */
  entityRole: EntityType;
}

/**
 * Unified Entity Dashboard Component
 * 
 * @param entityRole - The type of entities to display ('requirement' | 'offering')
 * @description Renders a dynamic entity grid with filtering, pagination, create/edit modals.
 *              All terminology, icons, and routing are resolved based on the entityRole prop.
 */
export function EntityDashboard({ entityRole }: EntityDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityIdParam = searchParams.get('entityId');

  const { addToast } = useToast();
  const { activeModal, closeModal } = useModal();

  const { search, setSearch, debouncedSearch, status, setStatus, page, setPage } = useFilterState('all');

  const {
    entities,
    loading,
    refetch,
    deleteEntity,
    totalPages,
  } = useEntities({
    type: entityRole,
    page,
    limit: UI_CONFIG.PAGINATION.ITEMS_PER_PAGE,
    search: debouncedSearch,
    status,
  });

  const { activeBlueprint, activeLabels } = useTerminology();
  
  const labels = activeLabels[entityRole];
  const singularLabel = labels.singular;
  const pluralLabel = labels.plural;

  const iconKey = entityRole === ENTITY_ROLES.REQUIREMENT ? 'REQUIREMENT' : 'OFFERING';

  const createModalType = entityRole === ENTITY_ROLES.REQUIREMENT 
    ? MODAL_TYPES.CREATE_REQUIREMENT 
    : MODAL_TYPES.CREATE_OFFERING;

  const basePath = entityRole === ENTITY_ROLES.REQUIREMENT ? '/' : '/offerings';

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const selectedEntity = useDeepLinkedResource(entityIdParam, entities, 'id', entityApi.getEntityById);

  useEffect(() => {
    if (activeModal === createModalType) {
      setCreateModalOpen(true);
      closeModal();
    }
  }, [activeModal, closeModal, createModalType]);

  const handleEntityUpdate = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleNotification = useCallback(
    (data: { type: ToastType; message: string }) => {
      addToast(data.type, data.message);
      if (data.type === TOAST_TYPES.SUCCESS || data.type === TOAST_TYPES.ERROR) {
        refetch();
      }
    },
    [addToast, refetch]
  );

  useSSE({
    onEntityUpdate: handleEntityUpdate,
    onNotification: handleNotification,
  });

  const { bulkCreateFromFiles, deleteWithToast, retryWithToast } = useEntityOperations({
    deleteEntityFn: deleteEntity,
  });

  const gridKeyPrefix = entityRole === ENTITY_ROLES.REQUIREMENT ? 'req-grid' : 'off-grid';

  return (
    <div className="flex-1 p-6">
      <div className="max-w-7xl mx-auto min-h-full">
        <AnimatedPageHeader loading={loading}>
          <FilterBar
            searchTerm={search}
            onSearchChange={setSearch}
            searchPlaceholder={`Search ${pluralLabel}...`}
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

        {loading && entities.length === 0 ? (
          <ContentLoader />
        ) : entities.length > 0 ? (
          <AnimatedDataGrid
            items={entities}
            loading={loading}
            page={page}
            search={debouncedSearch}
            status={status}
            gridKeyPrefix={gridKeyPrefix}
            renderItem={(entity) => (
              <EntityCard
                entity={entity}
                entityLabel={singularLabel}
                onClick={() => router.push(`?entityId=${entity.id}`)}
                onRetry={() => retryWithToast(entity.id, refetch)}
                onDelete={() => deleteWithToast(entity.id, refetch)}
              />
            )}
          />
        ) : (
          <EmptyState 
            icon={iconKey} 
            title={`No ${pluralLabel} yet`} 
            subtitle={`Create a ${singularLabel.toLowerCase()} to get started`} 
          />
        )}
      </div>

      <CreateEntityModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={(files) => bulkCreateFromFiles(files, entityRole, activeBlueprint?.id, pluralLabel, refetch)}
        entityType={entityRole}
      />

      <EntityDetailModal
        entity={selectedEntity}
        open={!!selectedEntity}
        onClose={() => router.push(basePath)}
        onDelete={(id) => deleteWithToast(id, refetch)}
      />
    </div>
  );
}