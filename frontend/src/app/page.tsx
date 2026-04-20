'use client';

/**
 * @module RequirementsPage
 * @description Entry point for the Requirements dashboard.
 * @responsibility Thin wrapper delegating rendering to the unified EntityDashboard.
 */
import { Suspense } from 'react';
import { EntityDashboard } from '@/components/entities/EntityDashboard';
import { ContentLoader } from '@/components/shared/PageStates';
import { ENTITY_ROLES } from '@/lib/constants';

export default function Home() {
  return (
    <Suspense fallback={<ContentLoader delay={200} />}>
      <EntityDashboard entityRole={ENTITY_ROLES.REQUIREMENT} />
    </Suspense>
  );
}