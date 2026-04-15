'use client';

/**
 * @module MatchCard
 * @description Card component for displaying entity match results.
 * @responsibility
 * - Displays matched requirement and offering names with match score.
 * - Shows queue status (pending, processing, completed, error).
 * - Handles click interactions.
 * - Maps domain-specific data for the BaseCard shell.
 * @boundary_rules
 * - ❌ MUST NOT contain API logic (delegated to hooks).
 * - ❌ MUST NOT handle business rules beyond data mapping.
 * - ❌ MUST NOT calculate lifecycle states - delegated to BaseCard via useTaskLifecycle.
 * - Layout shell is delegated to BaseCard component.
 */
import { User, Briefcase, Download } from 'lucide-react';
import { EntityMatch } from '@/lib/types';
import { getNuancedEntityName, parseMatchEntities, formatPercentage } from '@/lib/utils';
import { useBlueprints } from '@/hooks/useBlueprints';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { BaseCard } from '../shared/BaseCard';

interface MatchCardProps {
  match: EntityMatch;
  onClick: () => void;
  /**
   * Callback function triggered when the user requests to delete this match.
   * Must return a Promise to handle the async deletion process.
   */
  onDelete?: () => Promise<void>;
  /**
   * Callback function triggered when the user requests to retry a failed match.
   */
  onRetry?: () => void;
}

export function MatchCard({ match, onClick, onDelete, onRetry }: MatchCardProps) {
  const { blueprints } = useBlueprints();
  const { addToast } = useToast();

  const { reqEntity, offEntity } = parseMatchEntities(match);

  const reqDisplayName = getNuancedEntityName(reqEntity, blueprints);
  const offDisplayName = getNuancedEntityName(offEntity, blueprints);

  const reqPrimaryName = reqDisplayName.split(' - ')[0] || reqDisplayName;
  const offPrimaryName = offDisplayName.split(' - ')[0] || offDisplayName;

  const isCompleted = match.status === 'completed';

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/matches/${match.id}/pdf`);

      if (!response.ok) {
        let errorMessage = "Failed to generate PDF";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) { }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Compari_Match_Report_${match.id}.pdf`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const matches = /filename="([^"]+)"/.exec(contentDisposition);
        if (matches != null && matches) { 
          filename = matches[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      addToast('error', error instanceof Error ? error.message : "There was an error downloading the PDF.");
    }
  };

  return (
    <BaseCard
      id={match.id}
      status={match.status ?? null}
      startTime={match.status === 'processing' ? match.updated_at : match.created_at}
      taskName="assessment"
      errorMessage={match.error || undefined}
      onClick={onClick}
      onDelete={onDelete}
      onRetry={onRetry}
      customActions={
        isCompleted ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadPdf}
            className="text-accent-forest/70 hover:bg-accent-sand/20 hover:text-accent-forest"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        ) : null
      }
    >
      <div className="flex justify-center w-full">
        {isCompleted && match.match_score !== null && (
          <span className="text-lg font-bold text-accent-forest mb-1">
            {formatPercentage(match.match_score)} Match
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 w-full mt-1 mb-2">
        <div className="flex items-center justify-center gap-1.5 text-sm text-accent-forest/60 w-full min-w-0">
          <User className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium text-accent-forest truncate whitespace-nowrap">{reqPrimaryName}</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-sm text-accent-forest/60 w-full min-w-0">
          <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate whitespace-nowrap">{offPrimaryName}</span>
        </div>
      </div>
    </BaseCard>
  );
}