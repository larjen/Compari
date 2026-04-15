'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn, getDimensionColors } from '@/lib/utils';

interface CriterionPillProps {
  id: number;
  label: string;
  dimensionId?: number;
  className?: string;
}

/**
 * Standardized Criterion Pill.
 * Clicking any pill navigates to the Criteria dashboard and opens that criterion's modal.
 * @responsibility Presentational component that directs users to the criteria details without manipulating history state.
 */
export function CriterionPill({ id, label, dimensionId, className }: CriterionPillProps) {
  const router = useRouter();
  const colors = getDimensionColors(dimensionId);

  return (
    <motion.button
      title={label}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/criteria?criterionId=${id}`);
      }}
      className={cn(
        'inline-block align-middle px-4 py-2 text-sm rounded-full font-medium border text-left transition-all shadow-sm print:shadow-none',
        'hover:shadow-md cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis max-w-full',
        colors.bg, colors.text, colors.border,
        className
      )}
    >
      {label}
    </motion.button>
  );
}