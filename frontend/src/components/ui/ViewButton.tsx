'use client';

import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Button } from './Button';
import { ButtonHTMLAttributes } from 'react';
import { ButtonVariant, ButtonSize } from '@/lib/types';

interface ViewButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The name of the entity being viewed (e.g., "Report", "Document"). Defaults to "Details". */
  entityName?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * @component ViewButton
 * @description Universal call-to-action button for viewing entities, reports, or files.
 * @responsibility Enforces visual consistency by always providing the Eye icon and handling string formatting.
 */
export function ViewButton({ 
  entityName = 'Details', 
  variant = 'secondary', 
  size = 'md', 
  className, 
  ...props 
}: ViewButtonProps) {
  const formattedEntity = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  
  return (
    <Button variant={variant} size={size} className={className} {...props}>
      <DOMAIN_ICONS.VIEW className="w-4 h-4 mr-2 shrink-0" />
      <span className="pr-1 truncate">View {formattedEntity}</span>
    </Button>
  );
}