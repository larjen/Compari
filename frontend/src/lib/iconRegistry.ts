/**
 * @fileoverview Centralized Icon Registry for Domain Concepts and Functional Actions.
 * @description Single source of truth for all icons in the application.
 * Use this registry to ensure visual consistency across cards, modals, settings, and buttons.
 * All icons are mapped to semantic domain concepts allowing for global icon swaps.
 * 
 * Generic Keys (_GENERIC):
 * These keys are intended for use in high-level UI components like page headers
 * or generic dashboard cards that are not bound to a specific entity instance.
 * These follow a strict compliance rule for global UI consistency.
 * 
 * @usage
 * import { DOMAIN_ICONS } from '@/lib/iconRegistry';
 * <DOMAIN_ICONS.REQUIREMENT className="w-4 h-4" />
 * 
 * @domain_concepts
 * - REQUIREMENT: Target icon for requirement entities
 * - OFFERING: BowArrow icon for offering entities
 * - MATCH: Trophy icon for match results
 * - CRITERIA: ArrowFromBow icon for criteria items
 * - BLUEPRINT: Layout icon for blueprint configuration
 * - DIMENSION: Blocks icon for dimensions
 * - PROMPT: MessageSquareText icon for prompts
 * - TASK_ROUTING: Waypoints icon for task routing
 * - AI_MODEL: Sparkles icon for AI model settings
 * - SETTINGS: Settings icon for settings pages
 * 
 * @functional_icons
 * - INFO: Info icon
 * - FILES: Files icon
 * - FOLDER: Folder icon
 * - FILE: FileText icon
 * - VECTOR: GitMerge icon
 * - EXTRACTION: Zap icon
 * - PROCESSING: Cpu icon
 * - SEARCH: Search icon
 * - FILTER: Filter icon
 * - EDIT: Pencil icon
 * - VIEW: Eye icon
 * - DOWNLOAD: Download icon
 * - DELETE: Trash2 icon
 * - ADD: Plus icon
 * - ERROR: AlertCircle icon
 * - CLOSE: X icon
 * - SUCCESS: CheckCircle icon
 * - CHECK: Check icon
 * - LOADING: Loader2 icon
 * - REFRESH: RefreshCw icon
 * - SAVE: Save icon
 * - UPLOAD: Upload icon
 * - EXTERNAL: ExternalLink icon
 * - MERGE: Merge icon
 * - PREV: ChevronLeft icon
 * - NEXT: ChevronRight icon
 * - SPARKLES: Sparkles icon
 * - TREE: ListTree icon
 * - HISTORY: History icon
 * - MESSAGE_TEXT: MessageSquareText icon
 * - DATABASE: Database icon
 * - BRANCH: GitBranch icon
 * - INDENT: CornerDownRight icon
 * - CLOCK: Clock icon
 */
import {
  Target,             // REQUIREMENT
  BowArrow,           // OFFERING
  Trophy,             // MATCH
  Layout,             // BLUEPRINT
  Blocks,             // DIMENSION
  MessageSquareText,  // PROMPT
  Waypoints,          // TASK_ROUTING
  Sparkles,           // AI_MODEL
  Settings,           // SETTINGS
  Info,               // INFO
  Files,              // FILES
  Folder,             // FOLDER
  FileText,           // FILE
  GitMerge,           // VECTOR
  Zap,                // EXTRACTION
  Cpu,                // PROCESSING
  Search,             // SEARCH
  Filter,             // FILTER
  Pencil,             // EDIT
  Eye,                // VIEW
  Download,           // DOWNLOAD
  Trash2,             // DELETE
  Plus,               // ADD
  AlertCircle,        // ERROR
  X,                  // CLOSE
  CheckCircle,        // SUCCESS
  Check,              // CHECK
  Loader2,            // LOADING
  RefreshCw,          // REFRESH
  Save,               // SAVE
  Upload,             // UPLOAD
  ExternalLink,       // EXTERNAL
  Merge,              // MERGE
  ChevronLeft,        // PREV
  ChevronRight,       // NEXT
  ListTree,           // TREE
  History,            // HISTORY
  Database,           // DATABASE
  GitBranch,          // BRANCH
  CornerDownRight,    // INDENT
  Clock,              // CLOCK
  ChevronsUpDown,     // COMBOBOX
  Plug,              // CONNECTION
  LucideIcon,
  createLucideIcon,
} from 'lucide-react';

const ArrowFromBow = createLucideIcon("ArrowFromBow", [
  [
    "path",
    {
      "d": "M17 3h4v4",
      "key": "19p9u1"
    }
  ],
  [
    "path",
    {
      "d": "M7 14a1.7 1.7 0 0 0-1.207.5l-2.646 2.646A.5.5 0 0 0 3.5 18H5a1 1 0 0 1 1 1v1.5a.5.5 0 0 0 .854.354L9.5 18.207A1.7 1.7 0 0 0 10 17v-2a1 1 0 0 0-1-1z",
      "key": "8v3fy2"
    }
  ],
  [
    "path",
    {
      "d": "M9.707 14.293 21 3",
      "key": "ydm3bn"
    }
  ]
]);

const BowBow = createLucideIcon("BowBow", [
  [
    "path",
    {
      "d": "M17 3h4v4",
      "key": "19p9u1"
    }
  ],
  [
    "path",
    {
      "d": "M18.575 11.082a13 13 0 0 1 1.048 9.027 1.17 1.17 0 0 1-1.914.597L14 17",
      "key": "12t3w9"
    }
  ],
  [
    "path",
    {
      "d": "M7 10 3.29 6.29a1.17 1.17 0 0 1 .6-1.91 13 13 0 0 1 9.03 1.05",
      "key": "ogng5l"
    }
  ],
  [
    "path",
    {
      "d": "M7 14a1.7 1.7 0 0 0-1.207.5l-2.646 2.646A.5.5 0 0 0 3.5 18H5a1 1 0 0 1 1 1v1.5a.5.5 0 0 0 .854.354L9.5 18.207A1.7 1.7 0 0 0 10 17v-2a1 1 0 0 0-1-1z",
      "key": "8v3fy2"
    }
  ],
  [
    "path",
    {
      "d": "M9.707 14.293 21 3",
      "key": "ydm3bn"
    }]
]);

export const DOMAIN_ICONS: Record<string, LucideIcon> = {
  REQUIREMENT: Target,
  OFFERING: BowBow,
  MATCH: Trophy,
  CRITERIA: ArrowFromBow,
  BLUEPRINT: Layout,
  DIMENSION: Blocks,
  PROMPT: MessageSquareText,
  TASK_ROUTING: Waypoints,
  AI_MODEL: Sparkles,
  SETTINGS: Settings,
  INFO: Info,
  FILES: Files,
  FOLDER: Folder,
  FILE: FileText,
  VECTOR: GitMerge,
  EXTRACTION: Zap,
  PROCESSING: Cpu,
  SEARCH: Search,
  FILTER: Filter,
  EDIT: Pencil,
  VIEW: Eye,
  DOWNLOAD: Download,
  DELETE: Trash2,
  ADD: Plus,
  ERROR: AlertCircle,
  CLOSE: X,
  SUCCESS: CheckCircle,
  CHECK: Check,
  LOADING: Loader2,
  REFRESH: RefreshCw,
  SAVE: Save,
  UPLOAD: Upload,
  EXTERNAL: ExternalLink,
  MERGE: Merge,
  PREV: ChevronLeft,
  NEXT: ChevronRight,
  TREE: ListTree,
  HISTORY: History,
  DATABASE: Database,
  BRANCH: GitBranch,
  INDENT: CornerDownRight,
  CLOCK: Clock,
  COMBOBOX: ChevronsUpDown,
  CONNECTION: Plug,
} as const;

export type DomainIconKey = keyof typeof DOMAIN_ICONS;