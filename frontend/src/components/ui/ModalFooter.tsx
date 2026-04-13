'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
  align?: 'end' | 'between' | 'start';
}

/**
 * A presentational wrapper component for modal footers.
 * Provides consistent styling and alignment options for action buttons.
 *
 * This component is purely presentational - it handles layout and styling
 * but delegates all behavior to its children. This keeps the footer
 * flexible for any type of action (delete, edit, save, etc.).
 *
 * @param children - The action components to render in the footer
 * @param className - Optional additional CSS classes
 * @param align - Alignment option: 'end' (default), 'between', or 'start'
 */
export function ModalFooter({ children, className, align = 'end' }: ModalFooterProps) {
  const justifyClass = {
    end: 'justify-end',
    between: 'justify-between',
    start: 'justify-start',
  }[align];

  return (
    <div className={cn(
      'border-t border-border-light pt-3 mt-4 flex gap-3 min-h-[52px] items-center',
      justifyClass,
      className
    )}>
      {children}
    </div>
  );
}