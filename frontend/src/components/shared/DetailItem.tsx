'use client';

import { ReactNode, ElementType } from 'react';

interface DetailItemProps {
  /** Optional Lucide icon component to display in the left container. */
  icon?: ElementType;
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  iconBgColor?: string;
  tooltip?: string;
}

/**
 * @component DetailItem
 * @description A reusable information display component.
 * @responsibility Displays a label and value/children in a consistent layout. Icons are optional.
 */
export function DetailItem({
  icon: Icon,
  label,
  value,
  children,
  iconBgColor = 'bg-accent-sage/10',
  tooltip
}: DetailItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
      {Icon && (
        <div className={`p-2 rounded-lg ${iconBgColor} shrink-0`}>
          <Icon className="w-4 h-4 text-accent-forest" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wide text-accent-forest/50 truncate" title={tooltip || label}>
          {label}
        </p>
        {children ? (
          <div className="mt-1 min-w-0">{children}</div>
        ) : value !== undefined ? (
          <p 
            className="text-sm font-medium text-accent-forest mt-1 truncate"
            title={typeof value === 'string' ? value : String(value)}
          >
            {value}
          </p>
        ) : null}
      </div>
    </div>
  );
}