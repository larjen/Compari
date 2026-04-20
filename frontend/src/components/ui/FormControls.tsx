'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, LabelHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * @description Standardized form label component with consistent styling
 * @responsibility Provides consistent label styling across all forms
 * @boundary_rules Purely presentational - accepts all standard HTML label attributes
 */
interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'block text-xs font-bold text-themed-fg-muted uppercase mb-1',
          className
        )}
        {...props}
      >
        {children}
      </label>
    );
  }
);

FormLabel.displayName = 'FormLabel';

/**
 * @description Standardized form input component with consistent styling
 * @responsibility Absorbs Tailwind classes for input fields, accepting standard HTML input attributes
 * @boundary_rules Merges passed className with base styles
 */
interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-themed-input-border rounded-lg bg-themed-input-bg text-themed-fg-main focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm',
          className
        )}
        {...props}
      />
    );
  }
);

FormInput.displayName = 'FormInput';

/**
 * @description Standardized form select component with consistent styling
 * @responsibility Absorbs Tailwind classes for select dropdowns, accepting standard HTML select attributes
 * @boundary_rules Merges passed className with base styles
 */
interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-themed-input-border rounded-lg bg-themed-input-bg text-themed-fg-main focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

FormSelect.displayName = 'FormSelect';

/**
 * @description Standardized form textarea component with consistent styling
 * @responsibility Absorbs Tailwind classes for textarea fields, accepting standard HTML textarea attributes
 * @boundary_rules Merges passed className with base styles
 */
interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-themed-input-border rounded-lg bg-themed-input-bg text-themed-fg-main focus:ring-2 focus:ring-accent-sage/50 outline-none text-sm',
          className
        )}
        {...props}
      />
    );
  }
);

FormTextarea.displayName = 'FormTextarea';