**Tier**: [poc]
**Promotes**: BL-037 (F4 patient domain — caregiver attention surface), BL-065 (Real Inbox surface — promoted from placeholder), and partial scope of BL-038 (appointment domain prerequisite for the inbox signal).

## Why

`patients-base` shipped `/_auth/patients` as a generic `<DataTable<PatientRead>>` and `patient-profile-ui` shipped the patient detail page with three meta tabs (`Overzicht`, `Zorgteam`, `Geschiedenis`). The placeholder `/_auth/inbox` route (BL-065) reserves a sidebar slot but renders nothing. None of these match how a caregiver actually uses the orchestrator in the demo story:

- A caregiver asks *"what needs my attention right now?"* — not *"show me every patient in a spreadsheet"*. The DataTable surfaces a directory; the work is attention triage.
- A patient with three urgent items collapses into one row in a patient-overview list; an attention-first surface shows three rows. The right unit of attention is the **item**, not the patient.
- The current detail page tabs are meta-heavy (demographics, audit). The clinical surfaces a caregiver needs — measurements, lab results, upcoming appointments — are absent.
- The placeholder `/_auth/tasks` route (TasksPage + tasksPort adapter) exists in the orchestrator but has no real backend — it hits a hardcoded placeholder array.

This change ships:
- The caregiver task inbox (`/_auth/inbox`) backed by a real `tasks-base` backend capability.
- The appointment domain (`appointment-base`, full backend CRUD + read-only Afspraken tab) for patient–caregiver scheduling and patient detail context.
- The patient detail re-layout (`patient-profile-ui`).
- The route surgery to make the new framing consistent (delete `/_auth/patients` list, delete `/_auth/tasks` placeholder, add `/_auth/inbox`).

The inbox is a **task list** — not a polymorphic feed of arbitrary items (per D19). Tasks and appointments are different concepts living in different domains: tasks are *actions a caregiver needs to take*, appointments are *scheduled events for a patient*. The inbox surfaces tasks; the patient-detail Afspraken tab surfaces appointments.

## What Changes

### New backend capability — `tasks-base`

- New `tasks` table (`patient_id` FK, `assigned_user_id` FK nullable, `pathway_block_instance_id` nullable column with NO FK in v1 per D18, `title`, `description`, `kind` enum, `status` enum, `due_at` nullable timestamptz, `priority` enum, audit + soft-delete inherited).
- Read-only endpoints v1: `GET /tasks` (list) + `GET /tasks/{id}` (read). NO write routes v1 — tasks are seeded; pathway runtime creates them later (BL-038 follow-up).
- v1 task visibility: caregivers see tasks for patients they have access to (patient-driven predicate, per D23); admins tenant-wide. `patient` role rejected.
- `TaskRead` embeds `patient: PatientInlineSummary` projected via join — no N+1 follow-up to `/patients/{id}` per row.
- Synthetic seed script (`scripts/seed_tasks.py`) creates 0-3 tasks per seeded patient with varied kind/priority/due_at; ~60% assigned to the demo caregiver.
- HiX task adapter stub (`HixTaskAdapter`) — same pattern as patient/appointment adapters.
- No realtime topic v1 (BL-076 follow-up).

### New backend capability — `appointment-base`

- New `appointments` table (`patient_id` FK, `title`, `description`, `kind` enum, `starts_at`, `ends_at`, `modality` enum, `location_text`, `status` FHIR enum, `pathway_block_instance_id` nullable column with NO FK in v1 per D18, audit + soft-delete inherited).
- New `appointment_participants` join table (`appointment_id`, `user_id`, `role` enum `lead | support | observer`) with a partial unique index enforcing exactly one active `lead` per appointment.
- Full CRUD: `GET /appointments`, `GET /appointments/{id}`, `POST /appointments`, `PATCH /appointments/{id}` (no participants — frozen after create v1), `DELETE /appointments/{id}` (soft).
- Visibility: caregivers see appointments only for patients they can see; admins tenant-wide. `patient` role rejected.
- Validation: `ends_at > starts_at` strict; one `lead` required at create; `modality='on_site'` requires `location_text`; state-machine free.
- HiX adapter module stub (`HixAppointmentAdapter`) — same pattern as patient adapter.
- No seed data v1; no realtime topic v1.

### Modified backend capability — `patients-base`

- The orchestrator's `/_auth/patients` list route is REMOVED (per D24). The backend `GET /patients` list endpoint is RETAINED for admin tooling + patient pickers + care-team flows. No new fields on `PatientRead`.
- `order_by` allow-list explicitly rejects `next_appointment_starts_at` — that sort key was never added; this assertion is regression-only.

### Modified frontend capability — `patient-profile-ui`

- Replace tab strip with three clinical tabs in order: `Metingen` (id `measurements`), `Labresultaten` (id `lab_results`), `Afspraken` (id `appointments`). Default active tab = `measurements`.
- Hoist demographics + identifiers into the sticky `<PatientDetailHeader>` (drops the `Overzicht` tab).
- Move `<CareTeamSlot>` out of the tab body into a header-adjacent card. Export path and prop signature unchanged — `care-teams-ui` stays unaffected.
- Move audit history off the strip into a new `Geschiedenis` kebab entry that opens a shadcn `<Dialog>` rendering the existing `<PatientHistoryPanel>`.
- **Metingen** and **Labresultaten** tabs render `<EmptyState>` only (no backend wiring v1).
- **Afspraken** tab renders real data, READ-ONLY: Upcoming section (status `booked`, future, asc) + collapsible History section (everything else, desc).

### New frontend capability — orchestrator inbox surface

- New `/_auth/inbox` route — the canonical caregiver attention surface. Replaces both the `/_auth/tasks` placeholder (TasksPage + tasksPort + placeholder adapter all deleted) and the `/_auth/patients` list route.
- New `/_auth/inbox/p/$patientId` child route — split-pane with inbox list (compact rail) + `<PatientDetailView>`.
- Existing `/_auth/patients/$patientId` route RETAINED as a standalone full-page detail mount of the same `<PatientDetailView>`. Used by admin/users links, care-team links, mobile fallback (per D17).
- `/_auth/patients` (list route file) DELETED.
- Sidebar nav: `"Mijn patiënten"` + `"Taken"` → single `"Inbox"` item pointing to `/_auth/inbox`.

Inbox surface implementation:
- `<TaskInboxRow>` composes the new generic `<InboxRow>` primitive with task-specific bindings (subject avatar, INSZ + kind + due-time relative copy, priority + optional status Badge chips, click navigates to `/_auth/inbox/p/$patientId`).
- Sort registry over tasks (per D19). v1 strategies: `next_attention` (default) maps to `order_by=due_at&order=asc`; `newly_added` maps to `order_by=created_at&order=desc`. `useSelectedInboxSort()` hook is hydration-safe.
- `<MasterDetailLayout>` is a new generic 3-state collapse primitive (full / compact 320px / hidden) reusable for any future master/detail surface.
- `<InboxRow>` is a new generic flat row primitive reusable beyond task inboxes.
- `<Avatar>` lifted to support deterministic `tintBy` prop (palette at the design-system layer per Open Q2).

### Architecture seams

- `<PatientDetailView>` is a surface-agnostic primitive (no router import, no inbox import) per D16. Mounted by three hosts: inbox split-pane child route, standalone full-page route, future smart/embed surface.
- Regenerate OpenAPI + typed client.

## Capabilities

### Added Capabilities

- `tasks-base` — new backend + orchestrator capability covering the tasks domain (table, enums, read-only API, seed, HiX adapter stub) and the orchestrator inbox surface (sidebar entry, `/_auth/inbox` list route, `/_auth/inbox/p/$patientId` split-pane child route, sort registry, `<InboxList>`, `<TaskInboxRow>`).
- `appointment-base` — new backend capability covering appointment domain (table, participants, FHIR-aligned enums, CRUD endpoints, visibility, HiX adapter stub). Consumed by the patient-detail Afspraken tab.

### Modified Capabilities

- `patients-base` — `/_auth/patients` list route REMOVED; sidebar entry replaced. `GET /patients` list endpoint retained. `order_by` allow-list rejects `next_appointment_starts_at` (regression assertion).
- `patient-profile-ui` — detail tab strip replaced; demographics absorbed into header; CareTeamSlot relocated to header card; audit moved behind kebab; Afspraken tab renders real data read-only. Detail route `/_auth/patients/$patientId` retained as standalone mount of new `<PatientDetailView>`.

## Impact

- **Prerequisites**: `patients-base`, `patient-profile-ui`, `users-base` archived. `care-teams-base` archived (CareTeamSlot stays compatible).
- **DB**:
  - New `appointments` + `appointment_participants` tables + four Postgres enums (`appointment_kind`, `appointment_status`, `appointment_modality`, `appointment_participant_role`).
  - New `tasks` table + three Postgres enums (`task_kind`, `task_status`, `task_priority`).
  - One alembic migration for both.
- **Backend code** (`apps/backend/app/`):
  - `core/enums/appointment.py` + `core/enums/task.py` — four + three enums.
  - `domain/appointment/` + `domain/task/` — ORM models.
  - `repositories/appointment_repository.py` + `repositories/task_repository.py` — `BaseListRepository` subclasses.
  - `services/appointment/appointment_service.py` — appointment CRUD + tenant + patient-access.
  - `services/task/task_service.py` — task read-only list/get + tenant + patient-access. NEW.
  - `api/routers/appointment/appointment_router.py` — five CRUD routes.
  - `api/routers/task/task_router.py` — two read routes. NEW.
  - `schemas/appointment/appointment.py` + `schemas/task/task.py` — appointment schemas + `TaskRead` (embeds `PatientInlineSummary`).
  - `adapters/hix/appointments.py` + `adapters/hix/tasks.py` — adapter stubs.
  - `scripts/seed_tasks.py` — synthetic-only seed. NEW.
- **Frontend code** (`apps/orchestrator/src/`):
  - New `components/layout/MasterDetailLayout.tsx` — generic 3-state primitive.
  - New `components/list/InboxRow.tsx` — generic flat row primitive.
  - Extend `components/ui/avatar.tsx` with `tintBy` prop.
  - New `modules/appointment/` — `KindTile`, `AppointmentRow`, `AppointmentsSection`, types + api.
  - New `modules/inbox/` — `sorts/`, `useSelectedInboxSort`, `useInboxQuery` (infinite), `InboxList`, `TaskInboxRow`, types.
  - New `modules/patient/components/` — `PatientDetailHeader`, `PatientDetailView`, `PatientKebab`.
  - Delete `modules/patient/components/` — `PatientDemographicsPanel`, `PatientIdentifiersPanel`, `PatientsColumns`.
  - Delete `modules/tasks/` — `TasksPage`, `tasksPort`, placeholder adapter, `types.ts`. Folder removed.
  - New routes: `routes/_auth/inbox/route.tsx`, `routes/_auth/inbox/index.tsx`, `routes/_auth/inbox/p/$patientId/index.tsx`.
  - Modified: `routes/_auth/patients/$patientId/index.tsx` (mounts new `<PatientDetailView>`).
  - Deleted: `routes/_auth/patients/index.tsx`, `routes/_auth/tasks.tsx`.
  - Sidebar update: drop `"Mijn patiënten"` + `"Taken"`, add single `"Inbox"` entry.
  - i18n: new `nl/inbox.json`, new `nl/patient-appointments.json`, extend `nl/patient-profile-ui.json`.
- **OpenAPI / typed client**: regenerated.

## Risks and mitigations

- **R1 — Two new backend domains (tasks + appointments) in one PR is larger than either alone.** **Mitigation**: they're independent (tasks doesn't depend on appointments). Independent migrations, independent services, independent tests. The PR is bigger but the review is cleaner because each domain is self-contained.
- **R2 — Read-only tasks v1 means caregivers can't mark items done from the demo.** **Mitigation accepted**: pathway runtime is the primary creator/manager at MVP; manual write UI lands as BL-NNN. Seeded data drives the demo.
- **R3 — `/_auth/patients` list route deletion breaks direct links.** **Mitigation**: existing internal links go through TanStack Router's typed routes — compile-time check catches breakage. External bookmarks 404 cleanly; acceptable PoC behaviour.
- **R4 — Caregivers may need to "browse all patients" outside the inbox.** **Mitigation accepted**: PoC seed cohort is small (<100 patients); inbox covers attention items. If a stakeholder asks for a directory, file a follow-up.
- **R5 — Patient-driven visibility means tasks "belonging" to another caregiver are still visible.** This is intentional (D23) — supports team handover when colleagues are out. The `assigned_user_id=me` filter is the opt-in personal-view.
- **R6 — Frozen-after-create participants on appointments forces delete-and-recreate to change attendees.** **Mitigation accepted**: PoC clinical reality. Filed as BL-073.
- **R7 — Empty Metingen + Labresultaten tabs read as broken in demo.** **Mitigation**: `<EmptyState>` copy explicitly says "wordt geleverd door X".
- **R9 — Mobile (<md) split-pane fallback per D17.** Inbox item click navigates to `/_auth/patients/$patientId` standalone (no inbox column). Browser back returns to inbox.
- **R10 — `entered-in-error` FHIR status hyphen vs Python identifier.** Stored as `entered_in_error`, serialised as `entered-in-error`. Tested round-trip.

## Out of scope

- Task write actions (create, edit, complete, delete) — BL-081 follow-up.
- Frontend write actions on appointments (create, edit, delete, status change, participants) — BL-072.
- Patient-facing read of tasks / appointments (mobile app) — BL-078.
- Real data wiring for `Metingen` and `Labresultaten` tabs — BL-074, BL-075.
- Realtime invalidation topic for tasks / appointments — BL-076.
- Conflict / double-booking detection on appointments.
- Recurrence, reminders, notifications.
- Seeded synthetic appointments — BL-077 (cheap follow-up).
- A `smart` or `embed` surface for inbox or detail.
- Create-patient action (BL-055).
- Identifier mutation, soft-delete flows beyond `patient-profile-ui` prior.
- Pathway runtime materialising appointments OR tasks (BL-038); `pathway_block_instance_id` FK addition is BL-079.
- A patient-directory browser to replace the deleted `/_auth/patients` list.
- Persisting the master-hidden toggle in the URL (session-local UI state per D15).
