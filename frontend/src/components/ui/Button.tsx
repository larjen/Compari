'use client';

/**
 * @component Button
 * @description Standardized UI button component.
 * Import paths across the codebase use exact PascalCase ('@/components/ui/Button') to resolve Webpack module casing conflicts.
 */

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ButtonVariant, ButtonSize } from '@/lib/types';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-accent-forest text-white hover:bg-accent-forest-light focus:ring-accent-sage',
      secondary: 'bg-accent-sand/30 text-themed-fg-main border border-accent-sand/50 hover:bg-accent-sand/50 focus:ring-accent-sage',
      ghost: 'text-themed-fg-muted hover:text-themed-fg-main hover:bg-accent-sand/20 focus:ring-accent-sage',
      danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      icon: 'p-1.5 flex-shrink-0 flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
