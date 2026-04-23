# Frontend Architecture & Refactoring Guidelines

**CRITICAL DIRECTIVE FOR AI AGENTS & DEVELOPERS:** This document defines the strict architectural laws for the Compari frontend. You MUST adhere to these rules implicitly. Any refactoring, feature addition, or bug fix MUST comply with these boundaries. Ignorance of these rules is not an excuse.

---

## 1. Single Source of Truth (SSoT) for Types & Constants

**THE LAW:** No magic strings, magic numbers, or inline type unions are allowed in API clients, components, or hooks.

* **Centralized Constants (`src/lib/constants.ts`):** All application-wide settings, statuses, roles, and event names MUST be defined here. 
* **Centralized Types (`src/lib/types.ts`):** All domain interfaces (e.g., `Entity`, `Match`, `Blueprint`) MUST be defined here.
* **Zero Inline Unions:** API interfaces (e.g., `CreateBlueprintData`) MUST import types like `FieldType` or `EntityType` from `types.ts` rather than hardcoding `'string' | 'number'` or `'requirement' | 'offering'`.
* **Strict Local Types (No Reflexive Exporting):** Interfaces and types utilized solely within their defining file (e.g., specific Component `Props`, Hook `Return` types, or local state interfaces) ❌ MUST NOT be exported. ✅ MUST be kept strictly local. You may only export a type or interface if it is actively imported by another module. This minimizes the public API surface area of modules and ensures compliance with static analysis tools like Knip.

## 2. Strict Separation of Concerns (SoC)

**THE LAW:** The codebase is divided into three strict layers. Leaking responsibilities across these boundaries is strictly forbidden.

### A. Pages (`src/app/`)
* **Role:** UI Orchestrators and Layout Boundaries.
* **Rules:** * Pages MUST be as thin as possible. 
  * ❌ MUST NOT contain direct `fetch` calls.
  * ❌ MUST NOT contain complex `useEffect` blocks for data synchronization, SSE setup, or deep-linking logic.
  * ✅ MUST delegate all state and data fetching to Custom Hooks.

### B. Smart Hooks (`src/hooks/`)
* **Role:** State Management, API Orchestration, and Side-Effects.
* **Rules:**
  * ALL API communication, SSE listeners, polling mechanisms, and URL parameter syncing MUST live here.
  * If a hook becomes too large, break it down into smaller, composable hooks (e.g., `useEntityData` wraps `useSafeFetch`).

### C. Dumb Components (`src/components/`)
* **Role:** Pure Presentation.
* **Rules:**
  * ❌ MUST NOT fetch data directly.
  * ❌ MUST NOT manage global state.
  * ❌ MUST NOT manage their own API loading states or toast orchestrations.
  * ✅ MUST receive data via props and communicate actions back via callback functions (`onSave`, `onDelete`, etc.).

## 3. The "DRY Hook" Rule

**THE LAW:** Do Not Repeat Yourself. Write Everything Once.

* If business logic, API orchestration, state synchronization, or lifecycle effects (like deep-link fetching) are repeated across **more than two files**, they MUST be extracted into a unified custom hook.
* *Example Violation:* `src/app/page.tsx`, `src/app/offerings/page.tsx`, and `src/app/matches/page.tsx` repeating the exact same `useEffect` logic for resolving deep-linked entities. This MUST be refactored into a `useDeepLinkedResource` hook.
* Duplicated `try/catch` blocks wrapping API calls + `addToast` notifications across multiple components/hooks are a DRY violation and MUST be extracted into a Smart Hook.

## 4. Mandatory AI-Contextual JSDoc

**THE LAW:** All hooks, complex components, and utility functions MUST have extensive JSDoc comments to preserve architectural context for future AI agents.

Every JSDoc block MUST include:
* `@description`: What the code does.
* `@responsibility`: Its exact role in the architecture.
* `@boundary_rules`: Explicit instructions on what the code is NOT allowed to do.

**Example:**
```typescript
/**
 * @description Custom hook for managing unified entities.
 * @responsibility Fetches, creates, and deletes entities. Manages loading/error states via useSafeFetch.
 * @boundary_rules
 * - ❌ MUST NOT contain UI components.
 * - ❌ MUST NOT directly access database.
 */
```

## 5. Core DRY Patterns & Lifecycles

**THE LAW:** Strict enforcement of DRY patterns for entity management and hook lifecycles.

### A. Unified Dashboards (CTI Entity Standard)

* **Rule:** `Requirements` and `Offerings` (and any future mirrored CTI entities) **MUST** use the shared `EntityDashboard` component.
* **Enforcement:** Developers and AI agents **MUST NOT** create distinct page layouts, custom dashboard wrappers, or unique routing structures for structurally identical entities.
* **Rationale:** CTI entities share identical data shapes, lifecycle states, and interaction patterns. Distinct layouts introduce maintenance duplication and violate the DRY principle.
* **Violation Example:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN - Creating custom page layout for a CTI entity
  export default function RequirementsPage() {
    return (
      <div className="custom-requirement-layout">
        <RequirementHeader />
        <RequirementList />
      </div>
    );
  }
  ```
* **Correct Implementation:**
  ```typescript
  // ✅ MANDATORY - Use the unified EntityDashboard
  import EntityDashboard from '@/components/EntityDashboard';

  export default function RequirementsPage() {
    return <EntityDashboard entityType="requirement" />;
  }
  ```

### B. Unified File Hooks & Standardized Modals

**THE LAW:** All entity file management must follow the unified hooks pattern to ensure consistency across all entity types.

* **Unified File Hooks:** All entity file operations **MUST** use the unified file hook pattern (`useCriteriaFiles`, `useEntityFiles`) located in `@/hooks/useEntityData`.
  * **Rule:** Developers and AI agents **MUST NOT** create entity-specific file fetching hooks. Use the shared hooks for all entities.
  * **Rationale:** Centralizing file operations ensures consistent behavior, reduces code duplication, and prevents path resolution bugs.

* **Standardized Modals:** All entity detail modals (`EntityDetailModal`, `MatchDetailModal`, `CriterionDetailModal`) **MUST** use the shared `FilesTabContent` component.
  * **Rule:** Modals MUST pass file data exclusively from the unified hooks, **NEVER** relying on associated target/source entities for folder paths.
  * **Violation Example:**
    ```typescript
    // ❌ STRICTLY FORBIDDEN - Deriving folder paths from associated entities
    const folderPath = entity.type === 'requirement'
      ? associatedTarget?.folderPath
      : associatedSource?.folderPath;
    ```
  * **Correct Implementation:**
    ```typescript
    // ✅ MANDATORY - Use unified hook for file data
    const { files, getFile, openFolder } = useEntityFiles(entityId, entity.folderPath);
    ```

### C. Hook Lifecycle Management

* **Rule:** Individual entity hooks (e.g., `useEntities`, `useMatches`) **MUST NOT** manually orchestrate `useSafeFetch`, `useSSE`, and `useProcessingWatchdog`.
* **Enforcement:** All entity collection hooks **MUST** use the generic `useManagedCollection` hook to handle the HTTP, real-time update, and background polling triad.
* **Rationale:** Manually composing these three hooks in every entity hook leads to duplicated lifecycle logic, inconsistent SSE event handling, and race conditions in polling state management.
* **Violation Example:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN - Manual hook composition
  export function useRequirements() {
    const { data, loading, error } = useSafeFetch(api.getRequirements);
    const { events } = useSSE('/api/events');
    const { isProcessing } = useProcessingWatchdog(data);
    // ... manual state merging
  }
  ```
* **Correct Implementation:**
  ```typescript
  // ✅ MANDATORY - Use the unified hook
  export function useRequirements() {
    return useManagedCollection({
      entityType: 'requirement',
      fetchFn: api.getRequirements,
      sseChannel: 'requirements',
    });
  }
  ```

---

## 6. Standardized Data Fetching & Race Conditions

**THE LAW:** All API data fetching (GET requests) that feeds UI state MUST be wrapped in the `useSafeFetch` hook.

* **MANDATORY ENFORCEMENT:** Components and standard hooks are strictly forbidden from managing their own `loading` or `error` state for HTTP requests.
* **Rationale:** Manual loading/error state management leads to race conditions, duplicate loading spinners across the app, and inconsistent error handling.
* **Correct Pattern:**
  ```typescript
  const { data, loading, error, execute } = useSafeFetch<Entity[]>(() => api.getEntities());
  ```
* **Violation Example:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN - This creates inconsistent loading states
  const [data, setData] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    api.getEntities().then(setData).finally(() => setLoading(false));
  }, []);
  ```

## 6. Mutation & UI Feedback Separation

**THE LAW:** UI components MUST NOT manually await API mutations (POST/PUT/DELETE) and subsequently fire `addToast` notifications.

* **Rationale:** Scattering mutation + toast logic across dozens of UI components violates DRY, makes toast styling inconsistent, and creates maintenance nightmares.
* **Correct Pattern:** All mutation orchestration that requires toast feedback MUST be abstracted into a Smart Hook (e.g., `useEntityOperations`, `useSettings`). The UI component should only call the hook's execution function and provide an `onSuccess` callback.
* **Correct Implementation:**
  ```typescript
  // Dumb Component - delegates orchestration
  <EntityForm onSubmit={handleSubmit} />
  
  // Smart Hook - handles mutation + toast
  const { createEntity } = useEntityOperations({ onSuccess: () => addToast(...) });
  const handleSubmit = (data) => createEntity(data);
  ```
* **Violation Example:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN - Mutation + Toast scattered in UI
  const handleSave = async () => {
    await api.updateEntity(id, data);
    addToast('Entity updated', 'success');
  };
  ```

## 7. Dynamic UI Terminology

**THE LAW:** You MUST NOT hardcode entity labels (e.g., "Requirement", "Offering") or use inline fallback chains (e.g., `activeBlueprint?.requirementLabelSingular || 'Requirement'`) in UI components.

* **Rationale:** Hardcoded labels create scattered terminology that breaks when entity names change. Inline fallback chains are a code smell that leads to inconsistent text across the app.
* **Correct Pattern:** All dynamic text resolution MUST be routed through the `useTerminology` hook's `activeLabels` or `getEntityLabels` SSoT functions.
* **Correct Implementation:**
  ```typescript
  const { activeLabels } = useTerminology();
  return <div>{activeLabels.requirementLabelSingular}</div>;
  ```
* **Violation Example:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN - Scattered hardcoded fallbacks
  const label = activeBlueprint?.requirementLabelSingular || 'Requirement';
  // or
  const label = entityType === 'requirement' ? 'Requirement' : 'Offering';
  ```

## 8. Strict UI Component Primitives (The "No Raw Tailwind" Rule)

**THE LAW:** Developers and AI agents MUST NOT build standard UI elements from scratch using raw Tailwind CSS utility classes if a primitive exists in `src/components/ui/`.

* **Rationale:** Copy-pasting Tailwind strings (e.g., `<div className="flex justify-end gap-3 pt-4 border-t...">` for a modal footer, or declaring `const inputClass = "..."` at the top of a file) destroys global design consistency and causes massive DRY violations.
* **Correct Pattern:** All basic UI elements—Buttons, Form Inputs, Labels, Selects, Toggles, Badges, and Modal Footers—MUST be imported from `@/components/ui`.
* **Violation Example:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN - The "Const Class Anti-Pattern"
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  
  function MyForm() {
    return <input className={inputClass} />;
  }
  
  // ❌ STRICTLY FORBIDDEN - Raw Tailwind Modal Footer
  function ModalFooter() {
    return (
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
        <button className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">Confirm</button>
      </div>
    );
  }
  ```
* **Correct Implementation:**
  ```typescript
  // ✅ MANDATORY - Import and use UI primitives
  import { FormInput, Button, ModalFooter } from '@/components/ui';
  
  function MyForm() {
    return <FormInput name="email" label="Email Address" />;
  }
  
  function MyModal() {
    return (
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>Confirm</Button>
      </ModalFooter>
    );
  }
  ```

## 9. Tailwind CSS v4 Architecture

**THE LAW:** The frontend uses the Tailwind CSS v4 (Oxide engine). All JavaScript-based styling configuration is strictly outlawed. The styling architecture is CSS-first.

* **Configuration SSoT (`src/app/globals.css`):** All theme extensions, custom colors, fonts, and base layer overrides MUST be defined using the `@theme` directive and native CSS variables inside `globals.css`.
* **The Config Ban:** * ❌ STRICTLY FORBIDDEN: Developers and AI agents MUST NOT create or use a `tailwind.config.js` or `tailwind.config.ts` file under any circumstances.
  * ❌ STRICTLY FORBIDDEN: Do not use old v3 directives like `@tailwind base;`. Use `@import "tailwindcss";` exclusively.
* **PostCSS Requirement:** The project processes styles via `@tailwindcss/postcss`. 
  * ✅ MANDATORY: If modifying build tools, ensure `postcss.config.js` maintains `@tailwindcss/postcss` and NEVER the legacy `tailwindcss` plugin.

---

## 10. Shared Entity Operations (DRY Principle)

**THE LAW:** Because Matches, Offerings, Requirements, and Criteria share a common `BaseEntity` lineage on the backend, their frontend data operations MUST be centralized to eliminate WET (Write Everything Twice) code.

### A. Base Hook Composition

* **Rule:** Operations common to ALL entity types—`delete`, `writeMasterFile`, `fetchMasterFile`, `retry`, and `openFolder`—MUST be implemented exclusively in `useBaseEntityOperations`.
* **Enforcement:** The `useBaseEntityOperations` hook (`src/hooks/useBaseEntityOperations.ts`) serves as the single source of truth for these shared operations. It accepts an API client and entity label to dynamically generate toast messages.
* **Rationale:** Duplicating these operations across `useMatchOperations`, `useEntityOperations`, and `useCriterionOperations` creates maintenance nightmares and inconsistent behavior.

### B. Specific Hooks Inherit from Base

* **Rule:** Entity-specific hooks (`useMatchOperations`, `useEntityOperations`, `useCriterionOperations`) MUST compose/inherit from `useBaseEntityOperations` rather than re-implementing common operations.
* **Correct Pattern:**
  ```typescript
  // ✅ MANDATORY - Compose from base hook
  import { useBaseEntityOperations } from './useBaseEntityOperations';
  import { matchApi } from '@/lib/api/matchApi';

  export function useMatchOperations() {
    const baseOps = useBaseEntityOperations({
      apiClient: matchApi,
      entityLabel: 'Match'
    });

    return {
      deleteWithToast: baseOps.deleteWithToast,
      writeMasterFileWithToast: baseOps.writeMasterFileWithToast,
      fetchMasterFileWithToast: baseOps.fetchMasterFileWithToast,
      // ... entity-specific operations only
    };
  }
  ```
* **Violation Example:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN - Duplicating base operations
  const deleteWithToast = useCallback(async (id, onSuccess) => {
    await matchApi.deleteMatch(id);
    addToast(TOAST_TYPES.SUCCESS, 'Match deleted');
    onSuccess();
  }, []);
  ```

### C. Toast Notifications: Exclusive Hook Responsibility

* **Rule:** UI Toast feedback for data operations MUST be handled EXCLUSIVELY inside the operations hooks (`useBaseEntityOperations` or specific hooks). UI components (Modals, Buttons, Pages) and raw API clients MUST NOT fire toasts.
* **Rationale:** Scattering `addToast` calls in UI components causes double-toast bugs, inconsistent styling, and DRY violations.
* **Correct Pattern:**
  ```typescript
  // ✅ MANDATORY - Toast handled in hook only
  const writeMasterFileWithToast = useCallback(
    async (id: number, onSuccess: () => void) => {
      await api.writeMasterFile(id);
      addToast(TOAST_TYPES.SUCCESS, 'Master file written'); // Single toast
      onSuccess();
    },
    [addToast]
  );
  ```
* **Violation Example:**
  ```typescript
  // ❌ STRICTLY FORBIDDEN - Toast in UI component
  const handleWrite = async () => {
    await writeMasterFileWithToast(id, () => {});
    addToast('Success', 'extra toast'); // Double-toast bug!
  };
  ```

### D. Hook File Structure

* **`useBaseEntityOperations.ts`:** Shared operations for all entity types. Returns `deleteWithToast`, `retryWithToast`, `writeMasterFileWithToast`, `fetchMasterFileWithToast`, `openFolderWithToast`.
* **`useEntityOperations.ts`:** Inherits base operations. Adds entity-specific `bulkCreateFromFiles`, `updateWithToast`.
* **`useMatchOperations.ts`:** Inherits base operations. Adds match-specific `downloadPdfWithToast`.
* **`useCriterionOperations.ts`:** Inherits base operations. No additional operations required.