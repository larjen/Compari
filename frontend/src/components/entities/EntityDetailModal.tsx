'use client';

/**
 * @module EntityDetailModal
 * @description Generic modal for displaying unified entity details.
 * @responsibility
 * - Displays entity information with tabs: General Info, Criteria, Files.
 * - Renders metadata dynamically based on the entity's blueprint fields.
 * - Supports inline editing of metadata keys.
 * - Uses EntityDetailLayout for consistent modal structure.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic (delegated to hooks).
 * - ❌ MUST NOT fetch data directly (delegated to entityApi via hooks).
 * @requires_props
 * - title: Computed from entity using getEntityDisplayNames; falls back to 'Unnamed Entity' if unavailable.
 * - footer: DeleteAction rendered via footerActions prop; show only when entity exists.
 * @validation Renders fallback UI with console warning if entity data is missing.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DeleteAction, EditButton } from '@/components/ui';
import { Entity, Blueprint } from '@/lib/types';
import { entityApi } from '@/lib/api/entityApi';
import { getEntityDisplayNames } from '@/lib/utils';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { motion, AnimatePresence } from 'framer-motion';
import { CriteriaViewer } from '@/components/shared/CriteriaViewer';
import { EntityDetailLayout } from '@/components/shared/EntityDetailLayout';
import { FilesTabContent } from '@/components/shared/FilesTabContent';
import { EntityInfoTab } from './EntityInfoTab';
import { useToast } from '@/hooks/useToast';
import { useEntityFiles, useEntityCriteria, useTopMatches } from '@/hooks/useEntityData';
import { useMatches } from '@/hooks/useMatches';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useTerminology } from '@/hooks/useTerminology';
import { useUrlTabs } from '@/hooks/useUrlTabs';
import { TopMatchesTab } from './TopMatchesTab';
import { TOAST_TYPES, ENTITY_ROLES } from '@/lib/constants';

interface EntityDetailModalProps {
  /** The entity to display */
  entity: Entity | null;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Callback to delete the entity */
  onDelete: (id: number) => Promise<void>;
  /** Callback to edit the entity */
  onEdit?: () => void;
}

const ENTITY_TABS = {
  INFO: 'info',
  CRITERIA: 'criteria',
  FILES: 'files',
  TOP_MATCHES: 'top-matches'
} as const;
type TabId = typeof ENTITY_TABS[keyof typeof ENTITY_TABS];

const tabs = [
  { id: ENTITY_TABS.INFO, label: 'General Info', icon: DOMAIN_ICONS.INFO },
  { id: ENTITY_TABS.TOP_MATCHES, label: 'Top Matches', icon: DOMAIN_ICONS.MATCH },
  { id: ENTITY_TABS.CRITERIA, label: 'Criteria', icon: DOMAIN_ICONS.CRITERIA },
  { id: ENTITY_TABS.FILES, label: 'Files', icon: DOMAIN_ICONS.FILES },
];

export function EntityDetailModal({ entity, open, onClose, onDelete, onEdit }: EntityDetailModalProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const { blueprints } = useBlueprints();
  const { getEntityLabels } = useTerminology();
  const { activeTab, handleTabChange } = useUrlTabs(ENTITY_TABS.INFO);
  const [currentEntity, setCurrentEntity] = useState<Entity | null>(entity);

  // Find the matching blueprint
  /**
   * Infrastructure: Metadata is stored as JSON/unknown; explicit casting is required for frontend type safety.
   */
  const metadata = entity?.metadata as Record<string, any> | undefined;
  const entityBlueprintId = entity?.blueprint_id || metadata?.blueprint_id;
  const matchedBlueprint = blueprints.find(b => b.id === entityBlueprintId);

  const { files, loading: loadingFiles } = useEntityFiles(entity?.id);
  const { criteria, loading: loadingCriteria } = useEntityCriteria(activeTab === ENTITY_TABS.CRITERIA && entity?.id ? entity.id : undefined);
  const { topMatches, loading: loadingMatches, processedCount, totalCount, isComplete } = useTopMatches(entity?.id, activeTab === ENTITY_TABS.TOP_MATCHES);
  const { matches, deleteMatch, addMatch } = useMatches({ immediate: open });

  useEffect(() => {
    setCurrentEntity(entity);
  }, [entity]);

const handleSaveMetadata = async (key: string, value: string) => {
    if (!currentEntity?.id) return;
    const updatedMetadata = {
      ...(currentEntity.metadata || {}),
      [key]: value,
    };
    await entityApi.updateEntity(currentEntity.id, { metadata: updatedMetadata });
    setCurrentEntity({ ...currentEntity, metadata: updatedMetadata });
    addToast(TOAST_TYPES.SUCCESS, `${key} updated`);
  };

  /**
   * Finds and deletes an existing match between the current entity and a suggested matched entity.
   * @param {number} matchedEntityId - The ID of the entity to match against.
   * @returns {Promise<void>}
   */
  const handleDeleteMatch = async (matchedEntityId: number) => {
    if (!entity?.id) return;
    const requirementId = entity.type === ENTITY_ROLES.REQUIREMENT ? entity.id : matchedEntityId;
    const offeringId = entity.type === ENTITY_ROLES.OFFERING ? entity.id : matchedEntityId;
    const existingMatch = matches.find(
      (m) => m.requirement_id === requirementId && m.offering_id === offeringId
    );
    if (existingMatch) {
      await deleteMatch(existingMatch.id);
      addToast(TOAST_TYPES.SUCCESS, 'Match deleted successfully');
    }
  };

  /**
   * Queues a new match report assessment between the current entity and a matched entity.
   * @param {number} matchedEntityId - The ID of the target entity to match against.
   * @returns {Promise<void>}
   */
  const handleCreateMatchReport = async (matchedEntityId: number) => {
    if (!entity?.id) return;
    const requirementId = entity.type === ENTITY_ROLES.REQUIREMENT ? entity.id : matchedEntityId;
    const offeringId = entity.type === ENTITY_ROLES.OFFERING ? entity.id : matchedEntityId;
    try {
      await addMatch(requirementId, offeringId);
      addToast(TOAST_TYPES.SUCCESS, 'Match report queued for processing');
    } catch (error) {
      addToast(TOAST_TYPES.ERROR, 'Failed to queue match report');
    }
  };

  /**
   * Navigates the user to the Matches dashboard to view a specific match report.
   * @param {number} matchId - The ID of the completed match.
   */
  const handleViewMatchReport = (matchId: number) => {
    router.push(`/matches?matchId=${matchId}&tab=report`);
  };

  /**
   * Navigates the user to view an opposing entity.
   */
  const handleViewEntity = (matchedEntityId: number, matchedEntityType: string) => {
    const basePath = matchedEntityType === ENTITY_ROLES.REQUIREMENT ? '/' : '/offerings';
    router.push(`${basePath}?entityId=${matchedEntityId}`);
  };

  if (!entity) return null;

  // 1. Resolve names using the centralized utility
  const { primary: primaryName, secondary: secondaryName } = getEntityDisplayNames(entity);

  const typeLabel = getEntityLabels(entity).singular;

  const customTitle = (
    <div className="flex flex-col gap-1.5 pt-1 w-full overflow-hidden">
      <div className="flex items-start gap-2">
        {/* Use the resolved typeLabel to fix the undefined reference error */}
        <span className="text-xs uppercase tracking-wider font-bold text-accent-forest/50 w-24 shrink-0 mt-1.5">
          {typeLabel}
        </span>
        <span className="text-xl font-serif font-semibold text-accent-forest truncate whitespace-nowrap">
          {primaryName}
        </span>
      </div>
      {secondaryName && (
        <div className="flex items-start gap-2">
          <span className="text-xs uppercase tracking-wider font-bold text-accent-forest/50 w-24 shrink-0 mt-1">
            Details
          </span>
          <span className="text-lg font-medium text-accent-forest/80 truncate whitespace-nowrap">
            {secondaryName}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <EntityDetailLayout
      title={customTitle}
      subtitle={undefined}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      layoutIdPrefix="entityDetail"
      open={open}
      onClose={onClose}
      footerActions={
        <div className="flex items-center gap-3">
          {onEdit && <EditButton entityName={entity.type} onClick={onEdit} />}
          <DeleteAction onDelete={async () => { await onDelete(entity.id); onClose(); }} />
        </div>
      }
    >
      <AnimatePresence mode="wait">
        {activeTab === ENTITY_TABS.INFO && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/**
              * @socexplanation
              * We pass 'currentEntity' instead of the static 'entity' prop to ensure 
              * optimistic UI updates (like metadata edits) are immediately reflected in the tab.
              * This isolates the local state management from the parent's generic data fetching.
              */}
            <EntityInfoTab
              entity={currentEntity || entity}
              blueprint={matchedBlueprint}
              onSaveMetadata={handleSaveMetadata}
            />
          </motion.div>
        )}

        {activeTab === ENTITY_TABS.CRITERIA && (
          <motion.div
            key="criteria"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <CriteriaViewer
              criteria={criteria}
              isLoading={loadingCriteria}
              emptyMessage="No criteria extracted yet. Run an AI extraction to populate this list."
            />
          </motion.div>
        )}

        {activeTab === ENTITY_TABS.FILES && (
          <FilesTabContent
            folderPath={entity?.folder_path ?? (entity as any)?.folderPath ?? null}
            files={files}
            loadingFiles={loadingFiles}
            getDownloadUrl={(filename) => `/api/entities/${entity.id}/files/${encodeURIComponent(filename)}`}
            onOpenFolder={async () => {
              try {
                await entityApi.openFolder(entity.id);
              } catch (error) {
                console.error('Failed to open folder:', error);
                addToast(TOAST_TYPES.ERROR, 'Failed to open folder on the server.');
              }
            }}
          />
        )}

        {activeTab === ENTITY_TABS.TOP_MATCHES && (
          <motion.div
            key="top-matches"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <TopMatchesTab 
              entity={currentEntity || entity} 
              topMatches={topMatches} 
              loading={loadingMatches}
              processedCount={processedCount}
              totalCount={totalCount}
              isComplete={isComplete}
              onCloseModal={onClose} 
              onCreateMatchReport={handleCreateMatchReport}
              onViewMatchReport={handleViewMatchReport}
              onViewEntity={handleViewEntity}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </EntityDetailLayout>
  );
}