'use client';

import { Button } from './Button';
import { SaveButton } from './SaveButton';

interface FormActionsProps {
  onCancel: () => void;
  onSave: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  saveText?: string;
  cancelText?: string;
  className?: string;
}

export function FormActions({
  onCancel,
  onSave,
  isSaving = false,
  disabled = false,
  saveText = 'Save',
  cancelText = 'Cancel',
  className = '',
}: FormActionsProps) {
  return (
    <div className={`flex gap-2 justify-end pt-2 ${className}`}>
      <Button 
        variant="ghost" 
        onClick={onCancel} 
        disabled={isSaving}
      >
        {cancelText}
      </Button>
      <SaveButton 
        onClick={onSave}
        isSaving={isSaving}
        disabled={disabled}
        saveText={saveText}
      />
    </div>
  );
}