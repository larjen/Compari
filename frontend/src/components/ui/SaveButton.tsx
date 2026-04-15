'use client';

import { Save, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';

interface SaveButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Toggles the loading spinner and disables the button */
  isSaving?: boolean;
  /** The text displayed on the button (defaults to "Save") */
  saveText?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function SaveButton({ 
  isSaving = false, 
  saveText = 'Save', 
  variant = 'primary', 
  size = 'md', 
  className, 
  disabled,
  ...props 
}: SaveButtonProps) {
  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className} 
      disabled={isSaving || disabled} 
      {...props}
    >
      {isSaving ? (
        <Loader2 className="w-4 h-4 mr-2 shrink-0 animate-spin" />
      ) : (
        <Save className="w-4 h-4 mr-2 shrink-0" />
      )}
      <span className="pr-1">{saveText}</span>
    </Button>
  );
}