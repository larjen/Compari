'use client';

/**
 * @module OfferingsPage
 * @description Entry point for the Offerings dashboard.
 * @responsibility Thin wrapper delegating rendering to the unified EntityDashboard.
 */
import { Suspense } from 'react';
import { EntityDashboard } from '@/components/entities/EntityDashboard';
import { ContentLoader } from '@/components/shared/PageStates';
import { ENTITY_ROLES } from '@/lib/constants';

export default function OfferingsPage() {
  return (
    <Suspense fallback={<ContentLoader delay={200} />}>
      <EntityDashboard entityRole={ENTITY_ROLES.OFFERING} />
    </Suspense>
  );
}