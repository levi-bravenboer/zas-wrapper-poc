**Tier**: [poc]
**Promotes**: BL-037 (F4 patient domain — caregiver task list surface), BL-065 (Real task list surface — promoted from placeholder), and partial scope of BL-038 (appointment domain prerequisite for the task list signal).

## Why

`patients-base` shipped `/_auth/patients` as a generic `<DataTable<PatientRead>>` and `patient-profile-ui` shipped the patient detail page with three meta tabs (`Overzicht`, `Zorgteam`, `Geschiedenis`). The placeholder `/_auth/tasks` route reserves a sidebar slot but renders nothing. None of these match how a caregiver actually uses the orchestrator in the demo story:

- A caregiver asks *"what do I need to do right now?"* — not *"show me every patient in a spreadsheet"*. The DataTable surfaces a directory; the work is attention triage.
- A patient with three things to do today collapses into one row in a patient-overview list; an attention-first surface shows three rows. The right unit of attention is the **task item**, not the patient.
- The current detail page tabs are meta-heavy (demographics, audit). The clinical surfaces a caregiver needs — measurements, lab results — are absent.

This change ships:
- The caregiver task list (`/_auth/tasks`) backed by a server-side aggregator (`GET /tasks`) that projects items from one or more underlying source domains into a unified `TaskItem` envelope. v1 source set = `appointment` only.
- The appointment domain (`appointment-base`, full backend CRUD) for patient–caregiver scheduling. FE does NOT consume `GET /appointments` list directly in v1 — `/tasks` is the only consumer surface. The list endpoint still ships for: tests, admin tooling, future pathway runtime, future write UI.
- The patient detail re-layout (`patient-profile-ui`): two tabs (Metingen + Labresultaten), both empty-state v1. NO Afspraken tab.
- The route surgery to make the new framing consistent (delete `/_auth/patients` list, delete `/_auth/tasks.tsx` placeholder + `modules/tasks/` placeholder dir FIRST, add new `/_auth/tasks/` directory route + new `modules/tasks/` directory + `/_auth/tasks/p/$patientId` child AFTER).

The task list is a **server-side aggregator over source domains** (per D-AGG). There is no `tasks` table — tasks are projected from appointment rows (and, later, from other sources) at request time. Appointments live in their own domain (`appointment-base`) consumed only by `/tasks`. No second surface for appointments in v1.

## What Changes

### New backend capability — `appointment-base`

- New `appointments` table (`patient_id` FK, `title`, `description`, `kind` enum, `starts_at`, `ends_at`, `modality` enum, `location_text`, `status` FHIR enum, `pathway_block_instance_id` nullable column with NO FK in v1 per D18, audit + soft-delete inherited).
- New `appointment_participants` join table (`appointment_id`, `user_id`, `role` enum `lead | support | observer`) with a partial unique index enforcing exactly one active `lead` per appointment.
- Full CRUD: `GET /appointments`, `GET /appointments/{id}`, `POST /appointments`, `PATCH /appointments/{id}` (no participants — frozen after create v1), `DELETE /appointments/{id}` (soft).
- Visibility: caregivers see appointments only for patients they can see; admins tenant-wide. `patient` role rejected. (FE does not consume this list in v1; visibility predicate kept for future consumers + tests.)
- Validation: `ends_at > starts_at` strict; one `lead` required at create; `modality='on_site'` requires `location_text`; state-machine free.
- HiX adapter module stub (`HixAppointmentAdapter`).
- No seed data v1; no realtime topic v1.

### New backend capability — `tasks-base` (server-side aggregator, no table)

- Two routes: `GET /tasks` (list) and `GET /tasks/{source}/{source_id}` (read-one).
- Unified envelope `TaskItem` = `{ id, source, source_id, patient: PatientInlineSummary, due_at, title, kind, priority?, payload: <source>Payload }`. `id` = `f"{source}:{source_id}"`.
- v1 source set: `appointment`. Source row projected: `due_at = appointment.starts_at`, `title = appointment.title`, `kind = appointment.kind`, `priority = null`, `payload = AppointmentPayload`.
- **Window hardcoded** to next 3 days for the v1 appointment source (`status='booked' AND starts_at BETWEEN now() AND now()+INTERVAL '3 days'`). No `?within=` parameter v1 — unknown params silently ignored for forward-compat.
- **Visibility**: participant-driven, scoped to the caller's user id — caller must have an active `appointment_participants` row (any role) for the appointment to surface. Admins use the same predicate (no tenant-wide bypass). Patient role 403.
- **Sort**: fixed `order_by=due_at order=asc`. No sort registry, no `created_at` sort, no `desc`.
- `PatientInlineSummary` defined once in `app/schemas/patient/patient.py`, imported by `tasks-base`.
- **NO** `tasks` table, NO `task_*` Postgres enums, NO `Task` ORM model, NO HiX task adapter, NO seed script.

### Modified backend capability — `patients-base`

- The orchestrator's `/_auth/patients` list route is REMOVED (per D24). The backend `GET /patients` list endpoint is RETAINED for admin tooling + patient pickers + care-team flows. No new fields on `PatientRead`.
- `order_by` allow-list explicitly rejects `next_appointment_starts_at` — that sort key was never added; this assertion is regression-only.

### Modified frontend capability — `patient-profile-ui`

- Replace tab strip with two clinical tabs in order: `Metingen` (id `measurements`), `Labresultaten` (id `lab_results`). Default active tab = `measurements`. **NO Afspraken tab** — appointment surfacing lives entirely in `/_auth/tasks`.
- Hoist demographics + identifiers into the sticky `<PatientDetailHeader>` (drops the `Overzicht` tab).
- Move `<CareTeamSlot>` out of the tab body into a header-adjacent card. Export path (`apps/orchestrator/src/modules/patient/components/CareTeamSlot.tsx`) and prop signature (`{ patientId: string }`) unchanged — `care-teams-ui` stays unaffected.
- Move audit history off the strip into a new `Geschiedenis` kebab entry that opens a shadcn `<Dialog>` rendering the existing `<PatientHistoryPanel>`.
- **Metingen** and **Labresultaten** tabs render the existing `<EmptyState>` directly (no new `<TabEmptyState>` wrapper).

### New frontend capability — orchestrator task list surface

- New `/_auth/tasks` route (directory route) — the canonical caregiver attention surface. Replaces both the `/_auth/tasks.tsx` placeholder (`TasksPage` + `tasksPort` + placeholder adapter + `modules/tasks/` ALL deleted) and the `/_auth/patients` list route.
- New `/_auth/tasks/p/$patientId` child route — split-pane with task list (compact rail) + `<PatientDetailView>`.
- Existing `/_auth/patients/$patientId` route RETAINED as a standalone full-page detail mount of the same `<PatientDetailView>`. Used by admin/users links, care-team links, mobile fallback (per D17).
- `/_auth/patients` (list route file) DELETED.
- Sidebar nav: `"Mijn patiënten"` + placeholder `"Taken"` → single `"Taken"` item pointing to `/_auth/tasks` (lucide `inbox` icon — icon name only).

Task list surface implementation:
- `<TaskRow>` built directly (no generic `<InboxRow>` / `<ListRow>` abstraction layer). Anatomy: subject avatar, INSZ + kind label + relative due copy, `<KindTile>` trailing, chevron. Click navigates to `/_auth/tasks/p/$patientId`.
- Single fixed sort (D-NOSORT). No sort registry, no tab strip for strategies.
- Flat list (D-FLAT). No counter, no pager, no `"Meer laden"` — the 3-day window caps result size.
- `<MasterDetailLayout>` is a new generic 3-state collapse primitive (full / compact 320px / hidden) reusable for any future master/detail surface.
- `<Avatar>` lifted to support deterministic `tintBy` prop (palette at the design-system layer).

### Architecture seams

- `<PatientDetailView>` is a surface-agnostic primitive (no router import, no tasks module import) per D16. Mounted by three hosts: tasks-context split-pane child route, standalone full-page route, future smart/embed surface.
- Regenerate OpenAPI + typed client.

## Capabilities

### Added Capabilities

- `appointment-base` — new backend capability covering appointment domain (table, participants, FHIR-aligned enums, CRUD endpoints, visibility, HiX adapter stub). Consumed by `tasks-base` aggregator only in v1.
- `tasks-base` — new backend aggregator capability (`GET /tasks` projecting source rows into a uniform `TaskItem` envelope; v1 source = `appointment` only; ≤3-day window; participant-driven visibility) AND orchestrator task list surface (sidebar entry, `/_auth/tasks` list route, `/_auth/tasks/p/$patientId` split-pane child route, `<TaskList>`, `<TaskRow>`).

### Modified Capabilities

- `patients-base` — `/_auth/patients` list route REMOVED; sidebar entry replaced. `GET /patients` list endpoint retained. `order_by` allow-list rejects `next_appointment_starts_at` (regression assertion).
- `patient-profile-ui` — detail tab strip replaced (2 tabs: Metingen + Labresultaten, both empty v1); demographics absorbed into header; CareTeamSlot relocated to header card; audit moved behind kebab; NO Afspraken tab. Detail route `/_auth/patients/$patientId` retained as standalone mount of new `<PatientDetailView>`.

## Impact

- **Prerequisites**: `patients-base`, `patient-profile-ui`, `user-base` (archived as `backend-user-auth-base`), `care-teams-base` archived.
- **DB**:
  - New `appointments` + `appointment_participants` tables + four Postgres enums (`appointment_kind`, `appointment_status`, `appointment_modality`, `appointment_participant_role`).
  - One alembic migration. No tasks table — `tasks-base` is route-only.
- **Backend code** (`apps/backend/app/`):
  - `core/enums/appointment.py` — four enums.
  - `domain/appointment/` — ORM models.
  - `repositories/appointment_repository.py` — `BaseListRepository` subclass.
  - `services/appointment/appointment_service.py` — appointment CRUD + tenant + patient-access.
  - `services/tasks/tasks_aggregator.py` — aggregator orchestration: source registry + per-source projection.
  - `services/tasks/sources/appointment_source.py` — v1 source projection (`AppointmentRow → TaskItem`).
  - `api/routers/appointment/appointment_router.py` — five CRUD routes.
  - `api/routers/task/task_router.py` — two read routes (`GET /tasks`, `GET /tasks/{source}/{source_id}`).
  - `schemas/appointment/appointment.py` — appointment schemas.
  - `schemas/patient/patient.py` — `PatientInlineSummary` added here (domain owner).
  - `schemas/task/task_item.py` — `TaskItem` envelope + `AppointmentPayload`.
  - `adapters/hix/appointments.py` — adapter stub.
- **Frontend code** (`apps/orchestrator/src/`):
  - New `components/layout/MasterDetailLayout.tsx` — generic 3-state primitive.
  - Extend `components/ui/avatar.tsx` with `tintBy` prop.
  - New `modules/tasks/` (created AFTER placeholder `modules/tasks/` is deleted) — `TaskList.tsx`, `TaskRow.tsx`, `components/KindTile.tsx`, `useTasksQuery.ts`, `types.ts`, `dueLabel.ts`.
  - New `modules/patient/components/` — `PatientDetailHeader`, `PatientDetailView`, `PatientKebab`.
  - Delete `modules/patient/components/` — `PatientDemographicsPanel`, `PatientIdentifiersPanel`, `PatientsColumns`.
  - Delete `modules/tasks/` placeholder — `TasksPage`, `tasksPort`, placeholder adapter, `types.ts`. Folder removed (then recreated).
  - New routes (after placeholder deletion): `routes/_auth/tasks/route.tsx`, `routes/_auth/tasks/index.tsx`, `routes/_auth/tasks/p/$patientId/index.tsx`.
  - Modified: `routes/_auth/patients/$patientId/index.tsx` (mounts new `<PatientDetailView>`).
  - Deleted: `routes/_auth/patients/index.tsx`, `routes/_auth/tasks.tsx`.
  - Sidebar update: drop `"Mijn patiënten"` + placeholder `"Taken"`, add single `"Taken"` entry pointing to `/_auth/tasks`.
  - i18n: new `nl/tasks.json`, new `nl/appointment.json` (owns kind + modality labels via cross-ns lookup), extend `nl/patient-profile-ui.json`.
- **OpenAPI / typed client**: regenerated.

## Risks and mitigations

- **R1 — Two new backend domains in one PR is larger than either alone.** **Mitigation**: independent migrations, independent services, independent tests. Aggregator is small.
- **R2 — No seed data means demo runs empty.** **Mitigation accepted**: empty-state copy clearly tells caregivers what the surface shows.
- **R3 — `/_auth/patients` list route deletion breaks direct links.** **Mitigation**: typed routes catch internal breakage at compile time.
- **R4 — Participant-driven visibility means tasks for other caregivers do NOT surface in my task list.** Intentional (D-PART) — personal attention surface.
- **R5 — Admins see empty task list in day-to-day use.** **Mitigation accepted (D-PART)**.
- **R6 — Frozen-after-create participants on appointments.** **Mitigation accepted**: PoC clinical reality.
- **R7 — Empty Metingen + Labresultaten tabs read as broken in demo.** **Mitigation**: `<EmptyState>` copy explicitly says "wordt geleverd door X".
- **R8 — Mobile (<md) split-pane fallback per D17.**
- **R9 — `entered-in-error` FHIR status hyphen.** Stored as `entered_in_error`, serialised as `entered-in-error`.
- **R10 — Aggregator over one source v1 is over-engineered if a 2nd source never lands.** **Mitigation**: ~50 LOC; wire shape stable.
- **R11 — No patient-centric appointment history surface anywhere.** Out of scope this change; follow-up when stakeholder asks.
- **R12 — Route + module rename collision (placeholder vs new).** **Mitigation**: D-RENAME locks delete-then-create sequence in tasks.md.

## Out of scope

- A `tasks` table, `Task` ORM model, `task_*` Postgres enums, HiX task adapter, seed_tasks script.
- Demo seed for appointments (`seed_appointments.py`).
- Configurable `/tasks` time window.
- Multiple sort strategies / sort registry / `?sort=` query param.
- Counter / pager / infinite scroll on the task list.
- Generic `<InboxRow>` / `<ListRow>` primitive (not built v1).
- `<AppointmentRow>` / `<AppointmentsSection>` / `<TabEmptyState>` components.
- Patient-centric appointment history view (would be a separate change).
- An `Afspraken` tab on patient detail.
- Frontend write actions on appointments (create, edit, delete, status change, participants).
- Patient-facing read of tasks / appointments (mobile app).
- Real data wiring for `Metingen` and `Labresultaten` tabs.
- Realtime invalidation topic.
- Conflict / double-booking detection on appointments.
- Recurrence, reminders, notifications.
- A `smart` or `embed` surface for tasks or detail.
- Create-patient action.
- Identifier mutation, soft-delete flows beyond `patient-profile-ui` prior.
- Pathway runtime materialising appointments OR feeding `/tasks` as a second source; `pathway_block_instance_id` FK addition is a follow-up change.
- A patient-directory browser to replace the deleted `/_auth/patients` list.
- Persisting the master-hidden toggle in the URL (session-local UI state per D15).
- Backend URL prefix split (`/caregiver/...` vs `/patient/...`).
