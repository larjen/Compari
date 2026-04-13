'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Loader2, Trash2 } from 'lucide-react';

interface DeleteActionProps {
  onDelete: () => Promise<void>;
  buttonText?: string;
  iconOnly?: boolean;
  className?: string;
}

/**
 * A stateful behavioral component for delete actions in modals.
 * Encapsulates all delete-related state and handling logic.
 *
 * This component uses the "stateful behavioral" pattern where:
 * - State (isDeleting, showConfirm) is encapsulated within this component
 * - Behavior (onDelete callback) is passed in as a prop
 * - Presentation is delegated to the ModalFooter wrapper
 *
 * This separation allows the DeleteAction to be reusable across different
 * modals while keeping the footer layout flexible for other actions.
 *
 * @param onDelete - Async function to execute when delete is confirmed
 * @param buttonText - Optional custom text for the button (default: 'Delete')
 * @param iconOnly - If true, renders only the icon without text padding (default: false)
 */
export function DeleteAction({ onDelete, buttonText = 'Delete', iconOnly = false, className }: DeleteActionProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  if (showConfirm) {
    return (
      <>
        <Button variant="danger" size="sm" onClick={handleConfirm} disabled={isDeleting} className={className}>
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              {buttonText === 'Delete' ? 'Confirm' : buttonText}
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
          Cancel
        </Button>
      </>
    );
  }

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowConfirm(true)}
        className={cn("text-red-500 hover:bg-red-50 p-1", className)}
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={() => setShowConfirm(true)}
      className={cn("text-red-600 hover:bg-red-50", className)}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      {buttonText}
    </Button>
  );
}