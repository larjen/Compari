'use client';

import { useState, useEffect } from 'react';
import { Entity, Criterion } from '@/lib/types';
import { criteriaApi } from '@/lib/api/criteriaApi';
import { Loader2, Building2, User, ListTree, ExternalLink, Merge, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { getNuancedEntityName } from '@/lib/utils';
import { useBlueprints } from '@/hooks/useBlueprints';
import { EntityDetailLayout } from '@/components/shared/EntityDetailLayout';
import { DeleteAction } from '@/components/ui';
import { MergeTab } from '@/components/criteria/MergeTab';

const tabs = [
  { id: 'associations', label: 'Associations', icon: ListTree },
  { id: 'merge', label: 'Merge', icon: Merge },
  { id: 'history', label: 'Merge History', icon: History }
];

interface CriterionDetailModalProps {
  criterion: Criterion | null;
  open: boolean;
  onClose: () => void;
  onSourceClick?: (entity: Entity) => void;
  onTargetClick?: (entity: Entity) => void;
  onDelete: (id: number) => Promise<void>;
  onMerged?: () => void;
}

export function CriterionDetailModal({ 
  criterion, 
  open, 
  onClose,
  onSourceClick,
  onTargetClick,
  onDelete,
  onMerged
}: CriterionDetailModalProps) {
  const { blueprints } = useBlueprints();
  const activeBlueprint = blueprints.find(b => b.is_active) || blueprints[0] || null;
  const sourceLabel = activeBlueprint?.requirementLabelPlural || 'Requirements';
  const targetLabel = activeBlueprint?.offeringLabelPlural || 'Offerings';

  const [sources, setSources] = useState<Entity[]>([]);
  const [targets, setTargets] = useState<Entity[]>([]);
  const [history, setHistory] = useState<{ id: number; merged_display_name: string; merged_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('associations');

  useEffect(() => {
    if (open && criterion?.id) {
      setActiveTab('associations'); // Reset tab to default when opening a new criterion
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
    if (open && criterion?.id && activeTab === 'history') {
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

  const renderEntityCard = (entity: Entity, onClick?: (entity: Entity) => void) => {
    const displayString = getNuancedEntityName(entity, blueprints) || entity.name || '';
    const [primary, ...rest] = displayString.split(' - ');
    const secondary = rest.join(' - ');

    return (
      <motion.div
        key={entity.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => onClick?.(entity)}
        className="flex items-center p-3 bg-white border border-border-light rounded-xl cursor-pointer hover:border-accent-sage hover:shadow-sm transition-all group"
      >
        <div className="flex-1 min-w-0 transition-colors group-hover:text-accent-forest-light text-accent-forest">
          <h4 className="font-semibold text-sm line-clamp-1">{primary}</h4>
          {secondary && (
            <p className="text-[11px] font-medium opacity-75 line-clamp-1 mt-0.5">{secondary}</p>
          )}
        </div>
        <ExternalLink className="w-3.5 h-3.5 ml-2 text-accent-forest/20 group-hover:text-accent-forest transition-colors" />
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
          <DeleteAction 
            onDelete={async () => { 
              await onDelete(criterion.id); 
              onClose(); 
            }} 
          />
        )
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-accent-sage" />
        </div>
      ) : (
        <div className="h-full">
          {activeTab === 'associations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-accent-forest/50 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Building2 className="w-3 h-3" />
                  {sourceLabel}
                  <span className="font-normal">({sources.length})</span>
                </h3>
                <div className="space-y-2">
                  {sources.length > 0 ? (
                    sources.map((entity) => renderEntityCard(entity, onSourceClick))
                  ) : (
                    <p className="text-xs text-accent-forest/40 italic">No associations found</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-accent-forest/50 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <User className="w-3 h-3" />
                  {targetLabel}
                  <span className="font-normal">({targets.length})</span>
                </h3>
                <div className="space-y-2">
                  {targets.length > 0 ? (
                    targets.map((entity) => renderEntityCard(entity, onTargetClick))
                  ) : (
                    <p className="text-xs text-accent-forest/40 italic">No associations found</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'merge' && criterion && (
            <MergeTab 
              criterion={criterion} 
              onMerged={onMerged || (() => {})}
            />
          )}
          {activeTab === 'history' && (
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
                      <History className="w-4 h-4 text-accent-forest/30" />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-accent-forest/40 italic">This criterion has not been merged with any others.</p>
              )}
            </div>
          )}
        </div>
      )}
    </EntityDetailLayout>
  );
}