'use client';

import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';
import { ButtonVariant, ButtonSize } from '@/lib/types';

interface SaveButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Toggles the loading spinner and disables the button */
  isSaving?: boolean;
  /** The text displayed on the button (defaults to "Save") */
  saveText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
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
        <DOMAIN_ICONS.LOADING className="w-4 h-4 mr-2 shrink-0 animate-spin" />
      ) : (
        <DOMAIN_ICONS.SAVE className="w-4 h-4 mr-2 shrink-0" />
      )}
      <span className="pr-1 truncate">{saveText}</span>
    </Button>
  );
}