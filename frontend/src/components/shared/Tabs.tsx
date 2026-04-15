'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

/**
 * Tab definition for the Tabs component.
 */
interface Tab {
  /** Unique identifier for the tab */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Lucide icon component to display */
  icon: React.ElementType;
}

/**
 * Props for the Tabs component.
 */
interface TabsProps {
  /**
   * Array of tab definitions.
   * @example
   * [
   *   { id: 'info', label: 'General Info', icon: Info },
   *   { id: 'criteria', label: 'Criteria', icon: ListChecks }
   * ]
   */
  tabs: Tab[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when a tab is clicked */
  onChange: (id: string) => void;
  /**
   * Prefix for framer-motion layoutId to prevent animation conflicts
   * when multiple Tabs components exist on the same page.
   * @example "jobDetail" results in "jobDetail-activeTab"
   */
  layoutIdPrefix: string;
}

/**
 * A reusable animated tab navigation component.
 * 
 * Provides a consistent tab interface with smooth framer-motion
 * underline animations. The component is purely presentational -
 * it does not manage state, delegating all tab selection logic
 * to the parent via the onChange callback.
 * 
 * @param props - Component props
 * @returns React component with animated tab navigation
 * 
 * @socexplanation
 * - Separation of Concerns: This component handles only the visual
 *   presentation of tabs. Parent components maintain all state management.
 * - The layoutIdPrefix ensures unique animation IDs when multiple
 *   tab groups exist on the same page (e.g., JobListingDetailModal
 *   and UserDetailModal both using tabs).
 * - Uses framer-motion's layoutId for smooth tab indicator transitions.
 */
export function Tabs({ tabs, activeTab, onChange, layoutIdPrefix }: TabsProps) {
  return (
    <div className="flex">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
              isActive
                ? 'text-accent-forest'
                : 'text-accent-forest/50 hover:text-accent-forest/70'
            )}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
            {isActive && (
              <motion.div
                layoutId={`${layoutIdPrefix}-activeTab`}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-forest"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}