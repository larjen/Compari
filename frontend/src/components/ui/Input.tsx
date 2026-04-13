'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: 'default' | 'inverted';
}

const inputVariants = {
  default: {
    input: 'bg-white border-border-light text-accent-forest placeholder:text-gray-400 focus:ring-accent-sage/30 focus:border-accent-sage',
    label: 'text-accent-forest/80',
  },
  inverted: {
    input: 'bg-white/10 border-white/20 text-white placeholder-white/50 focus:ring-white/30 focus:border-white/30',
    label: 'text-white/70',
  },
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, variant = 'default', ...props }, ref) => {
    const variantStyles = inputVariants[variant];
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={cn('block text-sm font-medium mb-1.5', variantStyles.label)}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2',
            'transition-all duration-200',
            variantStyles.input,
            error && 'border-red-400 focus:ring-red-400/30 focus:border-red-400',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
