'use client';

import { Pencil } from 'lucide-react';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';

interface EditButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The name of the entity being edited (e.g., "Model", "Blueprint") */
  entityName: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

/**
 * @component EditButton
 * @description Universal call-to-action button for editing existing instances.
 * @responsibility Enforces visual and linguistic consistency (always uses the Pencil icon and "Edit [Entity]" format) across the application.
 */
export function EditButton({ entityName, variant = 'secondary', size = 'sm', className, ...props }: EditButtonProps) {
  const formattedEntity = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  
  return (
    <Button variant={variant} size={size} className={className} {...props}>
      <Pencil className="w-4 h-4 mr-2 shrink-0" />
      <span className="pr-1">Edit {formattedEntity}</span>
    </Button>
  );
}