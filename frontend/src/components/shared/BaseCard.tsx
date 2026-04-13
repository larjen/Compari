'use client';

/**
 * @module BaseCard
 * @description Reusable structural shell component for task-based cards.
 * @responsibility
 * - Handles layout, positioning, and visual shell (border, shadows, hover states).
 * - Manages status indicator rendering and action buttons (Cancel, Retry, Delete).
 * - Enforces Separation of Concerns: layout and state representation only.
 * @boundary_rules
 * - ❌ MUST NOT contain domain-specific data mapping (delegated to consuming components).
 * - ❌ MUST NOT contain API logic.
 * - ❌ MUST NOT handle business rules (status calculations done by parent).
 */

import { RefreshCw } from 'lucide-react';
import { Button, DeleteAction } from '@/components/ui';
import { StatusIndicator } from './StatusIndicator';
import { cn } from '@/lib/utils';

/**
 * Props for the BaseCard component.
 * @interface BaseCardProps
 */
interface BaseCardProps {
  /** Unique identifier displayed in the left sidebar */
  id: number;
  /** Whether the task is pending in the queue */
  isPending: boolean;
  /** Whether the task is currently being processed */
  isProcessing: boolean;
  /** Whether the task has encountered an error */
  hasError: boolean;
  /** Whether the task has completed successfully */
  isCompleted: boolean;
  /** Name of the task/operation being performed (e.g., 'extraction', 'assessment') */
  taskName: string;
  /** Formatted elapsed time string (e.g., '2m 30s') - derived from useElapsedTime hook */
  elapsedTime: string | undefined;
  /** Error message to display when hasError is true */
  errorMessage: string | undefined;
  /** Current processing step name (optional, for detailed status) */
  processingStep?: string | undefined;
  /** Callback when the card is clicked */
  onClick: () => void;
  /** Callback for retrying a failed task */
  onRetry?: () => void;
  /** Callback for deleting a task. Must return a Promise for the DeleteAction loading state. */
  onDelete?: () => Promise<void>;
  /** Callback for canceling a processing task */
  onCancel?: (e: React.MouseEvent) => void;
  /** Child content to render between StatusIndicator and Actions Bar */
  children: React.ReactNode;
  /** Custom actions to render in the actions bar (beforeDelete) */
  customActions?: React.ReactNode;
}

/**
 * Reusable card shell component that handles:
 * - Outer container with hover/shadow styles and dynamic border colors
 * - Left-side ID sidebar
 * - StatusIndicator integration
 * - Actions bar (Cancel, Retry, Delete) docked to bottom
 * - Children rendered between StatusIndicator and Actions Bar
 *
 * @param props - BaseCardProps
 * @returns JSX.Element
 */
export function BaseCard({
  id,
  isPending,
  isProcessing,
  hasError,
  isCompleted,
  taskName,
  elapsedTime,
  errorMessage,
  processingStep,
  onClick,
  onRetry,
  onDelete,
  onCancel,
  children,
  customActions
}: BaseCardProps) {
  const isBusy = isPending || isProcessing;

  const handleClick = (e: React.MouseEvent) => {
    if (isBusy) return;
    onClick();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel?.(e);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group bg-white rounded-xl border border-border-light cursor-pointer relative',
        'hover:border-accent-sage/50 hover:shadow-lg hover:-translate-y-0.5',
        'transition-all duration-200 select-none flex h-[260px]',
        hasError && 'border-red-300 bg-red-50',
        isPending && 'bg-accent-sand/20',
        isProcessing && 'bg-accent-sand/20'
      )}
    >
      {/* Left-side ID sidebar */}
      <div className="flex-shrink-0 w-10 bg-accent-sage/10 flex items-center justify-center border-r border-border-light rounded-l-xl">
        <span className="text-sm font-bold text-accent-forest/70 rotate-180 [writing-mode:vertical-lr]">
          #{id}
        </span>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col p-4 min-w-0">
        {/**
         * Top Row - StatusIndicator section.
         * Fixed height of 24px (h-6) to ensure consistent positioning.
         */}
        <div className="h-6 flex-shrink-0 w-full">
          <StatusIndicator
            isPending={isPending}
            isProcessing={isProcessing}
            hasError={hasError}
            taskName={taskName}
            elapsedTime={elapsedTime}
            processingStep={processingStep}
            errorMessage={errorMessage}
          />
        </div>

        {/**
         * Middle Row - Primary content area.
         * Uses flex-1 to fill remaining space, centered content with overflow hidden.
         */}
        <div className="flex-1 flex flex-col items-center justify-center text-center min-h-0 overflow-hidden">
          {children}
        </div>

        {/**
         * Bottom Row - Action buttons section.
         * Fixed height of 32px (h-8) to always reserve space for actions.
         */}
        <div 
          className="h-8 mt-2 flex items-center justify-center gap-2 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isProcessing && onCancel && (
            <DeleteAction
              onDelete={async () => {
                handleCancel({ stopPropagation: () => { } } as React.MouseEvent);
              }}
              buttonText="Cancel processing"
            />
          )}

          {hasError && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              title="Retry processing"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          )}

          {customActions}

          {onDelete && (
            <DeleteAction 
              onDelete={onDelete} 
            />
          )}
        </div>
      </div>
    </div>
  );
}