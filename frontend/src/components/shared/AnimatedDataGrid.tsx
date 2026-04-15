/**
 * @fileoverview AnimatedDataGrid - Reusable animated grid component for DRY principle
 * 
 * @description
 * This component centralizes Framer Motion pagination animations across multiple pages
 * (Requirements, Offerings, Matches, Criteria). Previously, this exact logic was duplicated
 * in each page:
 * 
 * - `AnimatePresence mode="wait"` wrapper
 * - `motion.div` with grid container variants
 * - `gridKey` state for stable animation keying
 * - Inline state synchronization logic to prevent 1-frame flash on pagination
 * 
 * This component enforces the DRY (Don't Repeat Yourself) principle by:
 * 1. Encapsulating `AnimatePresence` and `motion.div` grid patterns
 * 2. Maintaining internal `gridKey` state that auto-syncs with dependency changes
 * 3. Providing a render prop pattern for flexible item rendering
 * 4. Supporting both flat mode and grouped mode for complex layouts
 * 
 * @solution_to_wet_code
 * The WET (Write Everything Twice) code previously found in pages like:
 * - `src/app/page.tsx` (Requirements)
 * - `src/app/offerings/page.tsx` (Offerings)
 * - `src/app/matches/page.tsx` (Matches)
 * - `src/app/criteria/page.tsx` (Criteria)
 * 
 * Has been consolidated into this single reusable component.
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMasterContainer, masterItem } from '@/lib/ui-configs';

/**
 * Props for AnimatedDataGrid component
 * 
 * Supports two modes:
 * - Flat mode: Simple array of items rendered with renderItem
 * - Grouped mode: Groups of items with headers (like Criteria by dimension)
 * 
 * @template T - The type of items being rendered in the grid
 * @template TGroup - The type of group keys (typically string)
 */
interface AnimatedDataGridProps<T extends { id?: number | string }, TGroup extends string | number | symbol = string> {
  /** Array of items to render in the grid (flat mode) */
  items?: T[];
  /** Loading state to control initial render */
  loading: boolean;
  /** Current page number (used for grid key) */
  page: number;
  /** Current search query (used for grid key) */
  search: string;
  /** Current status/filter value (used for grid key) */
  status: string;
  /** Prefix for the animation grid key (e.g., 'req-grid', 'off-grid', 'match-grid') */
  gridKeyPrefix: string;
  /** 
   * Render prop function to render individual items (flat mode)
   * @param item - The item to render
   * @param index - The index of the item in the array
   * @returns React node to render
   */
  renderItem?: (item: T, index: number) => React.ReactNode;
  /** 
   * Grouped mode: Record of group keys to arrays of items
   * Use this when items need to be rendered in groups (like Criteria by dimension)
   */
  groups?: Record<TGroup, T[]>;
  /** 
   * Grouped mode: Ordered array of group keys to determine render order
   */
  sortedGroups?: TGroup[];
  /** 
   * Grouped mode: Render prop for group header
   * @param groupKey - The key for this group
   * @param itemCount - Number of items in this group
   * @returns React node for the group header
   */
  renderGroupHeader?: (groupKey: TGroup, itemCount: number) => React.ReactNode;
  /** 
   * Grouped mode: Render prop for items within a group
   * @param item - The item to render
   * @param index - The index within the group
   * @returns React node
   */
  renderGroupItem?: (item: T, index: number) => React.ReactNode;
  /** Optional CSS class name for the grid container */
  className?: string;
  /** Optional stagger delay override (defaults to ui-configs value) */
  staggerDelay?: number;
  /** Optional exit duration override (defaults to ui-configs value) */
  exitDuration?: number;
}

/**
 * AnimatedDataGrid - Reusable animated grid component
 * 
 * Supports multiple layout modes:
 * - Grid mode (default): Standard card grid with col classes
 * - List mode: Vertical list with space-y spacing for grouped content
 * - Custom: Provide custom className for complete flexibility
 * 
 * @example
 * ```tsx
 * // Grid mode (default)
 * <AnimatedDataGrid
 *   items={entities}
 *   loading={loading}
 *   page={page}
 *   search={debouncedSearch}
 *   status={status}
 *   gridKeyPrefix="req-grid"
 *   renderItem={(entity) => <EntityCard entity={entity} />}
 *   className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
 * />
 * 
 * // Grouped mode (for Criteria by dimension)
 * <AnimatedDataGrid
 *   loading={loading}
 *   page={page}
 *   search={debouncedSearch}
 *   status={status}
 *   gridKeyPrefix="criteria-grid"
 *   groups={displayGroups}
 *   sortedGroups={sortedDimensions}
 *   renderGroupHeader={(dimension, count) => (
 *     <h2 className="text-xl font-serif...">{getDimensionLabel(dimension)} ({count})</h2>
 *   )}
 *   renderGroupItem={(criterion) => <CriterionPill ... />}
 *   className="space-y-10"
 *   staggerDelay={0.008}
 * />
 * ```
 * 
 * @param props - Component props
 * @returns Animated grid with Framer Motion transitions
 */
export function AnimatedDataGrid<T extends { id?: number | string }, TGroup extends string | number | symbol = string>({
  items,
  loading,
  page,
  search,
  status,
  gridKeyPrefix,
  renderItem,
  groups,
  sortedGroups,
  renderGroupHeader,
  renderGroupItem,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6',
  staggerDelay,
  exitDuration,
}: AnimatedDataGridProps<T, TGroup>) {
  const [gridKey, setGridKey] = useState(`${gridKeyPrefix}-${page}-${search}-${status}`);

  /**
   * Inline state synchronization to prevent 1-frame rendering flash.
   * 
   * Updating state during render (rather than in useEffect) ensures the animation
   * key changes synchronously with the new data, avoiding a frame where new content
   * renders with the old gridKey causing incorrect exit animations.
   * 
   * This pattern was duplicated in all four pages before refactoring.
   */
  const expectedGridKey = `${gridKeyPrefix}-${page}-${search}-${status}`;
  if (!loading && gridKey !== expectedGridKey) {
    setGridKey(expectedGridKey);
  }

  const isGroupedMode = groups && sortedGroups && renderGroupHeader && renderGroupItem;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gridKey}
        variants={getMasterContainer(staggerDelay, exitDuration)}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={className}
      >
        {isGroupedMode ? (
          // Grouped mode: render groups with headers
          sortedGroups!.map((groupKey) => {
            const groupItems = groups![groupKey];
            return (
              <div key={groupKey as string} className="space-y-4">
                <motion.div variants={masterItem}>
                  {renderGroupHeader!(groupKey, groupItems.length)}
                </motion.div>
                <div className="flex flex-wrap gap-3">
                  {groupItems.map((item, index) => (
                    <motion.div key={item.id ?? index} variants={masterItem} className="min-w-0 max-w-full">
                      {renderGroupItem!(item, index)}
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Flat mode: render items directly
          items?.map((item, index) => (
            <motion.div key={item.id ?? index} variants={masterItem} className="min-w-0 max-w-full">
              {renderItem!(item, index)}
            </motion.div>
          ))
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default AnimatedDataGrid;