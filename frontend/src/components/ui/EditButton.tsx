'use client';

import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';
import { ButtonVariant, ButtonSize } from '@/lib/types';

interface EditButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The name of the entity being edited (e.g., "Model", "Blueprint") */
  entityName: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * @component EditButton
 * @description Universal call-to-action button for editing existing instances.
 * @responsibility Enforces visual and linguistic consistency (always uses the Pencil icon and "Edit [Entity]" format) across the application.
 */
export function EditButton({ entityName, variant = 'secondary', size = 'md', className, ...props }: EditButtonProps) {
  const formattedEntity = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  
  return (
    <Button variant={variant} size={size} className={className} {...props}>
      <DOMAIN_ICONS.EDIT className="w-4 h-4 mr-2 shrink-0" />
      <span className="pr-1 truncate">Edit {formattedEntity}</span>
    </Button>
  );
}