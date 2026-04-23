'use client';

import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { useState, useEffect } from 'react';
import { Entity, Criterion } from '@/lib/types';
import { criteriaApi } from '@/lib/api/criteriaApi';
import { motion } from 'framer-motion';
import { getEntityDisplayNames } from '@/lib/utils';
import { useTerminology } from '@/hooks/useTerminology';
import { useCriteriaFiles } from '@/hooks/useEntityData';
import { useCriterionOperations } from '@/hooks/useCriterionOperations';
import { EntityDetailLayout } from '@/components/shared/EntityDetailLayout';
import { DeleteAction, EditButton, ViewButton } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { SharedDebugTab } from '@/components/shared/SharedDebugTab';
import { MergeTab } from '@/components/criteria/MergeTab';
import { FilesTabContent } from '@/components/shared/FilesTabContent';

const CRITERION_TABS = {
  ASSOCIATIONS: 'associations',
  MERGE: 'merge',
  HISTORY: 'history',
  FILES: 'files',
  DEBUG: 'debug'
} as const;

const baseTabs = [
  { id: CRITERION_TABS.ASSOCIATIONS, label: 'Associations', icon: DOMAIN_ICONS.TREE },
  { id: CRITERION_TABS.MERGE, label: 'Merge', icon: DOMAIN_ICONS.MERGE },
  { id: CRITERION_TABS.HISTORY, label: 'Merge History', icon: DOMAIN_ICONS.HISTORY },
  { id: CRITERION_TABS.FILES, label: 'Files', icon: DOMAIN_ICONS.FILES }
];

interface CriterionDetailModalProps {
  criterion: Criterion | null;
  open: boolean;
  onClose: () => void;
  onSourceClick?: (entity: Entity) => void;
  onTargetClick?: (entity: Entity) => void;
  onDelete: (id: number) => Promise<void>;
  onMerged?: () => void;
  onEdit?: () => void;
}

export function CriterionDetailModal({ 
  criterion, 
  open, 
  onClose,
  onSourceClick,
  onTargetClick,
  onDelete,
  onMerged,
  onEdit
}: CriterionDetailModalProps) {
  const { settings } = useSettings(open);
  const { activeLabels, getEntityLabels } = useTerminology();
  
  const { 
    deleteWithToast, 
    openFolderWithToast, 
    writeMasterFileWithToast, 
    fetchMasterFileWithToast 
  } = useCriterionOperations({ deleteCriterionFn: onDelete });

  const tabs = settings.debug_mode === 'true'
    ? [...baseTabs, { id: CRITERION_TABS.DEBUG, label: 'Debug', icon: DOMAIN_ICONS.SETTINGS }]
    : baseTabs;
  const { requirement: { plural: sourceLabel }, offering: { plural: targetLabel } } = activeLabels;

  const [sources, setSources] = useState<Entity[]>([]);
  const [targets, setTargets] = useState<Entity[]>([]);
  const [history, setHistory] = useState<{ id: number; merged_display_name: string; merged_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(CRITERION_TABS.ASSOCIATIONS);

  const { files, loading: loadingFiles } = useCriteriaFiles(activeTab === CRITERION_TABS.FILES ? criterion?.id : undefined);
  const folderPath = criterion?.folderPath || (criterion as any)?.folder_path || null;

  useEffect(() => {
    if (open && criterion?.id) {
      setActiveTab(CRITERION_TABS.ASSOCIATIONS); // Reset tab to default when opening a new criterion
      setLoading(true);
      criteriaApi.getCriterionAssociations(criterion.id)
        .then((data) => {
          setSources(data.sources || []);
          setTargets(data.targets || []);
        })
        .catch((err) => {
          console.error('Failed to load criterion associations:', err);
          setSources([]);
          setTargets([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, criterion?.id]);

  useEffect(() => {
    if (open && criterion?.id && activeTab === CRITERION_TABS.HISTORY) {
      setLoading(true);
      criteriaApi.getMergeHistory(criterion.id)
        .then((data) => {
          setHistory(data || []);
        })
        .catch((err) => {
          console.error('Failed to load merge history:', err);
          setHistory([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, criterion?.id, activeTab]);

  const renderEntityCard = (entity: Entity, index: number, onClick?: (entity: Entity) => void) => {
    const { primary: primaryName, secondary: secondaryName } = getEntityDisplayNames(entity);
    const entityLabel = getEntityLabels(entity).singular;

    return (
      <motion.div
        key={entity.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="flex items-center p-4 bg-white border border-border-light rounded-xl"
      >
        <div className="flex-1 min-w-0 text-accent-forest">
          <h3 className="font-semibold text-base line-clamp-1">{primaryName}</h3>
          {secondaryName && (
            <p className="text-sm font-medium opacity-75 line-clamp-1 mt-0.5">{secondaryName}</p>
          )}
        </div>
        <div className="flex items-center gap-4 ml-4 shrink-0">
          <ViewButton
            entityName={entityLabel}
            size="sm"
            onClick={() => onClick?.(entity)}
          />
        </div>
      </motion.div>
    );
  };

  return (
    <EntityDetailLayout
      title={criterion?.displayName || 'Criterion Details'}
      subtitle="Semantic Associations"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id)}
      layoutIdPrefix="criterionDetail"
      open={open}
      onClose={onClose}
      footerActions={
        criterion && (
          <div className="flex items-center gap-3">
            {onEdit && <EditButton entityName="Criterion" onClick={onEdit} />}
            <DeleteAction 
              onDelete={() => deleteWithToast(criterion.id, onClose)} 
            />
          </div>
        )
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <DOMAIN_ICONS.LOADING className="w-6 h-6 animate-spin text-accent-sage" />
        </div>
      ) : (
        <div className="h-full">
          {activeTab === CRITERION_TABS.ASSOCIATIONS && (
            <div className="flex flex-col gap-8">
              {sources.length === 0 && targets.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-accent-forest/40 italic">No associations found for this criterion.</p>
                </div>
              )}

              {sources.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-accent-forest/80 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <DOMAIN_ICONS.REQUIREMENT className="w-4 h-4" />
                    {sourceLabel}
                    <span className="font-normal text-accent-forest/50">({sources.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {sources.map((entity, idx) => renderEntityCard(entity, idx, onSourceClick))}
                  </div>
                </div>
              )}

              {targets.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-accent-forest/80 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <DOMAIN_ICONS.OFFERING className="w-4 h-4" />
                    {targetLabel}
                    <span className="font-normal text-accent-forest/50">({targets.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {targets.map((entity, idx) => renderEntityCard(entity, idx, onTargetClick))}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === CRITERION_TABS.MERGE && criterion && (
            <MergeTab 
              criterion={criterion} 
              onMerged={onMerged || (() => {})}
            />
          )}
          {activeTab === CRITERION_TABS.HISTORY && (
            <div className="space-y-4">
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-3 bg-white border border-border-light rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-medium text-accent-forest">{item.merged_display_name}</p>
                        <p className="text-xs text-accent-forest/50 mt-0.5">
                          Merged on {new Date(item.merged_at).toLocaleDateString()}
                        </p>
                      </div>
                      <DOMAIN_ICONS.HISTORY className="w-4 h-4 text-accent-forest/30" />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-accent-forest/40 italic">This criterion has not been merged with any others.</p>
              )}
            </div>
          )}
          {activeTab === CRITERION_TABS.FILES && criterion && (
            <FilesTabContent
              folderPath={folderPath}
              files={files}
              loadingFiles={loadingFiles}
              getDownloadUrl={(filename) => `/api/criteria/${criterion.id}/files/${encodeURIComponent(filename)}`}
              onOpenFolder={() => openFolderWithToast(criterion.id)}
            />
          )}
          {activeTab === CRITERION_TABS.DEBUG && settings.debug_mode === 'true' && (
            <motion.div
              key="debug"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <SharedDebugTab
                rawData={criterion}
                onGenerateMasterFile={() => criterion ? writeMasterFileWithToast(criterion.id, () => {}) : Promise.resolve()}
                onFetchMasterFile={async () => {
                  if (!criterion) throw new Error('No criterion');
                  return (fetchMasterFileWithToast(criterion.id) as any) as string;
                }}
              />
            </motion.div>
          )}
        </div>
      )}
    </EntityDetailLayout>
  );
}