'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { TOAST_TYPES } from '@/lib/constants';

/**
 * @responsibility Renders toasts with defensive fallbacks to prevent React crashes from unknown toast types.
 * @boundary_rules - If toast.type is invalid/undefined, defaults to 'info' type
 *                  - Never renders undefined components; always provides a valid LucideIcon
 * @socexplanation This component handles presentation logic only. State management is delegated to useToast hook.
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  const icons = {
    [TOAST_TYPES.SUCCESS]: DOMAIN_ICONS.SUCCESS,
    [TOAST_TYPES.ERROR]: DOMAIN_ICONS.ERROR,
    [TOAST_TYPES.INFO]: DOMAIN_ICONS.INFO,
  };

  const styles = {
    [TOAST_TYPES.SUCCESS]: 'bg-green-50 border-green-200 text-green-800',
    [TOAST_TYPES.ERROR]: 'bg-red-50 border-red-200 text-red-800',
    [TOAST_TYPES.INFO]: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconStyles = {
    [TOAST_TYPES.SUCCESS]: 'text-green-500',
    [TOAST_TYPES.ERROR]: 'text-red-500',
    [TOAST_TYPES.INFO]: 'text-blue-500',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 max-w-lg">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type as keyof typeof icons] || DOMAIN_ICONS.INFO;
          const styleClass = styles[toast.type as keyof typeof styles] || styles[TOAST_TYPES.INFO];
          const iconStyleClass = iconStyles[toast.type as keyof typeof iconStyles] || iconStyles[TOAST_TYPES.INFO];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md',
                styleClass
              )}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', iconStyleClass)} />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-0.5 hover:bg-black/5 rounded transition-colors"
              >
                <DOMAIN_ICONS.CLOSE className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
