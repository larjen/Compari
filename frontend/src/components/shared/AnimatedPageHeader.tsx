'use client';

import { ReactNode, useEffect, useState } from 'react';

/**
 * @description Animated page header component that manages loading state transitions for FilterBar and Pagination.
 * @responsibility Provides a reusable animated wrapper that fades in content when loading completes, extracting the isReady pattern from page components.
 * @boundary_rules
 * - ❌ MUST NOT contain business logic.
 * - ❌ MUST NOT fetch data directly.
 * - ❌ MUST NOT manage pagination or filtering state.
 */
interface AnimatedPageHeaderProps {
  /** Whether the data is still loading */
  loading: boolean;
  /** Child components to render inside the header (typically FilterBar and Pagination) */
  children: ReactNode;
}

export function AnimatedPageHeader({ loading, children }: AnimatedPageHeaderProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      setIsReady(true);
    }
  }, [loading]);

  return (
    <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 transition-opacity duration-500 ease-in-out ${isReady ? 'opacity-100' : 'opacity-0'}`}>
      {children}
    </div>
  );
}