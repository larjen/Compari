import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Dimension, Entity, Blueprint, EntityMatch, EntityType } from '@/lib/types';

/**
 * Utility for merging Tailwind CSS class names with conflict resolution.
 * 
 * @param inputs - ClassValue array to merge
 * @returns Merged Tailwind class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a random string ID.
 * 
 * @returns Random 7-character alphanumeric string
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Formats a date string into a human-readable format.
 * 
 * @param dateString - ISO date string or null
 * @returns Formatted date (e.g., "Apr 2, 2026") or empty string
 * 
 * @example
 * formatDate('2026-04-02') // returns "Apr 2, 2026"
 * formatDate(null) // returns ""
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Calculates and formats the elapsed time since a given start time.
 * 
 * @description
 * Handles SQLite UTC timestamps ("YYYY-MM-DD HH:MM:SS") by normalizing them to ISO 8601
 * with 'Z' timezone suffix. Without this fix, browsers would parse UTC times as local time,
 * causing incorrect elapsed durations (e.g., jumping to "2h" due to UTC+2 offset).
 * 
 * @param startTime - Start time in SQLite format ("YYYY-MM-DD HH:MM:SS"), ISO format, or null
 * @returns Formatted elapsed time string (e.g., "30s", "5m", "2h", "1d") or empty string
 * 
 * @architectural_notes
 * - SQLite returns UTC timestamps without timezone info
 * - Browser Date() defaults to local timezone interpretation
 * - This function normalizes to UTC by appending 'Z' before parsing
 * - Handles clock skew by returning '0s' for negative differences
 * 
 * @example
 * formatElapsedTime('2026-04-02 17:27:00') // returns "5m" (if current time is ~5 min later)
 * formatElapsedTime('2026-04-02T17:27:00Z') // returns "5m"
 * formatElapsedTime(null) // returns ""
 */
export function formatElapsedTime(startTime: string | null): string {
  if (!startTime) return '';
  
  let safeTimeStr = startTime;
  if (startTime.includes(' ') && !startTime.includes('T')) {
    safeTimeStr = startTime.replace(' ', 'T') + 'Z';
  } else if (startTime.includes('T') && !startTime.endsWith('Z')) {
    safeTimeStr = startTime + 'Z';
  }
  
  let start: Date;
  if (safeTimeStr.length === 10) {
    start = new Date(safeTimeStr + 'T00:00:00Z');
  } else {
    start = new Date(safeTimeStr);
  }
  
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
  
  if (diff <= 0) return '0s';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Waiting':
      return 'bg-status-waiting/20 text-status-waiting border-status-waiting/30';
    case 'Preparing':
      return 'bg-status-preparing/20 text-status-preparing border-status-preparing/30';
    case 'Sent':
      return 'bg-status-sent/20 text-status-sent border-status-sent/30';
    case 'Finished':
      return 'bg-status-finished/20 text-status-finished border-status-finished/30';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export function getScoreColor(score: number | null): string {
  return 'text-accent-forest';
}

const COLOR_PALETTES = [
  { name: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { name: 'purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { name: 'green', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  { name: 'orange', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  { name: 'pink', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  { name: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { name: 'teal', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { name: 'rose', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { name: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { name: 'cyan', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  { name: 'violet', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  { name: 'fuchsia', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
];

const DIMENSION_LABELS: Record<string, string> = {
  core_competencies: 'Core Competencies',
  experience: 'Experience',
  soft_skills: 'Soft Skills',
  domain_knowledge: 'Domain Knowledge',
  cultural_fit: 'Cultural Fit',
  uncategorized: 'Uncategorized',
};

function getHashIndex(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % max;
}

export function getDimensionLabel(dimension: string): string {
  if (DIMENSION_LABELS[dimension]) {
    return DIMENSION_LABELS[dimension];
  }
  return dimension
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getDimensionColors(dimensionId: number | undefined | null) {
  const safeId = dimensionId ?? 0;
  return COLOR_PALETTES[safeId % COLOR_PALETTES.length];
}

/**
 * Deterministically calculates a stable color index based on a dimension's absolute order
 * in the dynamic dimensions list.
 * Enforces UI consistency so dimensions maintain their colors regardless of localized UI filtering.
 * @param {Dimension[]} dimensions - The full array of dynamic dimensions.
 * @param {string | undefined | null} dimensionName - The name of the dimension to look up.
 * @returns {number} The absolute index of the dimension, falling back to a safe default.
 */
export function getDynamicDimensionIndex(dimensions: Dimension[], dimensionName: string | undefined | null): number {
  if (!dimensionName || !dimensions || dimensions.length === 0) return 5;
  const index = dimensions.findIndex(d => d.name === dimensionName);
  return index !== -1 ? index : dimensions.length;
}

/**
 * Generates a nuanced display name for an entity based on its blueprint.
 * Uses the top 2 required metadata fields defined in the blueprint.
 * Falls back to the entity.name if no fields are found or metadata is missing.
 * 
 * @param entity - The entity object
 * @param blueprints - Array of blueprints to search for matching blueprint
 */
export function getNuancedEntityName(entity: Partial<Entity>, blueprints: Blueprint[]): string {
  const blueprint = blueprints.find(b => b.id === entity.blueprint_id);
  if (!blueprint || !blueprint.fields || blueprint.fields.length === 0) {
    return entity.name || '';
  }

  const requiredFields = blueprint.fields
    .filter((f) => f.is_required && f.entity_role === entity.type)
    .slice(0, 2);

  if (requiredFields.length === 0) return entity.name || '';

  const parts = requiredFields.map((f) => {
    const val = entity.metadata?.[f.field_name];
    return val && val !== 'Unknown' && val !== 'Please wait...' ? String(val) : null;
  }).filter(Boolean);

  return parts.length > 0 ? parts.join(' - ') : (entity.name || '');
}

/**
 * Parses a flat EntityMatch object to extract requirement and offering entity objects.
 * 
 * @description
 * This function centralizes data transformation logic to prevent DRY (Don't Repeat Yourself) violations.
 * Previously, the logic for extracting reqEntity and offEntity from the flat match object was duplicated
 * across multiple UI components (MatchCard, MatchDetailModal, etc.). This function:
 * - Extracts name, type, metadata, and blueprint_id for both requirement and offering entities
 * - Safely parses requirement_metadata and offering_metadata, handling both string (JSON) and object formats
 * - Returns structured entity objects compatible with getNuancedEntityName and other utilities
 * 
 * @param match - The flat EntityMatch object from the API
 * @returns Object containing { reqEntity, offEntity } with properly typed entity structures
 * 
 * @architectural_notes
 * - DRY violation: Previously duplicated in MatchCard.tsx and MatchDetailModal.tsx
 * - SoC: Data transformation logic separated from presentation components
 * - Single source of truth for match entity parsing
 * 
 * @example
 * const { reqEntity, offEntity } = parseMatchEntities(match);
 * const displayName = getNuancedEntityName(reqEntity, blueprints);
 */
/**
 * Formats a float value into a rounded percentage string.
 * Ensures consistent presentation of percentages across the UI (Separation of Concerns).
 * 
 * @param {number | null | undefined} value - The float value to format (e.g., 0.442223).
 * @returns {string} The formatted percentage string without decimals (e.g., "44%"). Returns "0%" if invalid.
 * 
 * @example
 * formatPercentage(0.5) // returns "50%"
 * formatPercentage(0.442223) // returns "44%"
 * formatPercentage(null) // returns "0%"
 */
export function formatPercentage(value: number | null | undefined): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

export function parseMatchEntities(match: EntityMatch): { reqEntity: Partial<Entity>; offEntity: Partial<Entity> } {
  const reqEntity: Partial<Entity> = {
    name: match.requirement_name || '',
    type: 'requirement' as EntityType,
    metadata: typeof match.requirement_metadata === 'string' 
      ? JSON.parse(match.requirement_metadata) 
      : (match.requirement_metadata || {}),
    blueprint_id: match.requirement_blueprint_id ?? null
  };

  const offEntity: Partial<Entity> = {
    name: match.offering_name || '',
    type: 'offering' as EntityType,
    metadata: typeof match.offering_metadata === 'string' 
      ? JSON.parse(match.offering_metadata) 
      : (match.offering_metadata || {}),
    blueprint_id: match.offering_blueprint_id ?? null
  };

  return { reqEntity, offEntity };
}


