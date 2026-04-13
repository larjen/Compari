'use client';

import { Loader2 } from 'lucide-react';
import { Button } from './Button';

interface FormActionsProps {
  onCancel: () => void;
  onSave: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  saveText?: string;
  cancelText?: string;
  className?: string;
  inverted?: boolean;
}

export function FormActions({
  onCancel,
  onSave,
  isSaving = false,
  disabled = false,
  saveText = 'Save',
  cancelText = 'Cancel',
  className = '',
  inverted = false,
}: FormActionsProps) {
  return (
    <div className={`flex gap-2 justify-end pt-2 ${className}`}>
      <Button 
        variant="ghost" 
        onClick={onCancel} 
        disabled={isSaving}
        className={inverted ? 'text-white/70 hover:text-white hover:bg-white/10' : undefined}
      >
        {cancelText}
      </Button>
      <Button 
        onClick={onSave} 
        disabled={isSaving || disabled}
        className={inverted ? 'bg-white text-accent-forest hover:bg-white/90' : undefined}
      >
        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {saveText}
      </Button>
    </div>
  );
}