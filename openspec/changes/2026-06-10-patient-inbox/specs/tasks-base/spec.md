## ADDED Requirements

### Requirement: Tasks are tenant-scoped attention items tied to a patient and a caregiver

The backend SHALL persist a `tasks` table where each row represents one attention item for a caregiver concerning a patient. `Task` SHALL inherit `TenantOwnedEntity` and `DeletableEntity`, so each row carries inherited columns plus task-specific columns:

- `patient_id` (UUID, NOT NULL, FK to `patients.id`, ON DELETE RESTRICT) — the patient the task is about.
- `assigned_user_id` (UUID, NULL, FK to `users.id`, ON DELETE RESTRICT) — the caregiver expected to act. NULL means unassigned.
- `pathway_block_instance_id` (UUID, NULL, NO FOREIGN KEY in v1 — reserved for the future pathway runtime; follow-up migration adds the `ON DELETE SET NULL` FK).
- `title` (varchar 255, NOT NULL).
- `description` (text, NULL).
- `kind` (enum `task_kind`, NOT NULL).
- `status` (enum `task_status`, NOT NULL, default `'open'`).
- `due_at` (timestamptz, NULL) — the attention deadline. NULL means no specific deadline.
- `priority` (enum `task_priority`, NOT NULL, default `'normal'`).

The referenced patient MUST belong to the same tenant as the task. The referenced assigned user (when not NULL) MUST belong to the same tenant. All non-id task queries SHALL be tenant-scoped through the inherited `tenant_id` filter.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `patients-base`)
- **THEN** a `tasks` table exists with the columns specified above plus inherited columns

#### Scenario: Cross-tenant patient rejected

- **WHEN** a write attempts to set `patient_id` to a patient row whose `tenant_id` differs from the task's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: Cross-tenant assigned user rejected

- **WHEN** a write attempts to set `assigned_user_id` to a user whose `tenant_id` differs from the task's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: Cross-tenant reads return 404

- **WHEN** a caregiver in tenant A issues `GET /tasks/{id}` for a task whose `tenant_id` is tenant B
- **THEN** the API MUST respond `404 Not Found`

#### Scenario: pathway_block_instance_id is unused by v1 writes

- **WHEN** any v1 write creates a task via the API
- **THEN** the request MUST NOT accept `pathway_block_instance_id` (column populated only by future pathway runtime); the column MUST default to `null` on every v1-created row

### Requirement: Task kind enum

The backend SHALL define a `TaskKind` enum at `app/core/enums/task.py` with values `review`, `follow_up`, `call`, `intake`, `signoff`, `other` (string-valued via `StrEnum`), persisted as Postgres enum type `task_kind`. v1 seeded fixtures SHALL exercise at least three kinds.

#### Scenario: Postgres enum type created by migration

- **WHEN** the migration runs on a fresh database
- **THEN** a Postgres enum type `task_kind` exists with exactly the values `('review', 'follow_up', 'call', 'intake', 'signoff', 'other')`

### Requirement: Task status enum

The backend SHALL define a `TaskStatus` enum at `app/core/enums/task.py` with values `open`, `in_progress`, `completed`, `cancelled` (string-valued via `StrEnum`), persisted as Postgres enum type `task_status`. Default on create is `open`. v1 ships read-only (no `PATCH /tasks/{id}` route) — status transitions are not exposed by any v1 endpoint.

#### Scenario: Default status on create is open

- **WHEN** a task is materialised by a seed script without an explicit `status`
- **THEN** the row's `status` MUST be persisted as `'open'`

### Requirement: Task priority enum

The backend SHALL define a `TaskPriority` enum at `app/core/enums/task.py` with values `low`, `normal`, `high`, `urgent` (string-valued via `StrEnum`), persisted as Postgres enum type `task_priority`. Default on create is `normal`.

#### Scenario: Default priority on create is normal

- **WHEN** a task is materialised without an explicit `priority`
- **THEN** the row's `priority` MUST be persisted as `'normal'`

### Requirement: Tasks API exposes read-only access for caregivers and admins

The backend SHALL expose under `/tasks` exactly these routes for v1: `GET /tasks` (list) and `GET /tasks/{id}` (read). NO create, update, or delete routes ship in v1 — tasks are populated by seeded fixtures (and, in the future, by the pathway runtime). Adding `POST` / `PATCH` / `DELETE` is a separate change.

All routes SHALL require `require_role(Role.ADMIN, Role.CAREGIVER)`. The `Role.PATIENT` user SHALL be rejected with `403 Forbidden`. All routes SHALL be tenant-scoped via the session actor's `tenant_id`. Cross-tenant reads SHALL return `404`, never `403`.

**Visibility within a tenant**:

- `admin` users SHALL see all non-soft-deleted tasks in their tenant.
- `caregiver` users SHALL see a task ONLY when they have access to its `patient_id` per `require_patient_access` (the existing care-team OR PractitionerRole-tree predicate). Assignment (`assigned_user_id`) does NOT factor into visibility — patient access alone gates it.

Every route handler SHALL carry an `# AUTH-HARDEN` source comment.

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated request calls any `/tasks` route
- **THEN** the API MUST respond `401 Unauthorized`

#### Scenario: Patient role rejected

- **WHEN** a `patient`-role user calls any `/tasks` route
- **THEN** the API MUST respond `403 Forbidden`

#### Scenario: Write routes are absent in v1

- **WHEN** the OpenAPI document for v1 is inspected
- **THEN** NO `POST /tasks`, `PATCH /tasks/{id}`, or `DELETE /tasks/{id}` route MUST be present; only `GET /tasks` and `GET /tasks/{id}` MUST be advertised

#### Scenario: Caregiver sees only tasks for accessible patients

- **WHEN** caregiver `C` has patient access to `P1` but not `P2`, and both patients have tasks
- **THEN** `GET /tasks` for `C` MUST include tasks for `P1` and MUST NOT include tasks for `P2`

#### Scenario: Caregiver sees unassigned tasks for accessible patients

- **WHEN** a task `T` has `assigned_user_id IS NULL` for patient `P`, and caregiver `C` has patient access to `P`
- **THEN** `GET /tasks` for `C` MUST include `T`

#### Scenario: Caregiver assignment does not grant access without patient access

- **WHEN** caregiver `C` is the `assigned_user_id` on task `T` for patient `P`, but `C` has lost patient access to `P`
- **THEN** `GET /tasks/{T.id}` for `C` MUST return `404`

#### Scenario: Admin sees all tasks in tenant

- **WHEN** an admin in tenant `T` calls `GET /tasks`
- **THEN** the response MUST include every non-soft-deleted task row whose `tenant_id == T`

### Requirement: Tasks list supports filter + sort dimensions

The `GET /tasks` route SHALL ride the shared `ListQuery` envelope and expose:

- Pagination via `page` (default 1) and `page_size` (default 25, max 100); response envelope is `Page[TaskRead]`.
- `filter[patient_id][eq]=<uuid>`.
- `filter[status][eq|in]=<status>`.
- `filter[kind][eq|in]=<kind>`.
- `filter[priority][eq|in]=<priority>`.
- `filter[assigned_user_id][eq]=<uuid>` — special value `me` resolves server-side to the caller's user id.
- `filter[due_at][gte]=<datetime>` and `filter[due_at][lte]=<datetime>`.
- `q=<value>` — case-insensitive substring on `title` via `searchable_fields`.
- `order_by` SHALL accept at minimum `due_at`, `created_at`, `priority`. Default is `due_at`. Default `order` is `asc`.

When `order_by=due_at`, rows with `due_at IS NULL` MUST be ordered last regardless of `order` direction (NULLS LAST).

Unknown `order_by` values MUST be rejected with `422`.

#### Scenario: Default sort puts soonest-deadline first

- **WHEN** `GET /tasks` is called with no `order_by` and no `order`
- **THEN** the items MUST be ordered by `due_at` ascending with `due_at IS NULL` rows trailing

#### Scenario: assigned_user_id `me` resolves to caller

- **WHEN** `GET /tasks?filter[assigned_user_id][eq]=me` is called by caregiver `C`
- **THEN** the response MUST include only tasks whose `assigned_user_id == C.id`

#### Scenario: Date-range filter on due_at

- **WHEN** `GET /tasks?filter[due_at][gte]=2026-06-10T00:00:00Z&filter[due_at][lte]=2026-06-20T23:59:59Z` is called
- **THEN** the response MUST contain only tasks whose `due_at` falls in that range

### Requirement: TaskRead embeds patient summary

`TaskRead` SHALL include an embedded `patient: PatientInlineSummary` field with shape `{ id, family_name, given_name, insz?: string | null, primary_organisation_id }`. The summary SHALL be projected via a join in the same query — the response SHALL NOT require the client to issue a follow-up `GET /patients/{id}` per row.

#### Scenario: TaskRead includes patient summary

- **WHEN** `GET /tasks/{id}` returns a successful response
- **THEN** the body MUST include `patient: { id, family_name, given_name, insz?, primary_organisation_id }`

#### Scenario: INSZ in patient summary is null when missing

- **WHEN** a task's patient has no INSZ identifier row
- **THEN** the embedded `patient.insz` MUST be `null`

### Requirement: Seed script generates synthetic tasks only

The backend SHALL provide `scripts/seed_tasks.py` that inserts a deterministic set of synthetic tasks against the seeded patient cohort. The script SHALL use a fixed PRNG seed for determinism. Each seeded patient SHALL receive between 0 and 3 tasks with varied `kind`, `status`, `priority`, and `due_at` values (mix of past-due, due-today, due-this-week, undated). The seed SHALL set `assigned_user_id` to the demo caregiver for ~60% of rows and leave the rest unassigned. The file SHALL carry a header comment stating `"SYNTHETIC ONLY — see openspec/project.md no-PHI invariant."`

#### Scenario: Re-running seed is idempotent

- **WHEN** `seed_tasks.py` is run twice against the same database
- **THEN** the second run MUST NOT create duplicate rows (idempotence enforced by a deterministic uniqueness key — implementer's choice)

#### Scenario: All seeded due_at values are timezone-aware

- **WHEN** the seed script runs
- **THEN** every inserted `due_at` value MUST be a `timestamptz` (UTC); past-due, due-today, and future-due variants MUST all be represented

### Requirement: HiX task adapter module reserves the MVP wiring point

The backend SHALL provide a module at `app/adapters/hix/tasks.py` exposing class `HixTaskAdapter` with methods `fetch(external_ref: str)` and `upsert_from_hix(payload)`. Both methods SHALL raise `NotImplementedError("HiX task adapter is MVP scope")` in PoC.

#### Scenario: Adapter module is importable

- **WHEN** `from app.adapters.hix.tasks import HixTaskAdapter` is executed
- **THEN** the import MUST succeed without side effects

#### Scenario: Adapter methods raise NotImplementedError

- **WHEN** `HixTaskAdapter().fetch("x")` or `HixTaskAdapter().upsert_from_hix({})` is called
- **THEN** the call MUST raise `NotImplementedError` with the message `"HiX task adapter is MVP scope"`

### Requirement: Orchestrator ships /_auth/inbox as the canonical caregiver attention surface

The orchestrator SHALL render at `/_auth/inbox` an `<InboxList>` showing one `<TaskInboxRow>` per task returned by `GET /tasks`. The route SHALL satisfy PoC feature `F4` (renamed in `scope.md`). The sidebar SHALL list a navigation item labelled `"Inbox"` pointing to this route. The existing placeholder `TasksPage` at `apps/orchestrator/src/modules/tasks/TasksPage.tsx` and its `/_auth/tasks` route SHALL be removed; the `tasksPort` adapter + placeholder data SHALL be deleted.

The list page SHALL use TanStack Query `useInfiniteQuery` keyed `[...tasksListKeyPrefix, { sort }]` with backend `page_size=25`. The page SHALL register a realtime invalidation topic seam (no-op v1; BL-076 follow-up wires the real topic).

`<TaskInboxRow>` composes the generic `<InboxRow>` primitive. Anatomy:

- **Subject avatar** (`<Avatar tintBy={task.patient.id}>`) — initials from `task.patient.family_name` + `task.patient.given_name`. Never an `<img>`.
- **Primary line**: `family, given`.
- **Secondary line** (muted): `INSZ • TaskKind label • due-time relative copy ("vandaag" / "morgen" / "over 3 dagen" / "verlopen 2 dagen" / "geen deadline")`.
- **Trailing**: priority chip (Badge variant per priority) + status chip (only shown when `status !== 'open'`).
- **Kebab** trailing (visible only when master is full / not-collapsed).

#### Scenario: Inbox renders one row per task

- **WHEN** a caregiver loads `/_auth/inbox` with at least one task returned
- **THEN** the page MUST render exactly one `<TaskInboxRow>` per task

#### Scenario: Sidebar lists Inbox

- **WHEN** the sidebar renders
- **THEN** the navigation item linking to `/_auth/inbox` MUST be labelled `"Inbox"`; any prior `"Taken"` or `"Mijn patiënten"` entry MUST be removed

#### Scenario: Placeholder TasksPage is removed

- **WHEN** the codebase is grepped for `TasksPage` after this change
- **THEN** no React component named `TasksPage` and no `/_auth/tasks` route file MUST exist

#### Scenario: Priority chip variant matches priority

- **WHEN** a row renders for `priority='urgent'`
- **THEN** the priority chip MUST be a destructive-variant Badge; `priority='high'` MUST be warning-variant; `priority='normal'` and `low` MUST be muted-variant

#### Scenario: Status chip hidden for open tasks

- **WHEN** a row renders for `status='open'`
- **THEN** no status chip MUST be rendered (open is the default state)

#### Scenario: Status chip visible for non-open tasks

- **WHEN** a row renders for `status='in_progress' | 'completed' | 'cancelled'`
- **THEN** a muted Badge MUST render with the appropriate Dutch label

### Requirement: Row click opens the patient detail in split-pane

`<TaskInboxRow>` SHALL navigate on click to `/_auth/inbox/p/$patientId` where `$patientId === task.patient.id`. The route `/_auth/inbox/p/$patientId` SHALL render a 3-state master/detail layout per design.md D15: inbox list on the left (compacts to 320px rail), `<PatientDetailView>` on the right.

Below the `md` breakpoint per D17, the row click SHALL navigate to `/_auth/patients/$patientId` (the standalone full-page detail) instead; the inbox unmounts.

#### Scenario: Row click navigates to inbox-context patient route

- **WHEN** a caregiver clicks a `<TaskInboxRow>` whose `task.patient.id === "abc-123"` on a viewport ≥ md
- **THEN** the orchestrator MUST navigate to `/_auth/inbox/p/abc-123`

#### Scenario: Split-pane on desktop

- **WHEN** a caregiver loads `/_auth/inbox/p/abc-123` directly on a viewport ≥ md
- **THEN** the page MUST render the inbox list as a 320px compact rail on the left and `<PatientDetailView patient={abc-123}>` on the right

#### Scenario: Mobile fallback to standalone detail

- **WHEN** a caregiver clicks a row on a viewport < md
- **THEN** the orchestrator MUST navigate to `/_auth/patients/abc-123` (standalone); the inbox list MUST NOT render

### Requirement: Inbox sort registry over tasks

The orchestrator SHALL define `apps/orchestrator/src/modules/inbox/sorts/index.ts` exporting `inboxSortStrategies: readonly InboxSortStrategy[]`. Each strategy has `{ id, label, queryParams }`. v1 strategies:

1. `next_attention` (default) — `queryParams()` returns `{ order_by: 'due_at', order: 'asc' }`. Earliest deadline first.
2. `newly_added` — `queryParams()` returns `{ order_by: 'created_at', order: 'desc' }`. Most-recently-added task first.

A `useSelectedInboxSort()` hook SHALL read `?sort=` via TanStack Router `useSearch` synchronously, default to `next_attention`, and warn-log on unknown values.

#### Scenario: Default sort is next_attention

- **WHEN** a caregiver loads `/_auth/inbox` without a `sort` query param
- **THEN** the request to `GET /tasks` MUST include `order_by=due_at&order=asc`

#### Scenario: newly_added sort drives created_at descending

- **WHEN** a caregiver activates the `newly_added` strategy
- **THEN** the request MUST include `order_by=created_at&order=desc` and the URL MUST update to `?sort=newly_added`

### Requirement: Inbox empty state copy is role-aware

When `GET /tasks` returns zero items, the `<InboxList>` SHALL render `<EmptyState>` with role-aware copy:

- `caregiver`: headline `"Geen openstaande taken"`, hint `"Wanneer een collega of het pathway een taak aanmaakt verschijnt deze hier."`.
- `admin`: headline `"Geen taken in dit tenant"`, hint `"Pathway-runtime taken landen hier zodra de runtime live is."`.

#### Scenario: Caregiver-role empty state

- **WHEN** a caregiver with zero visible tasks loads `/_auth/inbox`
- **THEN** the page MUST render the headline `"Geen openstaande taken"` and the caregiver-specific hint

#### Scenario: Admin-role empty state

- **WHEN** an admin in a tenant with zero tasks loads `/_auth/inbox`
- **THEN** the page MUST render the headline `"Geen taken in dit tenant"` and the admin-specific hint
