'use client';

/**
 * @module MetadataEditor
 * @description Separation of Concerns: This component is the exclusive owner of metadata presentation and inline-editing UX. It delegates data persistence to the provided onSave callback.
 */

import { useState } from 'react';
import { Entity, BlueprintField } from '@/lib/types';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { FIELD_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui';
import { DetailItem } from '@/components/shared/DetailItem';
import { cn } from '@/lib/utils';

/**
 * @interface MetadataEditorProps
 * @description Props for the MetadataEditor component
 * @property {Entity} entity - The entity containing metadata
 * @property {BlueprintField[] | null} metadataFields - Blueprint field definitions
 * @property {(key: string, value: string) => Promise<void>} onSave - Callback to save metadata changes
 */
interface MetadataEditorProps {
  entity: Entity;
  metadataFields: BlueprintField[] | null;
  onSave: (key: string, value: string) => Promise<void>;
}

/**
 * @function getValidUrl
 * @description Safely checks and formats a string into a valid HTTP/HTTPS URL or mailto: link.
 * Aggressively strips literal quotes and brackets to handle raw JSON strings.
 */
const getValidUrl = (val: unknown): string | null => {
  if (typeof val !== 'string') return null;
  
  let cleanString = val.replace(/['"\[\]]/g, '').trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(cleanString)) {
    return 'mailto:' + cleanString;
  }

  if (cleanString.toLowerCase().startsWith('www.')) {
    cleanString = 'https://' + cleanString;
  }

  try {
    const url = new URL(cleanString);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return url.href; 
    }
    return null;
  } catch {
    return null; 
  }
};

export function MetadataEditor({ entity, metadataFields, onSave }: MetadataEditorProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const blueprintKeys = metadataFields ? metadataFields.map(f => f.field_name) : [];
  const actualKeys = Object.keys((entity.metadata as Record<string, any>) || {});
  const metadataKeys = Array.from(new Set([...blueprintKeys, ...actualKeys]));

  const handleSaveMetadata = async (key: string, value: string) => {
    setIsSaving(true);
    try {
      await onSave(key, value);
      setEditingKey(null);
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
    } finally {
      setIsSaving(false);
    }
  };

  const getInputType = (type?: string) => {
    switch (type) {
      case FIELD_TYPES.DATE:
        return 'date';
      case FIELD_TYPES.NUMBER:
        return 'number';
      case FIELD_TYPES.BOOLEAN:
        return 'checkbox';
      default:
        return 'text';
    }
  };

  const isBooleanValue = (val: unknown): boolean => {
    return val === 'true' || val === '1' || val === true;
  };

  const toDisplayString = (val: unknown): string => {
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val ?? '');
  };

  if (metadataKeys.length === 0) return null;

  return (
    <div className="border-t border-border-light pt-4 mt-4">
      <h4 className="text-sm font-semibold text-accent-forest mb-3">Metadata</h4>
      {metadataKeys.map((key) => {
        /**
         * Infrastructure: Metadata is stored as JSON/unknown; explicit casting is required for frontend type safety.
         */
        const value = (entity.metadata as Record<string, any>)?.[key];
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');

        const blueprintField = metadataFields?.find(f => f.field_name === key);
        const fieldType = blueprintField?.field_type || 'string';
        const fieldDescription = blueprintField?.description;

        const urlHref = getValidUrl(displayValue);
        
        if (displayValue.includes('http') && !urlHref) {
          console.warn('URL Parser failed on:', { rawValue: value, displayValue });
        }

        return (
          <DetailItem
            key={key}
            label={key}
            tooltip={fieldDescription}
          >
            {editingKey === key ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type={getInputType(fieldType) as 'text' | 'number' | 'date'}
                  checked={fieldType === FIELD_TYPES.BOOLEAN && isBooleanValue(editValue)}
                  value={fieldType === FIELD_TYPES.BOOLEAN ? undefined : editValue}
                  onChange={(e) => setEditValue(fieldType === FIELD_TYPES.BOOLEAN ? (e.target.checked ? 'true' : 'false') : e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-accent-sage/30 rounded bg-themed-input-bg text-themed-fg-main focus:outline-none focus:border-accent-forest"
                  disabled={isSaving}
                />
                <Button
                  onClick={() => handleSaveMetadata(key, editValue)}
                  disabled={isSaving}
                  variant="ghost"
                  size="icon"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-accent-forest border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <DOMAIN_ICONS.SAVE className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  onClick={() => setEditingKey(null)}
                  disabled={isSaving}
                  variant="ghost"
                  size="icon"
                >
                  <DOMAIN_ICONS.CLOSE className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1 min-w-0">
                {fieldType === FIELD_TYPES.BOOLEAN ? (
                  <span
                    className={cn(
                      'text-sm',
                      isBooleanValue(displayValue)
                        ? 'text-green-600'
                        : 'text-accent-forest/50'
                    )}
                  >
                    {isBooleanValue(displayValue) ? 'Yes' : 'No'}
                  </span>
                ) : urlHref ? (
                  <a
                    href={urlHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline truncate flex-1 block relative z-10"
                    onClick={(e) => e.stopPropagation()}
                    title={`Open ${urlHref} in a new tab. Full URL: ${toDisplayString(value)}`}
                  >
                    {toDisplayString(value).replace(/['"\[\]]/g, '')}
                  </a>
                ) : (
                  <span 
                    className="text-sm text-accent-forest truncate flex-1 block"
                    title={toDisplayString(value)}
                  >
                    {toDisplayString(value) || '—'}
                  </span>
                )}
                <Button
                  onClick={() => {
                    setEditingKey(key);
                    setEditValue(toDisplayString(value));
                  }}
                  variant="ghost"
                  size="icon"
                  className="text-accent-forest/50 hover:text-accent-forest shrink-0 relative z-10"
                >
                  <DOMAIN_ICONS.EDIT className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </DetailItem>
        );
      })}
    </div>
  );
}