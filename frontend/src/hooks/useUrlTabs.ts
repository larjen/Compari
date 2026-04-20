'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * @description Custom hook for managing URL-synced tab state. Extracts URL parameter syncing logic from modal components.
 * @responsibility Manages active tab state via URL search params, enabling deep linking and browser history navigation for tabs.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT contain business logic beyond URL parameter management.
 * - ❌ MUST NOT fetch data directly.
 */
export function useUrlTabs<T extends string>(defaultTab: T): { activeTab: string; handleTabChange: (id: string) => void } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get('tab') || defaultTab;

  const handleTabChange = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    router.push(pathname + '?' + params.toString(), { scroll: false });
  };

  return {
    activeTab,
    handleTabChange,
  };
}