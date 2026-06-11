## ADDED Requirements

### Requirement: `/tasks` is a server-side aggregator over multiple source domains, not a standalone table

The backend SHALL expose `/tasks` as an aggregator endpoint that projects items from one or more underlying source domains into a unified `TaskItem` envelope. There is NO `tasks` table, NO `task_*` Postgres enums, NO ORM model named `Task`, and NO HiX task adapter in this change. Each `TaskItem` is materialised at request time from the active source(s); adding a new source is a backend-only change (new source key + projection function + query plan).

v1 source set is exactly: `appointment`. Future sources (e.g. `form_response`, `monitoring_alert`) plug into the same envelope without a wire-shape change.

#### Scenario: No tasks table is created

- **WHEN** the database is migrated to head on this change
- **THEN** there MUST NOT exist a table named `tasks`, nor Postgres enum types named `task_kind`, `task_status`, or `task_priority`

#### Scenario: No HiX task adapter ships

- **WHEN** the codebase under `app/adapters/hix/` is inspected
- **THEN** there MUST NOT exist a file `tasks.py` or a class `HixTaskAdapter`

### Requirement: `GET /tasks` returns a unified `TaskItem` envelope with typed source payload

The backend SHALL expose `GET /tasks` (list) and `GET /tasks/{source}/{source_id}` (read-one) returning the `TaskItem` envelope:

```python
class TaskItem(BaseModel):
    id: str                             # synthetic stable id: f"{source}:{source_id}"
    source: Literal["appointment"]      # extends as sources are added
    source_id: UUID                     # primary key in the source domain
    patient: PatientInlineSummary       # { id, family_name, given_name, insz?, primary_organisation_id }
    due_at: datetime                    # the "act-by" timestamp the task list sorts on
    title: str                          # source-derived display title
    kind: str | None                    # source-derived classification (e.g. AppointmentKind value)
    priority: TaskPriority | None       # uniform optional; null for v1 appointment source
    payload: AppointmentPayload         # discriminated union by `source`; v1 only `AppointmentPayload`
```

`PatientInlineSummary` SHALL be defined once in `app/schemas/patient/patient.py` and re-used by `tasks-base`. Shape: `{ id, family_name, given_name, insz?: string | null, primary_organisation_id }` — projected via JOIN, never N+1.

For the v1 `appointment` source:
- `id` = `f"appointment:{appointment.id}"`.
- `source_id` = `appointment.id`.
- `due_at` = `appointment.starts_at`.
- `title` = `appointment.title`.
- `kind` = `appointment.kind` value (string).
- `priority` = `null`.
- `payload` = `AppointmentPayload` = `{ id, starts_at, ends_at, kind, modality, location_text, status, participants: list[AppointmentParticipantInlineSummary] }`.

#### Scenario: TaskItem includes typed source payload

- **WHEN** `GET /tasks` returns an appointment-source item
- **THEN** the body MUST include `source: "appointment"`, `source_id` matching the underlying appointment row id, `id` formatted as `f"appointment:{source_id}"`, and a `payload` object matching the `AppointmentPayload` shape

#### Scenario: PatientInlineSummary is projected via JOIN

- **WHEN** `GET /tasks` returns N items spanning M distinct patients
- **THEN** the backend MUST resolve the patient summary in a single round-trip JOIN, NOT N follow-up patient fetches

### Requirement: `GET /tasks` v1 window is hardcoded to the next 3 days

For the v1 `appointment` source, `GET /tasks` SHALL surface ONLY appointments where `status = 'booked'` AND `starts_at` is between `now()` and `now() + INTERVAL '3 days'` inclusive. The window SHALL NOT be configurable via a query parameter in v1; widening the window is a follow-up change.

Soft-deleted appointments SHALL be excluded. Appointments outside the window SHALL be excluded from `GET /tasks` even if otherwise visible to the caller.

Unknown query parameters (e.g. `?within=7d`) SHALL be silently ignored, NOT rejected with `422`. This preserves forward compatibility when v2 introduces a configurable window.

#### Scenario: Appointment beyond 3-day window excluded

- **WHEN** an appointment has `status='booked'` and `starts_at = now() + 5 days`
- **THEN** it MUST NOT appear in `GET /tasks`

#### Scenario: Appointment with non-booked status excluded

- **WHEN** an appointment has `status='cancelled'` and `starts_at = now() + 1 day`
- **THEN** it MUST NOT appear in `GET /tasks`

#### Scenario: Past appointment excluded

- **WHEN** an appointment has `status='booked'` and `starts_at = now() - 1 hour`
- **THEN** it MUST NOT appear in `GET /tasks`

#### Scenario: Unknown query param silently ignored

- **WHEN** `GET /tasks?within=7d` is called
- **THEN** the server MUST return the same response as `GET /tasks` with no `within` param (the 3-day window stays fixed) and MUST NOT respond `422`

### Requirement: `GET /tasks` visibility is participant-driven, scoped to the caller's user id

`GET /tasks` SHALL surface a source item ONLY when the caller is the relevant actor on the underlying source row. For the v1 `appointment` source, that means: the caller has an active (non-soft-deleted) row in `appointment_participants` with `user_id = caller.id` (any role: `lead`, `support`, or `observer`).

The caller's role bound is `require_role(Role.ADMIN, Role.CAREGIVER)`. `Role.PATIENT` SHALL receive `403 Forbidden`. Admin users SHALL be subject to the same participant predicate as caregivers — admins do NOT bypass it. An admin who is not a participant on any appointment in the window SHALL receive an empty list.

Cross-tenant reads SHALL return `404`, never `403`.

Every route handler SHALL carry an `# AUTH-HARDEN` source comment.

#### Scenario: Patient role rejected

- **WHEN** a `patient`-role user calls `GET /tasks` or `GET /tasks/{source}/{source_id}`
- **THEN** the API MUST respond `403 Forbidden`

#### Scenario: Caregiver sees only items they participate in

- **WHEN** caregiver `C` is the `lead` participant on appointment `A1` and a `support` participant on `A2`, but is NOT a participant on `A3` (all three booked within 3 days)
- **THEN** `GET /tasks` for `C` MUST include items for `A1` and `A2` only

#### Scenario: Admin sees only their own participations

- **WHEN** an admin `A` calls `GET /tasks` and `A` is a participant on zero appointments in the window
- **THEN** the response MUST be `{ items: [], page: 1, page_size: 25, total: 0, total_pages: 0 }`

#### Scenario: Caregiver no longer participant returns 404 on read-one

- **WHEN** caregiver `C` was a participant on appointment `A` but their participant row is soft-deleted
- **THEN** `GET /tasks/appointment/{A.id}` for `C` MUST return `404`

#### Scenario: Cross-tenant read returns 404

- **WHEN** a caregiver in tenant `T1` calls `GET /tasks/appointment/{source_id}` for an appointment in tenant `T2`
- **THEN** the API MUST respond `404 Not Found`

### Requirement: `GET /tasks` rides shared `ListQuery` envelope with a single fixed sort

The `GET /tasks` route SHALL ride the shared `ListQuery` envelope:

- Pagination via `page` (default 1) and `page_size` (default 25, max 100); response envelope is `Page[TaskItem]`.
- `filter[patient_id][eq]=<uuid>` — restricts to one patient (used by tooling / tests; the task-list UI does NOT send it v1).
- `order_by` SHALL accept exactly one value: `due_at`. Default is `due_at`. `order` SHALL accept exactly `asc`. Any other `order_by` or `order` value MUST be rejected with `422`.

There is no `q=`, no `filter[status]`, no `filter[priority]`, no `filter[assigned_user_id]`, no `filter[due_at][gte/lte]` in v1 — the hardcoded window covers the only relevant date range, and the participant predicate covers personal scope.

#### Scenario: Default sort is `due_at asc`

- **WHEN** `GET /tasks` is called with no `order_by` and no `order`
- **THEN** the items MUST be ordered by `due_at` ascending (earliest first)

#### Scenario: Alternative `order_by` rejected

- **WHEN** `GET /tasks?order_by=created_at` is called
- **THEN** the API MUST respond `422 Unprocessable Entity`

#### Scenario: Descending `order` rejected

- **WHEN** `GET /tasks?order=desc` is called
- **THEN** the API MUST respond `422 Unprocessable Entity`

### Requirement: Orchestrator ships `/_auth/tasks` as the canonical caregiver task list surface

The orchestrator SHALL render at `/_auth/tasks` a `<TaskList>` showing one `<TaskRow>` per `TaskItem` returned by `GET /tasks`. The sidebar SHALL list a navigation item labelled `"Taken"` pointing to `/_auth/tasks` with a lucide `inbox` icon (icon-name only — the surface concept is "tasks", not "inbox").

The previous sidebar entries `"Mijn patiënten"` and the placeholder `"Taken"` SHALL be removed. The placeholder route file (`apps/orchestrator/src/routes/_auth/tasks.tsx`) and the placeholder `apps/orchestrator/src/modules/tasks/` directory (`TasksPage.tsx`, `tasksPort.ts`, placeholder adapter, `types.ts`) SHALL be DELETED FIRST; the new `/_auth/tasks/` route directory and the new `modules/tasks/` directory are CREATED AFTER deletion to avoid naming collisions.

The list page SHALL fetch with TanStack Query (single page; no infinite scroll v1 — the 3-day window caps result size). The page SHALL register a realtime invalidation topic seam (no-op v1; follow-up wires the real topic).

`<TaskRow>` is a flat clickable row composed directly (no `<InboxRow>` / `<ListRow>` generic abstraction layer in this change). Anatomy:

- **Subject avatar** (`<Avatar tintBy={taskItem.patient.id}>`) — initials from `taskItem.patient.family_name` + `taskItem.patient.given_name`. Never an `<img>`.
- **Primary line**: `family, given`.
- **Secondary line** (muted): `INSZ • <kind label via t('appointment:kind.<value>')> • <relative due copy: "vandaag X uur" / "morgen X uur" / "over N dagen">`.
- **Trailing**: `<KindTile>` (v1 source-specific decoration; lives in `modules/tasks/components/KindTile.tsx` since no Afspraken tab consumes it).
- **Chevron** at the right end.

No per-row kebab. No checkbox. No inline action.

#### Scenario: Task list renders one row per TaskItem

- **WHEN** a caregiver loads `/_auth/tasks` with at least one `TaskItem` returned
- **THEN** the page MUST render exactly one `<TaskRow>` per item

#### Scenario: Sidebar lists "Taken" pointing to `/_auth/tasks`

- **WHEN** the sidebar renders
- **THEN** exactly one navigation item linking to `/_auth/tasks` MUST be present, labelled `"Taken"`; any prior `"Mijn patiënten"` entry MUST be removed; no duplicate `"Taken"` entries from the placeholder MUST remain

#### Scenario: Placeholder TasksPage is removed

- **WHEN** the codebase is grepped for `TasksPage` after this change
- **THEN** no React component named `TasksPage` MUST exist, and the new `modules/tasks/` directory MUST NOT contain a `TasksPage.tsx` file (the placeholder is replaced by `TaskList.tsx`)

#### Scenario: No counter, no pager, no "load more"

- **WHEN** the task list renders any number of rows (including zero)
- **THEN** the page MUST NOT render a count header, a numbered pager strip, or a `"Meer laden"` button

### Requirement: Row click opens the patient detail in split-pane (or full-page on mobile)

`<TaskRow>` SHALL navigate on click to `/_auth/tasks/p/$patientId` where `$patientId === taskItem.patient.id` on viewports ≥ `md`. The route `/_auth/tasks/p/$patientId` SHALL render a 3-state master/detail layout per design.md D15: task list on the left (compacts to 320px rail), `<PatientDetailView>` on the right.

Below the `md` breakpoint per design.md D17, the row click SHALL navigate to `/_auth/patients/$patientId` (the standalone full-page detail) instead; the task list unmounts.

#### Scenario: Row click navigates to tasks-context patient route

- **WHEN** a caregiver clicks a `<TaskRow>` whose `taskItem.patient.id === "abc-123"` on a viewport ≥ `md`
- **THEN** the orchestrator MUST navigate to `/_auth/tasks/p/abc-123`

#### Scenario: Split-pane on desktop

- **WHEN** a caregiver loads `/_auth/tasks/p/abc-123` directly on a viewport ≥ `md`
- **THEN** the page MUST render the task list as a 320px compact rail on the left and `<PatientDetailView patient={abc-123}>` on the right

#### Scenario: Mobile fallback to standalone detail

- **WHEN** a caregiver clicks a row on a viewport < `md`
- **THEN** the orchestrator MUST navigate to `/_auth/patients/abc-123` (standalone); the task list MUST NOT render

### Requirement: Empty state copy is single, source-agnostic

When `GET /tasks` returns zero items, the `<TaskList>` SHALL render `<EmptyState>` (the existing component already renders icon-in-circle + headline + body — no `<TabEmptyState>` wrapper needed) with:

- title: `"Geen taken"`
- body: `"Nieuwe taken verschijnen automatisch"`

The copy SHALL be identical for caregiver and admin roles — there is no role-aware empty-state variant in v1.

#### Scenario: Empty task list renders fixed copy

- **WHEN** a caregiver or admin loads `/_auth/tasks` and `GET /tasks` returns zero items
- **THEN** the page MUST render `<EmptyState>` with title `"Geen taken"` and body `"Nieuwe taken verschijnen automatisch"`
