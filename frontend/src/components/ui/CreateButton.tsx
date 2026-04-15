'use client';

import { Plus } from 'lucide-react';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';

interface CreateButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The name of the entity being created (e.g., "Match", "Blueprint") */
  entityName: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

/**
 * @component CreateButton
 * @description Universal call-to-action button for creating new instances.
 * @responsibility Enforces visual and linguistic consistency (always uses the Plus icon and "Create [Entity]" format) across the entire application.
 */
export function CreateButton({ entityName, variant = 'primary', size = 'sm', className, ...props }: CreateButtonProps) {
  const formattedEntity = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  
  return (
    <Button variant={variant} size={size} className={className} {...props}>
      <Plus className="w-4 h-4 mr-2 shrink-0" />
      <span className="pr-1">Create {formattedEntity}</span>
    </Button>
  );
}
