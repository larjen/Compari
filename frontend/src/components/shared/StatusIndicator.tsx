'use client';

import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { useTaskLifecycle } from '@/hooks/useTaskLifecycle';
import { ENTITY_STATUS_LABELS, type EntityStatus } from '@/lib/constants';

/**
 * @description Status indicator component that displays entity processing state.
 * SoC Policy: This component delegates label formatting to the centralized registry
 * in `constants.ts` (Config Registry Pattern) rather than hardcoding display labels.
 */

interface StatusIndicatorProps {
  /** Current status string from backend */
  status?: string | null;
  /** Name of the task/operation being performed (e.g., 'extraction', 'assessment') */
  taskName: string;
  /** Start time for elapsed time calculation */
  startTime?: string | null;
  /** Error message to display */
  errorMessage?: string;
  metadata?: any;
}

export function StatusIndicator({
  status,
  taskName,
  startTime,
  errorMessage,
  metadata
}: StatusIndicatorProps) {
  const { isPending, isProcessing, hasError, elapsedTime } = useTaskLifecycle(
    status,
    startTime,
    errorMessage,
    metadata
  );

  if (isPending) {
    const pendingText = `In queue for ${taskName}`;
    return (
      <div className="flex items-center justify-center gap-2 w-full h-full">
        <span className="text-xs text-accent-forest/50 truncate flex-1 min-w-0" title={pendingText}>
          {pendingText}
        </span>
      </div>
    );
  }

  if (isProcessing) {
    const label = status ? (ENTITY_STATUS_LABELS[status as EntityStatus] || status) : status;
    const timeSuffix = elapsedTime ? ` (${elapsedTime})` : '';
    const displayText = `${label}${timeSuffix}`;
      
    return (
      <div className="flex items-center justify-center gap-2 w-full h-full">
        <DOMAIN_ICONS.LOADING data-testid="loading-icon" className="shrink-0 w-4 h-4 animate-spin text-accent-sage" />
        <span className="text-xs text-accent-forest/50 truncate flex-1 min-w-0" title={displayText}>
          {displayText}
        </span>
      </div>
    );
  }

  if (hasError) {
    const errorText = errorMessage || `${taskName.charAt(0).toUpperCase() + taskName.slice(1)} failed`;
    return (
      <div className="flex items-center justify-center gap-2 w-full h-full">
        <DOMAIN_ICONS.ERROR data-testid="error-icon" className="shrink-0 w-4 h-4 text-red-500" />
        <span className="text-xs text-red-600 truncate flex-1 min-w-0" title={errorText}>
          {errorText}
        </span>
      </div>
    );
  }

  return <div className="w-full h-full"></div>;
}