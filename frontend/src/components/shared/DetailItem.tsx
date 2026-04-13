'use client';

/**
 * Props for the DetailItem component.
 */
interface DetailItemProps {
  /**
   * Lucide icon component to display in the left container.
   */
  icon: React.ElementType;
  /**
   * Label text displayed above the value (typically uppercase).
   */
  label: string;
  /**
   * Simple value to display. Use this for read-only text display.
   * Mutually exclusive with children - use whichever fits your use case.
   */
  value?: React.ReactNode;
  /**
   * Complex children (e.g., input fields, edit controls).
   * Use this when you need inline editing or complex layouts.
   * Mutually exclusive with value.
   */
  children?: React.ReactNode;
  /**
   * Background color class for the icon container.
   * @default "bg-accent-sage/10"
   */
  iconBgColor?: string;
  /**
   * Optional tooltip text to display on hover.
   */
  tooltip?: string;
}

/**
 * A reusable information display component.
 * 
 * Displays an icon with a label and value/children in a consistent layout.
 * The component follows the pattern of having an icon container on the left,
 * with label and value displayed next to it. Supports both simple text display
 * and complex children for inline editing scenarios.
 * 
 * @param props - Component props
 * @returns React component with icon, label, and value/children
 * 
 * @example
 * // Simple read-only display
 * <DetailItem
 *   icon={Calendar}
 *   label="Posted Date"
 *   value="January 15, 2024"
 * />
 * 
 * @example
 * // Complex children for inline editing
 * <DetailItem icon={Link} label="Job URL">
 *   <div className="flex items-center gap-2">
 *     <input type="text" value={url} onChange={...} />
 *     <button onClick={save}>Save</button>
 *   </div>
 * </DetailItem>
 * 
 * @socexplanation
 * - Separation of Concerns: This component is purely presentational.
 *   It handles layout only - the parent manages all edit state and logic.
 * - Reusable Pattern: Used in both JobListingDetailModal and UserDetailModal
 *   for displaying dates, URLs, and other metadata.
 * - Supports两种 modes: Simple value display for read-only data,
 *   or children for complex edit states (inline inputs, buttons, etc.).
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
      <div className={`p-2 rounded-lg ${iconBgColor}`}>
        <Icon className="w-4 h-4 text-accent-forest" />
      </div>
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