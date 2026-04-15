'use client';

import { Plus, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';

interface CreateButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The name of the entity being created (e.g., "Match", "Blueprint") */
  entityName: string;
  /** Toggles the loading spinner and disables the button */
  isCreating?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'icon';
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
        <Loader2 className="w-4 h-4 mr-2 shrink-0 animate-spin" />
      ) : (
        <Plus className="w-4 h-4 mr-2 shrink-0" />
      )}
      <span className="pr-1 truncate">
        {isCreating ? `Creating...` : `Create ${formattedEntity}`}
      </span>
    </Button>
  );
}
