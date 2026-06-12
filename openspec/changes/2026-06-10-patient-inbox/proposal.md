**Tier**: [poc]
**Promotes**: BL-037 (F4 patient domain — caregiver task list surface), BL-065 (Real task list surface — promoted from placeholder), and partial scope of BL-038 (appointment domain prerequisite for the task list signal).

## Why

`patients-base` shipped `/_auth/patients` as a generic `<DataTable<PatientRead>>` and `patient-profile-ui` shipped the patient detail page with three meta tabs (`Overzicht`, `Zorgteam`, `Geschiedenis`). The placeholder `/_auth/tasks` route reserves a sidebar slot but renders nothing. None of these match how a caregiver actually uses the orchestrator in the demo story:

- A caregiver asks *"what do I need to do right now?"* — not *"show me every patient in a spreadsheet"*. The DataTable surfaces a directory; the work is attention triage.
- A patient with three things to do today collapses into one row in a patient-overview list; an attention-first surface shows three rows. The right unit of attention is the **task item**, not the patient.
- The current detail page tabs are meta-heavy (demographics, audit). The clinical surfaces a caregiver needs — measurements, lab results — are absent.

This change ships:
- The caregiver task list (`/_auth/tasks`) backed by a server-side aggregator (`GET /tasks`) that projects items from one or more underlying source domains into a unified `TaskItem` envelope. v1 source set = `appointment` only.
- The appointment domain (`appointment-base`) for patient–caregiver scheduling. **Data layer only v1**: tables, enums, ORM, alembic migration, `AppointmentValidator` module. NO HTTP routes (`GET /appointments`, `POST`, `PATCH`, `DELETE`) ship in this change. NO `AppointmentService`, NO `AppointmentRepository`, NO `HixAppointmentAdapter`, NO `AppointmentRead` / `AppointmentCreate` / `AppointmentPatch` schemas. Rows enter via test fixtures using the validator. A future change adds the HTTP surface when a consumer (write UI, pathway runtime, HiX adapter) materialises.
- The patient detail re-layout (`patient-profile-ui`): two tabs (Metingen + Labresultaten), both empty-state v1. NO Afspraken tab.
- The route surgery to make the new framing consistent (delete `/_auth/patients` list, delete `/_auth/tasks.tsx` placeholder + `modules/tasks/` placeholder dir FIRST, add new `/_auth/tasks/` directory route + new `modules/tasks/` directory + `/_auth/tasks/$taskId` child AFTER).

The task list is a **server-side aggregator over source domains** (per D-AGG). There is no `tasks` table — tasks are projected from appointment rows (and, later, from other sources) at request time. Appointments live in their own domain (`appointment-base`) consumed only by `/tasks`. No second surface for appointments in v1.

## What Changes

### New backend capability — `appointment-base`

- New `appointments` table (`patient_id` FK, `title`, `description`, `kind` enum, `starts_at`, `ends_at`, `modality` enum, `location_text`, `status` FHIR enum, `pathway_block_instance_id` nullable column with NO FK in v1 per D18, audit + soft-delete inherited).
- New `appointment_participants` join table (`appointment_id`, `user_id`, `role` enum `lead | support | observer`) with a partial unique index enforcing exactly one active `lead` per appointment.
- **NO HTTP routes v1** — no `GET /appointments`, no POST, no PATCH, no DELETE. Future change adds when consumer exists.
- Validation rules (`ends_at > starts_at` strict; ≥1 participant with exactly one `lead`; `modality='on_site'` requires `location_text`; same-tenant patient + participants; participant set frozen after create) live in an `AppointmentValidator` module reusable by test fixtures and future writers. DB layer adds CHECK constraint + partial unique indexes for defence-in-depth.
- NO `HixAppointmentAdapter` v1 — adapter ships with the HiX integration change.
- NO seed data v1; NO realtime topic v1.

### New backend capability — `tasks-base` (server-side aggregator, no table)

- Two routes: `GET /tasks` (list) and `GET /tasks/{source}/{source_id}` (read-one).
- Unified envelope `TaskItem` = `{ id: UUID, source, source_id: UUID, due_at, title, kind, priority?, payload: <source>Payload }`. `id` is the source row's UUID PK (no composite encoding). No top-level `patient` field — patient lives inside `payload.patient`.
- v1 source set: `appointment`. Source row projected: `id = source_id = appointment.id`, `due_at = appointment.starts_at`, `title = appointment.title`, `kind = appointment.kind`, `priority = null`, `payload = AppointmentPayload` where `payload.patient: PatientInlineSummary` is JOIN-projected.
- **Window hardcoded** to next 30 days for the v1 appointment source (`status='booked' AND starts_at BETWEEN now() AND now()+INTERVAL '30 days'`). No `?within=` parameter v1 — unknown params silently ignored for forward-compat.
- **Visibility**: participant-driven, scoped to the caller's user id — caller must have an active `appointment_participants` row (any role) for the appointment to surface. Admins use the same predicate (no tenant-wide bypass). Patient role 403.
- **Sort**: fixed `order_by=due_at order=asc`. No sort registry, no `created_at` sort, no `desc`.
- `PatientInlineSummary` defined once in `app/schemas/patient/patient.py`, imported by `tasks-base`.
- **NO** `tasks` table, NO `task_*` Postgres enums, NO `Task` ORM model, NO HiX task adapter, NO seed script.

### Modified backend capability — `patients-base`

- The orchestrator's `/_auth/patients` list route is REMOVED (per D24). The backend `GET /patients` list endpoint is RETAINED for admin tooling + patient pickers + care-team flows. No new fields on `PatientRead`.
- `order_by` allow-list explicitly rejects `next_appointment_starts_at` — that sort key was never added; this assertion is regression-only.

### Modified frontend capability — `patient-profile-ui`

- Replace tab strip with two clinical tabs in order: `Metingen` (id `measurements`), `Labresultaten` (id `lab_results`). Default active tab = `measurements`. **NO Afspraken tab** — appointment surfacing lives entirely in `/_auth/tasks`.
- Hoist demographics + identifiers into the `<PageHeader>` subtitle row (INSZ Badge + Geboren + org Badge) via `<EntityDetailPage>`. The `Overzicht` tab is dropped.
- Move `<CareTeamSlot>` out of the tab body into a header-adjacent card. Export path (`apps/orchestrator/src/modules/patient/components/CareTeamSlot.tsx`) and prop signature (`{ patientId: string }`) unchanged — `care-teams-ui` stays unaffected.
- Move audit history off the strip into a new `Geschiedenis` kebab entry that opens a shadcn `<Dialog>` rendering the existing `<PatientHistoryPanel>`.
- **Metingen** and **Labresultaten** tabs render the existing `<EmptyState>` directly (no new `<TabEmptyState>` wrapper).

### New frontend capability — orchestrator task list surface

- New `/_auth/tasks` route (directory route) — the canonical caregiver attention surface. Replaces both the `/_auth/tasks.tsx` placeholder (`TasksPage` + `tasksPort` + placeholder adapter + `modules/tasks/` ALL deleted) and the `/_auth/patients` list route.
- New `/_auth/tasks/$taskId` child route — right pane mounts `<EntityDetailPage>` with `<AppointmentContextBlock>` above the Metingen + Labresultaten tabs. URL drives task selection (not patient selection — same patient with two tasks → two distinct URLs).
- Existing `/_auth/patients/$patientId` route RETAINED as a standalone full-page detail using the same `<EntityDetailPage>` + `<EntityDetailTabs>` primitives (no appointment block). Used by admin/users links, care-team links, any non-task-context entry.
- `/_auth/patients` (list route file) DELETED.
- Sidebar nav: `"Mijn patiënten"` + placeholder `"Taken"` → single `"Taken"` item pointing to `/_auth/tasks` (lucide `inbox` icon — icon name only).

Task list surface implementation:
- `<TaskRow>` built directly (no generic `<InboxRow>` / `<ListRow>` abstraction layer). Compact rail anatomy per D7: `<KindTile>` leading + `family, given` + relative due copy. NO avatar, NO INSZ, NO chevron in the rail. Click navigates to `/_auth/tasks/$taskId`. Rail rows grouped per calendar day (`Vandaag` / `Morgen` / `za 14 jun`); the URL-active row carries a 3px primary left accent.
- Single fixed sort (D-NOSORT). No sort registry, no tab strip for strategies.
- Day-grouped scrolling list (D-FLAT). Rows grouped per calendar day (`Vandaag` / `Morgen` / `za 14 jun`). No counter, no pager UI, no `"Meer laden"` — single request at `page_size=100`, natural scroll.
- `<AppointmentContextBlock>` is a new task-scoped widget (flat strip with KindTile + title + meta + lead + `Open afspraak` ghost button) rendered above the clinical tabs on the task detail route. Lives in `modules/tasks/components/`.
- `<MasterDetailLayout>` shipped earlier in this change as a generic 3-state collapse primitive. NOT consumed by `/_auth/tasks` v12 (the surface is a plain two-column flex). Available for future surfaces.
- `<Avatar>` lifted to support deterministic `tintBy` prop (palette at the design-system layer).

### Architecture seams

- The patient-detail chrome reuses the existing `<EntityDetailPage>` + `<EntityDetailTabs>` primitives. Both the task detail route and the standalone patient route compose them with their own subtitle / actions / body content. No bespoke `<PatientDetailView>` primitive ships.
- Regenerate OpenAPI + typed client.

## Capabilities

### Added Capabilities

- `appointment-base` — new backend capability covering appointment domain (table, participants, FHIR-aligned enums, ORM models, alembic migration, `AppointmentValidator` module). **Data layer only v1 — no HTTP routes.** Consumed by `tasks-base` aggregator via direct SQL.
- `tasks-base` — new backend aggregator capability (`GET /tasks` projecting source rows into a uniform `TaskItem` envelope; v1 source = `appointment` only; ≤30-day window; participant-driven visibility) AND orchestrator task list surface (sidebar entry, `/_auth/tasks` list route, `/_auth/tasks/$taskId` task detail route, `<TaskList>`, `<TaskRow>`, `<AppointmentContextBlock>`).

### Modified Capabilities

- `patients-base` — `/_auth/patients` list route REMOVED; sidebar entry replaced. `GET /patients` list endpoint retained. `order_by` allow-list rejects `next_appointment_starts_at` (regression assertion).
- `patient-profile-ui` — detail tab strip replaced (2 tabs: Metingen + Labresultaten, both empty v1); demographics absorbed into the `<PageHeader>` subtitle row via `<EntityDetailPage>`; CareTeamSlot relocated to header card; audit moved behind kebab; NO Afspraken tab. Detail route `/_auth/patients/$patientId` retained as a standalone mount of the same `<EntityDetailPage>` + `<EntityDetailTabs>` primitives.

## Impact

- **Prerequisites**: `patients-base`, `patient-profile-ui`, `user-base` (archived as `backend-user-auth-base`), `care-teams-base` archived.
- **DB**:
  - New `appointments` + `appointment_participants` tables + four Postgres enums (`appointment_kind`, `appointment_status`, `appointment_modality`, `appointment_participant_role`).
  - One alembic migration. No tasks table — `tasks-base` is route-only.
- **Backend code** (`apps/backend/app/`):
  - `core/enums/appointment.py` — four enums.
  - `domain/appointment/` — ORM models (`Appointment`, `AppointmentParticipant`) + `validator.py` (`AppointmentValidator` module).
  - `services/tasks/tasks_aggregator.py` — aggregator orchestration: source registry + per-source projection.
  - `services/tasks/sources/appointment_source.py` — v1 source projection (`AppointmentRow → TaskItem`).
  - `api/routers/task/task_router.py` — two read routes (`GET /tasks`, `GET /tasks/{source}/{source_id}`).
  - `schemas/appointment/appointment.py` — `AppointmentParticipantInlineSummary` only (used by `TaskItem.payload`). No `AppointmentRead/Create/Patch`.
  - `schemas/patient/patient.py` — `PatientInlineSummary` added here (domain owner; used inside `AppointmentPayload`).
  - `schemas/task/task_item.py` — `TaskItem` envelope + `AppointmentPayload` (with `patient: PatientInlineSummary` inside).
  - `tests/fixtures/appointment_factory.py` — test fixture using the validator to materialise valid rows.
- **Frontend code** (`apps/orchestrator/src/`):
  - New `components/layout/MasterDetailLayout.tsx` — generic 3-state primitive (shipped, not consumed by tasks surface v12).
  - Extend `components/ui/avatar.tsx` with `tintBy` prop.
  - New `modules/tasks/` (created AFTER placeholder `modules/tasks/` is deleted) — `TaskList.tsx`, `TaskRow.tsx`, `components/KindTile.tsx`, `useTasksQuery.ts`, `types.ts`, `dueLabel.ts`.
  - New `modules/tasks/components/AppointmentContextBlock.tsx` — slim flat strip above the tabs on the task detail route.
  - New `modules/patient/components/PatientKebab.tsx` — `Bewerken` / `Verwijderen` / `Geschiedenis` reused by both detail routes.
  - Delete `modules/patient/components/` — `PatientDemographicsPanel`, `PatientIdentifiersPanel`, `PatientsColumns`.
  - Delete `modules/tasks/` placeholder — `TasksPage`, `tasksPort`, placeholder adapter, `types.ts`. Folder removed (then recreated).
  - New routes (after placeholder deletion): `routes/_auth/tasks/route.tsx`, `routes/_auth/tasks/index.tsx`, `routes/_auth/tasks/$taskId/index.tsx`.
  - Modified: `routes/_auth/patients/$patientId/index.tsx` (existing `<PatientProfilePage>` collapsed to two clinical tabs via `<EntityDetailPage>` + `<EntityDetailTabs>`).
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
- **R8 — Mobile (<md)** out of scope v1 — desktop-first; mobile work is a follow-up.
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
- Master/detail collapse on the tasks surface (v12 uses a plain two-column flex per D-LAYOUT-V12).
- Backend URL prefix split (`/caregiver/...` vs `/patient/...`).
