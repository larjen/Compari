# COMPARI BACKEND: ARCHITECTURE & CODING STANDARDS RULEBOOK

> **CLASS TABLE INHERITANCE (CTI) ARCHITECTURE**
> The Data Access Layer strictly uses the Class Table Inheritance (CTI) pattern for domain entities.
> - `Offering`, `Requirement`, `Match`, and `Criterion` are first-class citizens.
> - All entities inherit shared lifecycle traits from a single `entities_base` table.
> - Specialized data resides in `entities_offering`, `entities_requirement`, `entities_match`, and `entities_criterion`.
> - You MUST utilize `JOIN`s for read operations and `this.db.transaction()` for write operations to maintain referential integrity across base and child tables.

**ATTENTION AI CODING AGENT:** You are operating in a strictly layered backend architecture. You MUST read, understand, and comply with every rule in this document. Do NOT hallucinate architectural patterns. Do NOT mix concerns. Violating these boundaries will break the application.

## 1. CORE ARCHITECTURAL LAYERS & STRICT BOUNDARIES

### A. Routes (`/src/routes`)
* **Responsibility:** Map HTTP methods and paths to Controller methods. Apply middleware (e.g., validation, uploads).
* **STRICT BOUNDARY:** ❌ MUST NOT require() Controller classes directly. ✅ MUST destructure instantiated controllers from the DI container (e.g., `const { myController } = require('../config/container').getContainer();`).
* **STRICT BOUNDARY:** ❌ MUST NOT contain request handler logic. ❌ MUST NOT contain business logic.

### B. Controllers (`/src/controllers`)
* **Responsibility:** Purely handle HTTP transport. Extract parameters/body, call Services, and format JSON responses.
* **STRICT BOUNDARY:** ❌ MUST NOT contain business logic. ❌ MUST NOT interact directly with Repositories. ❌ MUST NOT handle raw file system operations.
* **Rule:** ALL methods MUST be wrapped in `asyncHandler`.
* **Rule:** ALL errors MUST be passed to centralized handling via `throw new AppError(...)` or `next(error)`. Do NOT use `res.status(500).json(...)` manually.
* **Rule:** ALL data access MUST route through a Service layer. 
* **STRICT BOUNDARY (No Over-Abstraction):** ❌ MUST NOT use base classes or OOP inheritance for Controllers (e.g., no `BaseController`). ✅ MUST flatten controllers and implement routes explicitly using `asyncHandler`. HTTP transport logic should be readable top-to-bottom without digging through parent classes.

### C. Services (`/src/services`)
* **Responsibility:** Domain logic, cross-layer coordination, and infrastructure abstraction (e.g., File I/O, AI API calls).
* **STRICT BOUNDARY:** ❌ MUST NOT handle HTTP request/response (`req`/`res`) objects.
* **Rule:** Controllers call Services. Services call Repositories.
* **Rule (CTI State Machine):** All entity state transitions (status, error, isBusy) MUST route through the unified `BaseEntityService.updateState()` method. Do not manually update statuses in individual workflows.

### D. Workflows (`/src/workflows`)
* **Responsibility:** High-level orchestration of multi-step, cross-domain processes (e.g., `DocumentProcessorWorkflow`, `MatchAssessmentWorkflow`).
* **Rule:** Workflows coordinate multiple Services and Repositories but delegate atomic tasks to them.

### E. Repositories (`/src/repositories`)
* **Responsibility:** Pure Data Access Layer (DAL) using `better-sqlite3`. Executes SQL queries and maps rows to Domain Models.
* **STRICT BOUNDARY:** ❌ MUST NOT contain business rules or workflow logic. ❌ MUST NOT emit events (`EventService.emit`). ❌ MUST NOT interact with the file system or AI.
* **STRICT BOUNDARY:** ❌ MUST NOT hardcode the database connection via `require('./Database')`. ✅ MUST accept the `db` instance via Constructor Injection to allow for in-memory mocking during unit tests.
* **STRICT BOUNDARY (CTI Pattern):** Repositories managing base entities (Requirements, Offerings, Matches, Criteria) MUST hide the complexity of the Class Table Inheritance schema from the Service layer. Insert operations MUST use `this.db.transaction()` to write to both the base and child tables. Read operations MUST use `LEFT JOIN` or `JOIN` to map the split rows back into a single, unified Domain Model object.
* **Rule (CTI Repositories):** `EntityRepo`, `MatchRepo`, and `CriteriaRepo` MUST extend `BaseEntityRepo` to inherit DRY mutations and shared reads for `entities_base` (e.g., `updateStatus`, `updateMetadata`, `updateFolderPath`, `getDocuments`).
* **Rule (CTI Base Queries):** When background workers or system health checks need to query the state (e.g., `status`, `is_busy`) of entities across the system, they MUST query `entities_base` directly via `BaseEntityRepo`. ❌ MUST NOT query individual child repositories or perform JOINs if only base lifecycle data is required.

### F. Utils & Models (`/src/utils`, `/src/models`)
* **Responsibility:** Pure functions, math (`VectorMath`), prompt building, schema definition, and plain data structures.
* **Rule:** Models are pure OOP data objects. ❌ NO Active Record logic (no `this.save()`).
* **Rule (CTI Polymorphism):** Domain Models strictly follow CTI inheritance. `RequirementEntity`, `OfferingEntity`, `MatchEntity`, and `CriterionEntity` extend `BaseEntity`.
* **Rule:** You MUST use `EntityFactory.fromRow(row)` to instantiate the correct subclass based on the database `entity_type` column.
* **Rule:** Utilities must remain stateless. Any required services/repositories must be passed in as arguments.

---

## 2. STRICT DEPENDENCY INJECTION (DI) POLICY

We strictly enforce Constructor Injection to prevent circular dependencies, eliminate "lazy requires", and ensure high testability.

* **Rule:** Services, Workflows, AND Repositories ❌ MUST NOT directly `require()` their dependencies (including the `db` connection) at the top of the file.
* **Rule:** Dependencies MUST be injected directly into the `constructor({ depA, depB })`.
* **Rule:** The Database connection (`db`) MUST be injected into the `BaseRepository` and all child Repositories via their constructors from the Composition Root (`container.js`).
* **Rule:** If an object is instantiated, it is guaranteed to have its dependencies. Defensive getters (e.g., `get _repo()`) are STRICTLY FORBIDDEN.
* **Rule:** Services and Workflows MUST export their Class, NEVER an instantiated object (e.g., `module.exports = AiService;`).
* **Rule:** Controllers MUST import service instances from the DI Container, NOT by requiring the service file directly.
* **Rule:** Routes MUST import controller instances from the DI Container, NOT by requiring the controller class file directly.
* **Rule:** All DI wiring happens exactly once in `bootstrap()` (Phase 2.5).
* **Rule:** The Service Locator anti-pattern is STRICTLY FORBIDDEN. No file may import `container.js` to call `getContainer()` at the module level except for the absolute top-level entry points (e.g., `server.js` or Express route definitions).
* **Rule:** Infrastructure Services (e.g., `PdfGeneratorService`, `FileService`) and Event/Task Listeners MUST also follow strict dependency injection (via Constructor Injection or Parameter/Factory Injection).
* **Rule:** Never use hidden, hardcoded I/O requires (like `const fs = require('fs')`) inside service methods. All file system operations must be routed through the injected `FileService`.
* **Exception Rule (`TaskRegistry.js`):** Because `TaskRegistry` wires handlers to `QueueService`, it uses parameter injection via an exported function (`registerAllTasks({ queueService, ...workflows })`) rather than a class constructor, to eliminate circular dependencies.

---

## 3. STRICT LOGGING POLICY (`LogService.js`)

You MUST enforce Separation of Concerns (SoC) between terminal output and file persistence. Do not use raw `console.log` unless bypassing the logger is absolutely required. Use `logService`.

* **`logTerminal(status, symbolKey, origin, message, errorObj)`**
    * Use for developer feedback and debugging. Writes ONLY to stdout.
* **`logSystemFile(origin, message, details)`**
    * Use for workflow milestones and historical tracking. Writes to `system.jsonl`. (Disabled in production).
* **`logErrorFile(origin, message, errorObj, details)`**
    * Use for system faults and failures. Writes to `errors.jsonl`. This is the permanent audit trail.
* **Rule for Failures:** If an error occurs, you MUST call BOTH `logTerminal` (with 'ERROR') AND `logErrorFile`.

---

## 4. BACKGROUND JOBS & EVENT SYSTEM

* **Queueing (`QueueService.js` & `TaskRegistry.js`):** Background jobs (AI processing, PDF extraction) are handled via the `job_queue` table.
* **STRICT BOUNDARY:** `QueueService` handles queue lifecycle and native staggered retries. It MUST NOT contain domain logic. 
* **Task Execution:** `QueueService` executes tasks *directly* via the handlers mapped in `TaskRegistry.js`. This centralizes the retry loops and abort signals without relying on fragile event emissions.
* **Event Listeners (`TaskListeners.js`):** ❌ MUST NOT be used to execute queue tasks. ✅ MUST ONLY be used to listen for domain-agnostic infrastructure events (like `APP_EVENTS.TASK_FAILED`) to update domain entity statuses, thereby keeping the `QueueService` completely unaware of business domains.
* **Rule (Orphaned Task Sweeping):** Background sweepers recovering stuck entities MUST utilize the CTI pattern. They MUST fetch stuck records uniformly via `BaseEntityService.getStuckEntities()` rather than looping through individual domain services (e.g., avoiding `MatchService.getStuckMatches()`).
* **SSE Events (`EventService.js`):** Use `eventService.emit()` to push state changes to the frontend. Use the constants defined in `APP_EVENTS` (e.g., `APP_EVENTS.RESOURCE_STATE_CHANGED`). Do NOT use magic strings.

---

## 5. Atomized Document Processing Pipeline (Sequential Orchestration Pattern)

The document processing workflow utilizes a **Fully Atomized, Event-Driven Queue Pattern**. The document lifecycle is broken down into an 8-step process (1 synchronous API step + 7 asynchronous fault-tolerant background nodes).

This guarantees strict Separation of Concerns (SoC) and ensures that if an AI extraction step fails, the system only retries that specific node without re-running earlier, successful operations. The pipeline chains together via the `QueueService`.

**Clarification on "Event-Driven" Terminology:** The "Event-Driven" aspect primarily refers to the Server-Sent Events (SSE) updates pushed to the UI to provide real-time progress feedback. The backend logic itself is orchestrated sequentially to ensure data integrity and predictable failure handling.

### Sequential Execution via Master Orchestrator

* **Responsibility Rule:** Although the pipeline is logically broken into 8 "Atomized Steps," they are NOT executed as independent, decoupled events.
* **The Orchestrator:** The `DocumentProcessorWorkflow.processDocument` method acts as the **Master Orchestrator**. It is enqueued as a single `PROCESS_DOCUMENT` task.
* **Execution Contract:** The orchestrator enforces a synchronous-within-asynchronous pattern. It MUST `await` each step in order (Parse → Verbatim → Metadata → Criteria → Vectorize → Merge → Finalize).
* **Failure Handling:** Because execution is sequential, any uncaught exception in a sub-step automatically halts the orchestrator. This guarantees that the entity status is marked as `failed` immediately, and the pipeline does not attempt to proceed with missing or corrupt data.

### Pipeline Stages

1. **`INITIATE_DOCUMENT_UPLOAD` (Synchronous HTTP)**
   * **Responsibility:** Creates the temporary staging folder, moves the uploaded file, creates the database record, and queues the first background task.
   * **State Change:** Sets initial UI step to `Uploading to staging folder...` and core status strictly to `pending`. This represents the 'Queued' state where no active resources are yet consumed.
   * **Handoff:** Enqueues `PARSE_DOCUMENT_CONTENT`.

2. **`PARSE_DOCUMENT_CONTENT` (Queue Task)**
   * **Responsibility:** Extracts raw text from the physical PDF/Markdown file in the temporary staging folder, validates readability, and saves `raw-extraction.txt`.
   * **State Change:** Updates UI step to `Extracting Raw Text...`. Transitions core status from `pending` to `parsing_document`. **Responsibility Rule:** This node is the 'Worker Pick-up' point; it MUST transition the entity from an idle state to an active processing state the moment the task is claimed.
   * **Handoff:** Enqueues `EXTRACT_VERBATIM_TEXT`.

3. **`EXTRACT_VERBATIM_TEXT` (Queue Task)**
   * **Responsibility:** Reads `raw-extraction.txt`, invokes the AI model to generate a verbatim Markdown profile, and saves it as `entity-profile.md`.
   * **State Change:** Updates UI step to `Extracting Verbatim Text...`. Transitions core status to `extracting_metadata`.
   * **Handoff:** Enqueues `EXTRACT_ENTITY_METADATA`.

4. **`EXTRACT_ENTITY_METADATA` (Queue Task)**
   * **Responsibility:** Reads `raw-extraction.txt` and executes AI extraction for structured JSON metadata (mapped to Blueprint schemas). Updates the database with the injected `nice_name` and registers document records.
   * **State Change:** Updates UI step to `Extracting Profile & Metadata...`. Transitions core status to `extracting_criteria`.
   * **Handoff:** Enqueues `EXTRACT_ENTITY_CRITERIA`.

5. **`EXTRACT_ENTITY_CRITERIA` (Queue Task)**
   * **Responsibility:** Executes chunked, concurrent AI calls to extract criteria across active dimensions.
   * **State Change:** Updates UI step to `Extracting Criteria...`.
   * **Handoff:** Enqueues `VECTORIZE_ENTITY_CRITERIA`.

6. **`VECTORIZE_ENTITY_CRITERIA` (Queue Task)**
   * **Responsibility:** Generates vector embeddings for the extracted criteria to enable semantic matching.
   * **State Change:** Updates UI step to `Vectorizing Criteria...`.
   * **Handoff:** Enqueues `MERGE_ENTITY_CRITERIA`.

7. **`MERGE_ENTITY_CRITERIA` (Queue Task)**
   * **Responsibility:** Executes the auto-merge deduplication loop using cosine similarity to merge near-duplicate criteria.
   * **State Change:** Updates UI step to `Auto-merging Criteria...`. Transitions core status to `moving_to_vault`.
   * **Handoff:** Enqueues `FINALIZE_ENTITY_WORKSPACE` (if a new upload) or marks as `completed`.

8. **`FINALIZE_ENTITY_WORKSPACE` (Queue Task)**
   * **Responsibility:** Safely moves the entity's processing folder from the temporary staging directory to its permanent named location in the vault. Updates the database folder paths.
   * **State Change:** Updates UI step to `Finalizing...`. Transitions core status to `completed`.

### State Management & Granular Feedback

To provide a responsive user interface via Server-Sent Events (SSE) without cluttering the core background-worker state machine, the system tracks state at two levels:

* **Core Status (`ENTITY_STATUS` / match `status`):** Tracks the background worker's macro-position in the pipeline (e.g., `pending`, `extracting_metadata`, `completed`). This is the single source of truth for worker orchestration.
* **Granular Steps (`ENTITY_STATUS`):** Ephemeral, presentation-layer strings stored in the `metadata.status` column. These are updated rapidly during processing to provide real-time UI feedback and are cleared to `completed` once the pipeline completes.
  * `Uploading to staging folder...`
  * `Extracting Raw Text...`
  * `Extracting Verbatim Text...`
  * `Extracting Profile & Metadata...`
  * `Extracting Criteria...`
  * `Vectorizing Criteria...`
   * `Auto-merging Criteria...`
   * `Finalizing...`

### UI State Contract (Status Aggregation)

To ensure the frontend remains 'Busy' during the entire pipeline, the backend uses granular `ENTITY_STATUS` values (e.g., `parsing_document`, `extracting_metadata`).

**Contract Rule:** The frontend `useTaskLifecycle` hook MUST treat any status that is not `pending`, `completed`, or `failed` as an active `isProcessing` state. This prevents the UI from prematurely becoming interactive while background atomized tasks are still chaining.

---

## 6. MANDATORY CODING STANDARDS

1.  **JSDoc is Mandatory:** Every new class, method, and function MUST be documented. You MUST include `@responsibility`, `@boundary_rules`, `@socexplanation`, and `@dependency_injection` tags to explain *why* the code belongs in that specific layer.
    * **Static Analysis Compliance (Knip & DI):** Knip's static AST parser cannot trace our dynamic DI bindings. Therefore, any function or class exported strictly for dynamic Dependency Injection (e.g., dynamic seeders, utility engines) OR external test suites MUST fulfill a two-part contract to prevent false-positive "unused export" warnings:
        1. **Documentation:** The export MUST include the `/** @public */` JSDoc tag to explicitly inform humans and future AI agents that the export is consumed dynamically.
        2. **Configuration:** The file's path MUST be appended to the `"entry"` array for the `"backend"` workspace in the root `package.json`. This forces Knip to treat the file as a module graph entry point.
2.  **No Magic Strings:** Use the centralized definitions in `/src/config/constants.js` for HTTP Status codes, Event Names, Queue Statuses, and File Paths.
3.  **DRY Principle:** Before writing file manipulation logic, check `FileService.js`. Before writing AI prompting logic, check `PromptBuilder.js`. Do not reinvent existing wheels.
4.  **Error Handling:** Use `AppError` for known operational errors (e.g., `throw new AppError('Match not found', HTTP_STATUS.NOT_FOUND);`). Background job retries are handled natively by `QueueService.js`.

---

## 7. DATA TRANSFER OBJECT (DTO) PATTERN & ANTI-PARAMETER CREEP

* **Responsibility:** Encapsulate data payloads transferred between the Controller, Service, and Repository layers to prevent parameter list bloat (Parameter Creep) and stabilize function signatures.
* **Rule:** Any Service, Workflow, or Repository method that requires creating, updating, or passing data for an entity with more than 3 parameters MUST accept a single DTO (plain JavaScript object) rather than individual positional arguments.
* **STRICT BOUNDARY:** ❌ MUST NOT pass the raw Express `req.body` directly into a Service. ✅ MUST explicitly extract, validate, and construct the DTO in the Controller before passing it down. This ensures the Service layer remains completely agnostic of the HTTP transport layer.
* **Rule:** JSDoc comments for methods accepting DTOs MUST use `@param {Object} dtoName` and document the expected keys within the DTO.

**EXAMPLE (GOOD vs. BAD):**
* ❌ **BAD (Parameter Creep):** `async processEntity(id, name, type, metadata, folderPath, signal)`
* ✅ **GOOD (DTO Pattern):** `async processEntity(id, entityDto, signal)`

---

## 8. Controller Inheritance and DRY Standards

**THE LAW:** All standard HTTP controllers dealing with database entities **MUST** inherit from `BaseCrudController` to eliminate boilerplate duplication.

### A. BaseCrudController Mandate

* **Rule:** All entity controllers (e.g., `RequirementController`, `OfferingController`, `MatchController`) **MUST** extend `BaseCrudController`.
* **Responsibility:** The base class handles standard CRUD lifecycle:
  * Automatic `req.params.id` extraction and validation
  * `404 Not Found` throwing for basic entity existence checks
  * Standard `asyncHandler` wrapping for all HTTP methods
  * Unified error response formatting
* **Enforcement:** Controllers **MUST NOT** manually implement the above boilerplate patterns.

### B. Boilerplate Ban

* **Violations (STRICTLY FORBIDDEN):**
  * Manual `req.params.id` extraction: `const id = req.params.id;`
  * Manual `404` throwing for basic existence: `if (!entity) throw new AppError('Not found', 404);`
  * Redundant `asyncHandler` wrappers on standard CRUD methods
  * Copy-pasted validation logic across controllers
* **Correct Implementation:**
  ```typescript
  // ✅ MANDATORY - Extend BaseCrudController
  class RequirementController extends BaseCrudController {
    constructor(requirementService) {
      super(requirementService);
    }
    // Standard CRUD methods inherited automatically
  }
  ```

### C. Custom Overrides

* **Rule:** If a specific entity requires custom payload parsing (e.g., separating relations from DTOs), it **MUST** cleanly override the `create` or `update` methods of the base class while retaining standard functionality for the rest.
* **Pattern:**
  ```typescript
  // ✅ CORRECT - Clean override while retaining standard behavior
  class OfferingController extends BaseCrudController {
    async create(req, res, next) {
      const { relations, ...dto } = req.body;
      // Custom relation handling
      const entity = await this.service.createWithRelations(dto, relations);
      return res.status(201).json(entity);
    }
    // Other methods (get, list, update, delete) use inherited implementation
  }
  ```
* **Anti-Pattern:**
  ```typescript
  // ❌ FORBIDDEN - Full rewrite that loses base functionality
  class OfferingController {
    async create(req, res, next) { /* ... entire implementation ... */ }
    async get(req, res, next) { /* ... manual 404 logic ... */ }
    // This defeats the purpose of inheritance
  }
  ```
