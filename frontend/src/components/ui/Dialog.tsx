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
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, subtitle, status, children, className }: DialogProps) {
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
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
              'relative w-full h-full md:w-full md:max-w-5xl md:mx-4 md:h-auto md:rounded-2xl bg-white/95 md:bg-white/95 backdrop-blur-md md:shadow-2xl border border-border-light md:border-none',
              className
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-8 py-6 border-b border-border-light gap-4">
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
            <div className="p-8">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
