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
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { EntityMatch } from '@/lib/types';
import { parseMatchEntities, formatPercentage, getEntityDisplayNames } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { DownloadButton } from '@/components/ui';
import { BaseCard } from '../shared/BaseCard';
import { matchApi } from '@/lib/api/matchApi';
import { TOAST_TYPES, ENTITY_STATUS } from '@/lib/constants';

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
  const { addToast } = useToast();

  const { reqEntity, offEntity } = parseMatchEntities(match);

  const { primary: reqPrimaryName } = getEntityDisplayNames(reqEntity);
  const { primary: offPrimaryName } = getEntityDisplayNames(offEntity);

  const isCompleted = match.status === ENTITY_STATUS.COMPLETED;

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await matchApi.downloadMatchReportPdf(match.id);
    } catch (error) {
      console.error(error);
      addToast(TOAST_TYPES.ERROR, error instanceof Error ? error.message : "There was an error downloading the PDF.");
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
          <DownloadButton
            itemName="PDF"
            variant="ghost"
            size="sm"
            onClick={handleDownloadPdf}
            className="text-accent-forest/70 hover:bg-accent-sand/20 hover:text-accent-forest"
          />
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
          <DOMAIN_ICONS.REQUIREMENT className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium text-accent-forest truncate whitespace-nowrap">{reqPrimaryName}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-sm text-accent-forest/60 w-full min-w-0">
          <DOMAIN_ICONS.OFFERING className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate whitespace-nowrap">{offPrimaryName}</span>
        </div>
      </div>
    </BaseCard>
  );
}