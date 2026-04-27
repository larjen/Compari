'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Button, CreateButton } from '@/components/ui';
import { ChatDrawerWrapper } from './ChatDrawerWrapper';
import { useModal, ModalType } from '@/hooks/useModal';
import { useTerminology } from '@/hooks/useTerminology';
import { Logo } from '@/components/ui/Logo';
import { MODAL_TYPES } from '@/lib/constants';

/**
 * Navigation route configuration.
 */
interface NavRoute {
  /** The display label for the navigation link */
  label: string;
  /** The Next.js route path */
  href: string;
  /** The modal type to open when creating a new item */
  modalType: ModalType;
  /** The entity name for the create button */
  entityName: string;
}

/**
 * NavbarProps interface for the Navbar component.
 */
interface NavbarProps {
  /** Optional loading state for sync indicator */
  isLoading?: boolean;
}

/**
 * Navbar component providing navigation and create functionality.
 * 
 * This component handles navigation between different pages and provides
 * a dynamic create button that triggers the appropriate modal based on
 * the current route. It uses the useModal hook to communicate create
 * intents to individual pages, maintaining Separation of Concerns.
 * 
 * @param isLoading - Optional prop to show sync indicator
 * @returns The Navbar React component
 */
export function Navbar({ isLoading }: NavbarProps) {
  const pathname = usePathname();

  if (pathname?.startsWith('/print') || pathname?.startsWith('/log-viewer')) {
    return null;
  }

  const { openModal } = useModal();
  const { activeLabels } = useTerminology();
  const { requirement: { singular: requirementLabelSingular, plural: requirementLabelPlural }, offering: { singular: offeringLabelSingular, plural: offeringLabelPlural } } = activeLabels;

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, [pathname]);

  /**
   * Navigation route configuration.
   * Note: Setting modalType to null hides the global 'Create' button for that specific route.
   * * @socexplanation 
   * The 'Requirements' route is explicitly set to '/requirements' (matching its canonical path) 
   * to ensure navigation highlighting works via the startsWith logic in the isActive helper.
   */
  const NAV_ROUTES: NavRoute[] = [
    { label: requirementLabelPlural, href: '/requirements', modalType: MODAL_TYPES.CREATE_REQUIREMENT, entityName: requirementLabelSingular },
    { label: offeringLabelPlural, href: '/offerings', modalType: MODAL_TYPES.CREATE_OFFERING, entityName: offeringLabelSingular },
    { label: 'Criteria', href: '/criteria', modalType: MODAL_TYPES.CREATE_CRITERION, entityName: 'Criterion' },
    { label: 'Matches', href: '/matches', modalType: MODAL_TYPES.CREATE_MATCH, entityName: 'Match' },
  ];

  const currentRoute = NAV_ROUTES.find((route) => {
    if (route.href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(route.href);
  }) || NAV_ROUTES[0];

  const handleCreateClick = () => {
    if (currentRoute.modalType) {
      openModal(currentRoute.modalType);
    }
  };

  const shouldShowCreateButton = currentRoute.modalType !== null;

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav
      className={`${isReady ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500 ease-in-out sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border-light`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            {/* Using a plain anchor tag instead of Next.js Link to force a full page refresh and state reset when returning home */}
            <a href="/" className="flex items-center hover:opacity-90 transition-opacity cursor-pointer">
              <div className="flex items-center gap-3">
                <Logo className="h-8 w-auto text-accent-forest" width={140} height={33} />
              </div>
            </a>

            <div className="flex items-center gap-1">
              {NAV_ROUTES.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(route.href)
                    ? 'bg-accent-sage/20 text-accent-forest'
                    : 'text-accent-forest/70 hover:text-accent-forest hover:bg-accent-sage/10'
                    }`}
                >
                  {route.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoading && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 bg-accent-sage/20 rounded-full text-accent-forest text-sm"
              >
                <span>Syncing...</span>
              </div>
            )}

            {shouldShowCreateButton && (
              <CreateButton 
                entityName={currentRoute.entityName} 
                onClick={handleCreateClick} 
                size="sm"
              />
            )}

            <ChatDrawerWrapper />

            <Button variant="ghost" size="sm" onClick={() => openModal(MODAL_TYPES.SETTINGS)}>
              <DOMAIN_ICONS.SETTINGS className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}