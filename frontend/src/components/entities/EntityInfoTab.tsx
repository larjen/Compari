'use client';

import { Entity, Blueprint } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { DetailItem } from '@/components/shared/DetailItem';
import { MetadataEditor } from './MetadataEditor';

interface EntityInfoTabProps {
  entity: Entity;
  blueprint: Blueprint | undefined;
  onSaveMetadata: (key: string, value: string) => Promise<void>;
}

/**
 * @interface EntityInfoTabProps
 * @description Props for the EntityInfoTab component
 * @description This component focuses purely on the static and dynamic attribute presentation of an Entity.
 * @property {Entity} entity - The entity to display
 * @property {Blueprint | undefined} blueprint - The matched blueprint with field definitions
 * @property {(key: string, value: string) => Promise<void>} onSaveMetadata - Callback to persist metadata changes
 */
export function EntityInfoTab({ entity, blueprint, onSaveMetadata }: EntityInfoTabProps) {
  // SoC: Presentation layer strictly filters fields to match the entity's role (requirement vs offering)
  const metadataFields = blueprint?.fields?.length
    ? blueprint.fields.filter(f => f.entity_role === entity.type)
    : null;

  return (
    <div className="space-y-4">
      {/* CRITICAL ALERT PRIORITY: 
        Errors are moved to the top to ensure visibility before metadata/static info. 
      */}
      {entity.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <DOMAIN_ICONS.ERROR className="w-4 h-4 text-red-500" />
            <p className="text-sm font-medium text-red-700">Processing Failed</p>
          </div>
          <p className="text-xs text-red-600 mb-2">{entity.error}</p>
        </div>
      )}

      <DetailItem label="Type">
        <p className="text-sm font-medium text-accent-forest capitalize">{entity.type}</p>
      </DetailItem>

      <DetailItem label="Created">
        <p className="text-sm font-medium text-accent-forest">
          {entity.created_at ? formatDate(entity.created_at) : '—'}
        </p>
      </DetailItem>

      {entity.description && (
        <DetailItem label="Description">
          <p className="text-sm text-accent-forest/80">{entity.description}</p>
        </DetailItem>
      )}

      <MetadataEditor
        entity={entity}
        metadataFields={metadataFields}
        onSave={onSaveMetadata}
      />
    </div>
  );
}