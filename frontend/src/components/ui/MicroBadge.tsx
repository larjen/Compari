'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MicroBadgeVariant = 'sage' | 'sand';

/**
 * @description Compact status badge component for displaying small tags
 * @responsibility Provides consistent micro-badge styling for role and status indicators
 * @boundary_rules Purely presentational - accepts children and variant only
 * 
 * @param children - The text content to display inside the badge
 * @param variant - Color variant: 'sage' (green) or 'sand' (yellow)
 */
interface MicroBadgeProps {
  children: ReactNode;
  variant?: MicroBadgeVariant;
  className?: string;
}

const variantStyles: Record<MicroBadgeVariant, string> = {
  sage: 'bg-accent-sage/20 text-accent-forest',
  sand: 'bg-accent-sand/20 text-accent-forest',
};

export function MicroBadge({ children, variant = 'sage', className }: MicroBadgeProps) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}