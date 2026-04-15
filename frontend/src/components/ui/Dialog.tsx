'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  /** Fixed content injected immediately below the header (e.g., Tabs) */
  topContent?: ReactNode;
  /** Fixed content injected at the very bottom of the modal (e.g., Footer Actions) */
  bottomContent?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Dialog({ 
  open, 
  onClose, 
  title, 
  subtitle, 
  status, 
  topContent,
  bottomContent,
  children, 
  className 
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-accent-forest/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'relative flex flex-col overflow-hidden w-full h-[100dvh] md:w-full md:max-w-5xl md:h-full',
              'md:rounded-2xl bg-white/95 backdrop-blur-md md:shadow-2xl border border-border-light md:border-none',
              className
            )}
          >
            {/* 1. Header (Fixed) */}
            {title && (
              <div className={cn(
                "flex items-center justify-between px-4 py-4 md:px-8 md:py-6 gap-4 shrink-0 bg-white/50",
                !topContent && "border-b border-border-light"
              )}>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-serif font-semibold text-accent-forest truncate whitespace-nowrap">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="text-sm text-accent-forest/60 truncate whitespace-nowrap">{subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {status}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-accent-forest/60 hover:text-accent-forest hover:bg-accent-sand/20 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* 2. Top Content (Fixed) */}
            {topContent && (
              <div className="shrink-0 px-4 md:px-8 border-b border-border-light bg-white/50">
                {topContent}
              </div>
            )}

            {/* 3. Scrolling Body */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-8">
              {children}
            </div>

            {/* 4. Bottom Content (Fixed) */}
            {bottomContent && (
              <div className="shrink-0 px-4 py-3 md:px-8 md:py-4 border-t border-border-light bg-accent-sand/5">
                {bottomContent}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}