'use client';

import { motion } from 'framer-motion';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useModal } from '@/hooks/useModal';
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
 * @description Captures full URL state (including active tabs) as a return pointer.
 */
export function CriterionPill({ id, label, dimensionId, className }: CriterionPillProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setOriginatingViewID } = useModal();
  const colors = getDimensionColors(dimensionId);

  return (
    <motion.button
      title={label}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={(e) => {
        e.stopPropagation();
        const returnPath = pathname + '?' + searchParams.toString();
        setOriginatingViewID(returnPath);
        router.push(`/criteria?criterionId=${id}`);
      }}
      className={cn(
        'px-4 py-2 print:px-2.5 print:py-1 rounded-full text-sm print:text-[9px] font-medium border text-left transition-all shadow-sm print:shadow-none',
        'hover:shadow-md cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis max-w-full',
        colors.bg, colors.text, colors.border,
        className
      )}
    >
      {label}
    </motion.button>
  );
}