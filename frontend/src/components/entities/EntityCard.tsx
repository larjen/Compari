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
 * - ❌ MUST NOT calculate lifecycle states - delegated to BaseCard via useTaskLifecycle.
 * - Layout shell is delegated to BaseCard component.
 */
import { Scale, Weight } from 'lucide-react';
import { Entity } from '@/lib/types';
import { cn, formatPercentage, getEntityDisplayNames } from '@/lib/utils';
import { useBlueprints } from '@/hooks/useBlueprints';
import { BaseCard } from '../shared/BaseCard';

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
}

export function EntityCard({
  entity,
  entityLabel,
  onClick,
  processingStartedAt,
  onRetry,
  onDelete,
  onCancel
}: EntityCardProps) {
  const { blueprints } = useBlueprints();
  const startTime = processingStartedAt || (entity.metadata?.processingStartedAt as string) || (entity as any).updated_at;
  const isRequirement = entity.type === 'requirement';

  const { primary: primaryName, secondary: secondaryName } = getEntityDisplayNames(entity, blueprints);

  return (
    <BaseCard
      id={entity.id}
      status={entity.status}
      startTime={startTime}
      taskName={isRequirement ? "extraction" : "processing"}
      errorMessage={entity.error || undefined}
      processingStep={entity.metadata?.processingStep as string | undefined}
      onClick={onClick}
      onRetry={onRetry}
      onDelete={onDelete}
      onCancel={onCancel}
    >
      <div className={cn(
        "mb-2 flex flex-col items-center transition-colors group-hover:text-accent-forest-light",
        (entity.status === 'failed' || entity.status === 'error' || entity.error) ? "text-red-700" : "text-accent-forest"
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
            <Scale className="w-3.5 h-3.5" />
            <span className="truncate">{entityLabel || 'Requirement'}</span>
          </>
        ) : (
          <>
            <Weight className="w-3.5 h-3.5" />
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