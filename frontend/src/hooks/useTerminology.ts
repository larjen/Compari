'use client';

import { useMemo } from 'react';
import { useBlueprints } from './useBlueprints';
import { Entity, EntityType, Blueprint } from '@/lib/types';
import { ENTITY_ROLES } from '@/lib/constants';

/**
 * @description Single Source of Truth (SSoT) for Dynamic Blueprint Terminology.
 * @responsibility Centralizes all singular, plural, and document type label resolution based on active blueprint.
 * @boundary_rules
 * - ❌ MUST NOT use inline string unions or magic fallback strings outside of this hook.
 * - ✅ MUST use ENTITY_ROLES from @/lib/constants for all type checking.
 * - ✅ MUST return consistent label structure for all consuming components.
 */
interface TerminologyLabels {
  singular: string;
  plural: string;
  docType: string;
}

interface ActiveLabels {
  requirement: TerminologyLabels;
  offering: TerminologyLabels;
}

interface EntityLabels {
  singular: string;
  plural: string;
}

interface UseTerminologyReturn {
  activeBlueprint: Blueprint | null;
  activeLabels: ActiveLabels;
  getEntityLabels: (entity: Partial<Entity>) => EntityLabels;
}

/**
 * Hook providing centralized terminology resolution based on the active blueprint.
 * Eliminates WET code by providing a single source of truth for all entity label lookups.
 * 
 * @returns {UseTerminologyReturn} - Contains activeLabels object and getEntityLabels function
 */
export function useTerminology(): UseTerminologyReturn {
  const { blueprints } = useBlueprints();

  const activeBlueprint = useMemo(() => {
    return blueprints.find(b => b.is_active) || blueprints[0] || null;
  }, [blueprints]);

  const activeLabels: ActiveLabels = useMemo(() => {
    return {
      requirement: {
        singular: activeBlueprint?.requirementLabelSingular || 'Requirement',
        plural: activeBlueprint?.requirementLabelPlural || 'Requirements',
        docType: activeBlueprint?.requirementDocTypeLabel || 'Requirement document',
      },
      offering: {
        singular: activeBlueprint?.offeringLabelSingular || 'Offering',
        plural: activeBlueprint?.offeringLabelPlural || 'Offerings',
        docType: activeBlueprint?.offeringDocTypeLabel || 'Offering document',
      },
    };
  }, [activeBlueprint]);

  const getEntityLabels = useMemo(() => {
    return (entity: Partial<Entity>): EntityLabels => {
      if (!entity) {
        return { singular: 'Entity', plural: 'Entities' };
      }

      const entityBlueprintId = entity.blueprint_id;
      const entityBlueprint = entityBlueprintId 
        ? blueprints.find(b => b.id === entityBlueprintId) 
        : activeBlueprint;

      if (!entityBlueprint) {
        return entity.type === ENTITY_ROLES.REQUIREMENT
          ? { singular: 'Requirement', plural: 'Requirements' }
          : { singular: 'Offering', plural: 'Offerings' };
      }

      if (entity.type === ENTITY_ROLES.REQUIREMENT) {
        return {
          singular: entityBlueprint.requirementLabelSingular || 'Requirement',
          plural: entityBlueprint.requirementLabelPlural || 'Requirements',
        };
      }

      if (entity.type === ENTITY_ROLES.OFFERING) {
        return {
          singular: entityBlueprint.offeringLabelSingular || 'Offering',
          plural: entityBlueprint.offeringLabelPlural || 'Offerings',
        };
      }

      return { singular: 'Entity', plural: 'Entities' };
    };
  }, [blueprints, activeBlueprint]);

  return { activeBlueprint, activeLabels, getEntityLabels };
}