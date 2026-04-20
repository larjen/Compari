'use client';

import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';
import { ButtonSize } from '@/lib/types';

interface CreateButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The name of the entity being created (e.g., "Match", "Blueprint") */
  entityName: string;
  /** Toggles the loading spinner and disables the button */
  isCreating?: boolean;
  size?: ButtonSize;
}

/**
 * @component CreateButton
 * @description Universal call-to-action button for creating new instances.
 * @responsibility Enforces visual and linguistic consistency across the application. Strictly locked to the primary brand color.
 */
export function CreateButton({ 
  entityName, 
  isCreating = false, 
  size = 'md', 
  className, 
  disabled,
  ...props 
}: CreateButtonProps) {
  const formattedEntity = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  
  return (
    <Button 
      variant="primary" 
      size={size} 
      className={className} 
      disabled={isCreating || disabled}
      {...props}
    >
      {isCreating ? (
        <DOMAIN_ICONS.LOADING className="w-4 h-4 mr-2 shrink-0 animate-spin" />
      ) : (
        <DOMAIN_ICONS.ADD className="w-4 h-4 mr-2 shrink-0" />
      )}
      <span className="pr-1 truncate">
        {isCreating ? `Creating...` : `Create ${formattedEntity}`}
      </span>
    </Button>
  );
}
