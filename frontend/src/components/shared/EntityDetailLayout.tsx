'use client';

/**
 * @module EntityDetailLayout
 * @description Shared layout component for entity detail modals.
 * 
 * @responsibility
 * - Provides a unified layout structure for entity detail modals.
 * - Ensures consistent dimensions and scrolling behavior across all domain modals.
 * - Delegates domain-specific content rendering to child components.
 * 
 * @boundary_rules
 * - ❌ MUST NOT contain domain-specific logic.
 * - ❌ MUST NOT fetch data or manage entity state.
 * - ✅ MUST accept content via children prop for flexible rendering.
 * - ✅ MUST provide consistent modal structure.
 * 
 * @socexplanation
 * - Provides a unified layout for entity details, ensuring consistent dimensions 
 *   and scrolling behavior while delegating domain-specific content to child components.
 * - This eliminates duplicate layout code across the three domain modals (Job, User, Match).
 */
import { ReactNode } from 'react';
import { Dialog } from '@/components/ui';
import { Tabs } from '@/components/shared/Tabs';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface EntityDetailLayoutProps {
  /** The main title displayed in the dialog header */
  title: ReactNode;
  /** Optional subtitle displayed below the title */
  subtitle?: ReactNode;
  /** Array of tab configurations */
  tabs: Tab[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (id: string) => void;
  /** Unique prefix for tab layout animations */
  layoutIdPrefix: string;
  /** Child content (typically conditional render based on activeTab) */
  children: ReactNode;
  /** Optional footer actions (e.g., Delete button) */
  footerActions?: ReactNode;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
}

/**
 * EntityDetailLayout - Unified layout for entity detail modals.
 * 
 * Provides consistent:
 * - Modal dimensions (max-w-4xl)
 * - Tab navigation at top
 * - Scrollable content area
 * - Optional footer actions
 */
export function EntityDetailLayout({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  layoutIdPrefix,
  children,
  footerActions,
  open,
  onClose,
}: EntityDetailLayoutProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      className="md:max-w-4xl"
      topContent={
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={onTabChange}
          layoutIdPrefix={layoutIdPrefix}
        />
      }
      bottomContent={
        footerActions ? (
          <div className="flex items-center justify-end gap-3 w-full">
            {footerActions}
          </div>
        ) : undefined
      }
    >
      <div className="pb-4">
        {children}
      </div>
    </Dialog>
  );
}