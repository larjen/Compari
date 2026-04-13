'use client';

/**
 * @module EntityCard
 * @description Generic card component for displaying unified entities (requirements and offerings).
 * @responsibility
 * - Displays entity name, description, and queue status.
 * - Supports both 'requirement' and 'offering' entity types with dynamic styling.
 * - Handles click interactions for pending/processing tasks.
 * - Maps domain-specific data for the BaseCard shell.
 * @boundary_rules
 * - ❌ MUST NOT contain API logic (delegated to hooks).
 * - ❌ MUST NOT handle business rules beyond data mapping.
 * - Layout shell is delegated to BaseCard component.
 */
import { Building2, User } from 'lucide-react';
import { Entity } from '@/lib/types';
import { cn, formatPercentage } from '@/lib/utils';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import { BaseCard } from '../shared/BaseCard';
import { ENTITY_STATUS } from '@/lib/constants';

interface EntityCardProps {
  /** The entity to display */
  entity: Entity;
  /** Optional label to display instead of default Requirement/Offering */
  entityLabel?: string;
  /** Callback when card is clicked */
  onClick: () => void;
  /** When processing started (for elapsed time display) */
  processingStartedAt?: string | null | undefined;
  /** Callback for retrying a failed extraction task */
  onRetry?: () => void;
  /** Callback for deleting a failed entity. Must return a Promise for the DeleteAction loading state. */
  onDelete?: () => Promise<void>;
  /** Callback for canceling a processing task. */
  onCancel?: (e: React.MouseEvent) => void;
  /** Nuanced display name derived from blueprint metadata */
  displayName?: string;
}

export function EntityCard({
  entity,
  entityLabel,
  onClick,
  processingStartedAt,
  onRetry,
  onDelete,
  onCancel,
  displayName
}: EntityCardProps) {
  const currentStatus = entity.status;

  const isPending = currentStatus === ENTITY_STATUS.PENDING;
  const isProcessing = currentStatus === ENTITY_STATUS.PROCESSING;
  const hasError = currentStatus === ENTITY_STATUS.FAILED || currentStatus === 'error' || !!entity.error;
  const isCompleted = currentStatus === ENTITY_STATUS.COMPLETED;

  const startTime = processingStartedAt || (entity as any).updated_at;
  const elapsedTime = useElapsedTime(isProcessing ? startTime : undefined);

  const isRequirement = entity.type === 'requirement';

  const displayString = displayName || (entity.metadata?.nice_name as string | undefined) || entity.name || '';
  const nameParts = displayString.split(' - ');
  const primaryName = nameParts[0];
  const secondaryName = nameParts.length > 1 ? nameParts.slice(1).join(' - ') : null;

  return (
    <BaseCard
      id={entity.id}
      isPending={isPending}
      isProcessing={isProcessing}
      hasError={hasError}
      isCompleted={isCompleted}
      taskName={isRequirement ? "extraction" : "processing"}
      elapsedTime={elapsedTime}
      errorMessage={entity.error || undefined}
      processingStep={entity.metadata?.processingStep as string | undefined}
      onClick={onClick}
      onRetry={onRetry}
      onDelete={onDelete}
      onCancel={onCancel}
    >
      <div className={cn(
        "mb-2 flex flex-col items-center transition-colors group-hover:text-accent-forest-light",
        hasError ? "text-red-700" : "text-accent-forest"
      )}>
        <h3 className="font-semibold text-base line-clamp-1">
          {primaryName}
        </h3>
        {secondaryName && (
          <p className="text-sm font-medium opacity-75 line-clamp-1 mt-0.5">
            {secondaryName}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-sm text-accent-forest/60">
        {isRequirement ? (
          <>
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate">{entityLabel || 'Requirement'}</span>
          </>
        ) : (
          <>
            <User className="w-3.5 h-3.5" />
            <span className="truncate">{entityLabel || 'Offering'}</span>
          </>
        )}
      </div>

      {entity.description && (
        <p className="mt-2 text-xs text-accent-forest/50 line-clamp-2 text-center">
          {entity.description}
        </p>
      )}

      {typeof entity.metadata?.matchScore === 'number' && (
        <div className="mt-2 flex justify-center w-full">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-sand/30 text-accent-forest/80">
            {formatPercentage(entity.metadata.matchScore as number)} match
          </span>
        </div>
      )}
    </BaseCard>
  );
}