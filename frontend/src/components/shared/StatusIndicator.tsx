'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { useTaskLifecycle } from '@/hooks/useTaskLifecycle';

export interface StatusIndicatorProps {
  /** Current status string from backend */
  status?: string | null;
  /** Name of the task/operation being performed (e.g., 'extraction', 'assessment') */
  taskName: string;
  /** Start time for elapsed time calculation */
  startTime?: string | null;
  /** Error message to display */
  errorMessage?: string;
  /** Current processing step name (optional, for detailed status) */
  processingStep?: string;
}

export function StatusIndicator({
  status,
  taskName,
  startTime,
  errorMessage,
  processingStep
}: StatusIndicatorProps) {
  const { isPending, isProcessing, hasError, elapsedTime } = useTaskLifecycle(
    status,
    startTime,
    errorMessage
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
    const timeSuffix = elapsedTime ? ` for ${elapsedTime}` : '';
    const stepTimeSuffix = elapsedTime ? ` (${elapsedTime})` : '';
    const displayText = processingStep 
      ? `${processingStep}${stepTimeSuffix}` 
      : `${taskName.charAt(0).toUpperCase() + taskName.slice(1)}${timeSuffix}`;
      
    return (
      <div className="flex items-center justify-center gap-2 w-full h-full">
        <Loader2 data-testid="loading-icon" className="shrink-0 w-4 h-4 animate-spin text-accent-sage" />
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
        <AlertCircle data-testid="error-icon" className="shrink-0 w-4 h-4 text-red-500" />
        <span className="text-xs text-red-600 truncate flex-1 min-w-0" title={errorText}>
          {errorText}
        </span>
      </div>
    );
  }

  return <div className="w-full h-full"></div>;
}