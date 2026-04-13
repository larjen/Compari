'use client';

import { motion } from 'framer-motion';
import { Loader2, Trophy, FileText, CheckCircle, Eye } from 'lucide-react';
import { Entity } from '@/lib/types';
import { getNuancedEntityName, formatPercentage } from '@/lib/utils';
import { useBlueprints } from '@/hooks/useBlueprints';
import { Button } from '@/components/ui/Button';
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

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      await onCreate();
      // Optimistic UI update: immediately show pending state without waiting for next poll
      setLocalStatus('pending');
    } finally {
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  if (localStatus === 'pending' || localStatus === 'processing') {
    return (
      <Button size="sm" variant="ghost" disabled className="text-accent-forest/50 bg-accent-sand/10">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Match report pending
      </Button>
    );
  }

  if (localStatus === 'completed' && existingMatchId) {
    return (
      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onView(existingMatchId); }}>
        <Eye className="w-4 h-4 mr-2" /> View Matchreport
      </Button>
    );
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={handleConfirm} disabled={isProcessing}>
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
        </Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }} disabled={isProcessing}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}>
      <FileText className="w-4 h-4 mr-2" /> Create Matchreport
    </Button>
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
  onViewMatchReport
}: TopMatchesTabProps) {
  const { blueprints } = useBlueprints();

  const progressPercentage = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

  if (processedCount === 0 && loading) {
    return (
      <div className="flex items-center justify-center h-40 text-accent-forest/60">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Initializing match evaluation...
      </div>
    );
  }

  if (topMatches.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-accent-forest/40">
        <Trophy className="w-10 h-10 mb-2 opacity-50" />
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
        // Extract and split the nuanced metadata name
        const displayString = getNuancedEntityName(item.entity, blueprints) || item.entity.name || '';
        const nameParts = displayString.split(' - ');
        const primaryName = nameParts[0];
        const secondaryName = nameParts.length > 1 ? nameParts.slice(1).join(' - ') : null;

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={item.entity.id}
            className="flex items-center p-4 bg-white border border-border-light rounded-xl hover:border-accent-sage hover:shadow-sm transition-all group"
          >
            <div className="flex flex-col items-center justify-center w-16 h-16 bg-accent-sage/10 rounded-xl border border-accent-sage/20 mr-4 shrink-0">
              <span className="text-[10px] text-accent-forest/60 uppercase font-bold tracking-wider mb-0.5">Match</span>
              <span className="font-bold text-accent-forest text-lg leading-none">{formatPercentage(item.score)}</span>
            </div>
            
            <div className="flex-1 min-w-0 transition-colors group-hover:text-accent-forest-light text-accent-forest">
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