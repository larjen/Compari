'use client';

import { motion } from 'framer-motion';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Entity } from '@/lib/types';
import { ENTITY_STATUS, ENTITY_ROLES } from '@/lib/constants';
import { formatPercentage, getEntityDisplayNames } from '@/lib/utils';
import { useTerminology } from '@/hooks/useTerminology';
import { Button, ViewButton, CreateButton } from '@/components/ui';
import { useState, useEffect } from 'react';

/**
 * State-aware inline action button for match reports.
 * Handles creation, loading, and routing based on the match's queue status.
 */
function CreateReportAction({ 
  onCreate, 
  existingMatchId, 
  existingMatchStatus,
  onView 
}: { 
  onCreate: () => Promise<void>, 
  existingMatchId: number | null,
  existingMatchStatus: string | null,
  onView: (matchId: number) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localStatus, setLocalStatus] = useState(existingMatchStatus);

  // Sync local status if backend data updates via polling
  useEffect(() => {
    setLocalStatus(existingMatchStatus);
  }, [existingMatchStatus]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onCreate();
      setLocalStatus('pending');
    } finally {
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  if (localStatus === ENTITY_STATUS.PENDING || localStatus === ENTITY_STATUS.PROCESSING) {
    return (
      <Button size="sm" variant="ghost" disabled className="text-accent-forest/50 bg-accent-sand/10">
        <DOMAIN_ICONS.LOADING className="w-4 h-4 mr-2 animate-spin" /> Match report pending
      </Button>
    );
  }

  if (localStatus === ENTITY_STATUS.COMPLETED && existingMatchId) {
    return (
      <ViewButton entityName="Match Report" size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onView(existingMatchId); }} />
    );
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <CreateButton 
          entityName="Match Report" 
          size="sm" 
          onClick={handleConfirm} 
          isCreating={isProcessing} 
        />
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }} disabled={isProcessing}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <CreateButton 
      entityName="Match Report" 
      size="sm" 
      onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }} 
    />
  );
}

interface TopMatchesTabProps {
  entity: Entity;
  topMatches: any[];
  loading: boolean;
  processedCount: number;
  totalCount: number;
  isComplete: boolean;
  onCloseModal: () => void;
  /**
   * Callback function triggered when the user requests to create a new match report
   * between the current entity and a matched entity. Receives the matched entity ID
   * to create the report for. Must return a Promise to handle the async creation.
   */
  onCreateMatchReport: (matchedEntityId: number) => Promise<void>;
  /**
   * Callback to navigate to view a completed match report.
   */
  onViewMatchReport: (matchId: number) => void;
  /**
   * Callback to navigate to view the opposing matched entity.
   */
  onViewEntity: (entityId: number, entityType: string) => void;
}

export function TopMatchesTab({
  entity,
  topMatches,
  loading,
  processedCount,
  totalCount,
  isComplete,
  onCloseModal,
  onCreateMatchReport,
  onViewMatchReport,
  onViewEntity
}: TopMatchesTabProps) {
  const { getEntityLabels } = useTerminology();

  const progressPercentage = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

  if (processedCount === 0 && loading) {
    return (
      <div className="flex items-center justify-center h-40 text-accent-forest/60">
        <DOMAIN_ICONS.LOADING className="w-6 h-6 animate-spin mr-2" />
        Initializing match evaluation...
      </div>
    );
  }

  if (topMatches.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-accent-forest/40">
        <DOMAIN_ICONS.MATCH className="w-10 h-10 mb-2 opacity-50" />
        <p>No valid matches found. Ensure both entities have extracted criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!isComplete && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-center justify-between text-sm text-blue-700 mb-2">
            <span>Processed {processedCount} of {totalCount} entities...</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}
      {isComplete && topMatches.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-sm text-green-700">
            All entities evaluated. Showing top {topMatches.length} matches.
          </p>
        </div>
      )}
{topMatches.map((item, idx) => {
        const { primary: primaryName, secondary: secondaryName } = getEntityDisplayNames(item.entity);
        const entityLabel = getEntityLabels(item.entity).singular;

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={item.entity.id}
            className="flex items-center p-4 bg-white border border-border-light rounded-xl"
          >
            <div className="flex items-center justify-center w-16 mr-4 shrink-0">
              <span className="font-bold text-accent-forest text-lg leading-none">{formatPercentage(item.score)}</span>
            </div>
            
            <div className="flex-1 min-w-0 text-accent-forest">
              <h3 className="font-semibold text-base line-clamp-1">
                {primaryName}
              </h3>
              {secondaryName && (
                <p className="text-sm font-medium opacity-75 line-clamp-1 mt-0.5">
                  {secondaryName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 ml-4">
              <ViewButton
                entityName={entityLabel}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewEntity(item.entity.id, item.entity.type);
                }}
              />
              <CreateReportAction 
                onCreate={() => onCreateMatchReport(item.entity.id)} 
                existingMatchId={item.existingMatchId}
                existingMatchStatus={item.existingMatchStatus}
                onView={onViewMatchReport}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}