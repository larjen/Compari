'use client';

import { Loader2, AlertCircle } from 'lucide-react';

export interface StatusIndicatorProps {
  isPending?: boolean;
  isProcessing?: boolean;
  hasError?: boolean;
  taskName: string;
  elapsedTime?: string;
  errorMessage?: string;
  processingStep?: string;
}

export function StatusIndicator({
  isPending,
  isProcessing,
  hasError,
  taskName,
  elapsedTime,
  errorMessage,
  processingStep
}: StatusIndicatorProps) {
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