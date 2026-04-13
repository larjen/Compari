'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const colors: Record<string, string> = {
    Waiting: 'bg-status-waiting/20 text-amber-900 border-status-waiting/30',
    Preparing: 'bg-status-preparing/20 text-emerald-900 border-status-preparing/30',
    Sent: 'bg-status-sent/20 text-teal-900 border-status-sent/30',
    Finished: 'bg-status-finished/20 text-gray-900 border-status-finished/30',
    pending: 'bg-gray-100 text-gray-600 border-gray-200',
    processing: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    error: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        colors[status] || 'bg-gray-100 text-gray-600 border-gray-200',
        className
      )}
    >
      {status}
    </span>
  );
}
