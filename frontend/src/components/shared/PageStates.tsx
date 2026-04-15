/**
 * Centralized full-page layout state components.
 * These components encapsulate common UI states (loading, empty) to avoid duplication across page components.
 * @module components/shared/PageStates
 */

import { Loader2 } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

/**
 * Displays a full-page loading spinner with optional custom text.
 * Uses Framer Motion for a smooth fade-in animation.
 * 
 * @param props - Component props
 * @param props.text - Optional loading text to display below the spinner
 * @param props.delay - Delay in ms before showing the loader (prevents flash for fast loads)
 * @returns A centered loading component with spinner and optional text
 */
export function PageLoader({ text = 'Loading...', delay = 200 }: { text?: string, delay?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return <div className="min-h-screen w-full" />;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <Loader2 className="w-10 h-10 animate-spin text-accent-sage" />
        <p className="text-accent-forest/60 font-medium">{text}</p>
      </motion.div>
    </div>
  );
}

/**
 * Displays a full-page empty state with a custom icon, title, and subtitle.
 * Uses Framer Motion for a smooth fade-in animation.
 * 
 * @param props - Component props
 * @param props.icon - Lucide icon component to display
 * @param props.title - Main title text for the empty state
 * @param props.subtitle - Optional subtitle text providing additional context
 * @returns A centered empty state component with icon, title, and subtitle
 */
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-accent-forest/40">
      <Icon className="w-16 h-16 mb-4 opacity-50" />
      <p className="text-lg font-medium">{title}</p>
      {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

/**
 * Displays an inline loading spinner for content areas.
 * Uses a calculated 60vh height to center perfectly within dashboard layouts.
 *
 * @param props - Component props
 * @param props.text - Optional loading text to display below the spinner
 * @param props.delay - Delay in ms before showing the loader (prevents flash for fast loads)
 */
export function ContentLoader({ text = 'Loading...', delay = 200 }: { text?: string, delay?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return <div className="h-[60vh] w-full" />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[60vh] w-full flex items-center justify-center flex-col gap-4"
    >
      <Loader2 className="w-8 h-8 animate-spin text-accent-sage" />
      <p className="text-accent-forest/70 font-medium">{text}</p>
    </motion.div>
  );
}