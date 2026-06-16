**Tier**: [mvp]
**Promotes**: a correct domain split — appointments are scheduled clinical events with their own surface; tasks are assignable work items for a caregiver, a real domain of their own.

## Why

The `patient-inbox` change shipped `/tasks` as a **projection whose only source is appointments** — `TaskItem.id == appointment.id`, `payload: AppointmentPayload`, aggregator hardcoded to `{"appointment": ...}`. In the UI this surfaces as the **"Taken"** inbox that is, in fact, a list of appointments wearing a task costume.

That conflation is wrong on both sides:

- **Appointments deserve their own surface.** A scheduled clinical event (afspraak) is not a to-do. Clinicians expect a dedicated **Afspraken** menu + view, and the appointment domain currently ships with **no HTTP routes at all** — it is only readable through the `/tasks` aggregator. Appointments cannot stand on their own today.
- **Tasks should be a real domain.** A "task" is an assignable unit of work for a specific caregiver (user) — it has an assignee, a status, a due date, optionally a patient or an originating event. None of that exists: there is no `tasks` table, no `Task` model, no task service/repository. The projection cannot represent a task that is not an appointment.

This change **splits the two**: appointments get a first-class read surface + their own menu/view, and tasks become a real, stored domain with a service, repository, endpoints, and a frontend that reads actual tasks.

## What Changes

### New first-class appointment read surface (`appointment-base`)

- **Backend read API.** `GET /appointments` (list, caller-scoped by the existing appointment-participant visibility predicate + tenant) and `GET /appointments/{appointment_id}` (read-one). Same window/visibility rules the aggregator used, now on the appointment domain directly.
- **Patient attendees.** New `appointment_patient_attendees` table so a patient can *attend* an appointment whose subject (`patient_id`) is someone else — enabling the "about vs with" split on the patient profile.
- **Orchestrator "Afspraken" surface.** New sidebar nav item + route (`/_auth/appointments`) + view, built from extracted domain-neutral rail primitives (`components/rail/`) shared with Taken — reusing the proven master-detail rail pattern, minus the inbox affordances (no unread dot, no polling).
- **Custom appointment detail** (borrows patient-view UI patterns): appointment info + an **"open patiënt"** jump to the patient profile (clinical data is not duplicated here) + **append-only notes** (anyone with appointment access — internal staff AND external collaborators — attributed) + **document attachments** (uploader-tracked; any type, 50 MB; uploader can delete own).

### Appointment collaboration — notes + attachments (`appointment-collab`)

- **`appointment_notes`** — append-only, attributed (`appointment_id`, `author_user_id`, `body`, timestamps). List + add. Authorship guarded by appointment visibility (admits internal staff + external grant-holders), not a fixed role set.
- **`appointment_attachments`** — metadata row (`appointment_id`, `uploaded_by`, `filename`, `content_type`, `size`, `storage_key`, timestamps) + bytes on **S3-compatible object storage** (MinIO locally, real S3 in an EU region on AWS). Presigned PUT (upload) / GET (download); bytes never proxy through the API. Uploader can soft-delete own.
- **Realtime + audit**: `Task`, `appointment_notes`, `appointment_attachments` declare `__realtime_resource__` (live list/feed updates) + `__audited__ = True` (audit-trail capture).

### Patient profile — Afspraken tab (`patient-profile-ui`)

- New **Afspraken** tab on the patient profile listing the patient's appointments under two relations: **about** (`patient_id` subject) and **with** (patient is an attendee via `appointment_patient_attendees`).

### New real task domain (`tasks-base`, rewritten)

- **`tasks` table + `Task` model** (`TenantOwnedEntity`): `assignee_user_id` (FK users — the caregiver the task is for), `title`, `description?`, `status` (enum `task_status`: `open` | `done`), `due_at?`, `patient_id?` (optional link), `source_ref?` (optional free-text origin pointer, e.g. `"appointment:<uuid>"`, NO FK — a task may originate from any domain).
- **`TaskRepository`** (`BaseListRepository`) + **`TaskService`** (list-for-assignee, get, create, complete).
- **Endpoints.** `GET /tasks` (caller's tasks), `GET /tasks/{id}`, `PATCH /tasks/{id}` (status). **No `POST /tasks` route / no create UI** — creation + assignment are `TaskService` functions used by seeds + future producers. `/tasks` returns **real tasks**, empty until something produces them.
- **Orchestrator "Taken" view** reads the real task domain. Status (`open`/`done`) replaces the appointment "opened" read-state.

### Removed: the appointment-as-task projection

- The `/tasks` aggregator, `AppointmentSource`, the `TaskItem` projection envelope, and `task_read_state` (the per-user appointment read-state) are **removed** — superseded by the appointment read API and the real `Task.status`.

## Capabilities

### Added Capabilities

- `appointments-ui` — orchestrator "Afspraken" nav item + `/_auth/appointments` master-detail rail (via shared `components/rail/` primitives) + custom appointment detail (info + notes + attachments).
- `appointment-collab` — `appointment_notes` (append-only, attributed) + `appointment_attachments` (uploader-tracked, S3-backed) with their read/add/upload/download APIs.

### Modified Capabilities

- `appointment-base` — gains a first-class HTTP read API (`GET /appointments`, `GET /appointments/{id}`) with caller-scoped participant visibility; adds `appointment_patient_attendees` (patient-as-attendee). No longer readable only via `/tasks`.
- `tasks-base` — **rewritten** from a source-projection aggregator into a real task domain: `tasks` table + `Task` model, `TaskRepository`, `TaskService`, CRUD-ish endpoints, `task_status` enum. The appointment source, `TaskItem` projection, and `task_read_state` are removed.
- `patient-profile-ui` — gains an **Afspraken** tab (appointments about/with the patient).
- `local-runtime` — adds a `zas_minio` S3-compatible storage container for attachment bytes.

## Impact

- **DB**: new tables — `tasks` (+ `task_status` enum), `appointment_patient_attendees`, `appointment_notes`, `appointment_attachments`. **Drop `task_read_state`** (superseded). `appointments` unchanged. One migration.
- **Infra**: new `zas_minio` S3-compatible container in `docker-compose.yml` (+ bucket init). New backend config: `BACKEND_S3_ENDPOINT_URL` / `BACKEND_S3_BUCKET` / `BACKEND_S3_REGION` / creds. AWS PoC deploy provisions a real EU-region S3 bucket (separate deploy track).
- **Backend** (`apps/backend/app/`): new `Task` model/enum/repo/service + rewritten `task_router`; new `appointment` read service + `appointment_router`; `appointment_patient_attendees`, `appointment_notes`, `appointment_attachments` models + repos + services; an S3 client wrapper (`services/storage/`) + presign endpoints. Remove `services/tasks/` (aggregator + sources), `schemas/task/task_item.py`, `task_read_state` model + repo.
- **Frontend** (`apps/orchestrator/src/`): new `components/rail/` neutral primitives; `modules/appointment/` + `routes/_auth/appointments/` (Afspraken list + custom detail with notes + attachments); rewrite `modules/tasks/` to the real task domain via the rail primitives; patient-profile Afspraken tab; Afspraken nav item.
- **OpenAPI / typed client**: regenerated (new `/appointments`, notes, attachments, presign ops; `/tasks` shape change).

## Risks and mitigations

- **R1 — Removing `task_read_state` so soon after adding it.** It was built for the mislabeled appointment-inbox; the real `Task.status` supersedes it. **Mitigation**: clean drop migration; appointments do not need read-state in their new (different) view.
- **R2 — "What is a task" is under-defined beyond appointments.** **Mitigation**: ship the generic assignable-task shape (assignee + title + status + optional links); concrete task producers (e.g. "review monitoring alert") are separate follow-ups. `/tasks` is legitimately empty at first.
- **R3 — Two surfaces (Afspraken + Taken) where there was one.** **Mitigation**: nav copy makes the split explicit; Afspraken is the scheduled-events agenda, Taken is the work queue.
- **R4 — Attachment documents are PHI; object storage must respect Belgian residency.** **Mitigation**: the real bucket lives in an EU region; MinIO is local-dev only with synthetic data. Presigned URLs are short-TTL. No real patient documents in dev/demo fixtures.
- **R5 — S3 client + presign is new infra surface (auth on presign, size cap).** **Mitigation**: presign endpoints are guarded by appointment visibility; enforce a 50 MB max size server-side before minting a PUT URL. No content-type allow-list at this tier (any type) — revisit if abuse surfaces.
- **R6 — Patient-attendee link widens patient visibility (a patient now appears under appointments they only attend).** **Mitigation**: the patient-profile Afspraken tab is already patient-access-gated; the attendee link does not grant any new caregiver-side visibility.

## Security & residency

- Appointment notes + attachment bytes are **PHI**. The attachment bucket MUST be an EU-region S3 (Belgian data-residency); MinIO is dev-only. Presigned URLs are short-lived; uploads are size/content-type capped server-side. No real patient data in fixtures, per `openspec/project.md`.
- **MDR check**: notes are free-text human records, attachments are documents — no clinical decision logic, no diagnostic output, no interpretation of Luscii measurements. Not MDR. (If notes later drive automated clinical logic, re-evaluate.)

## Out of scope

- Concrete task **producers** (auto-creating a task from a monitoring alert / returned questionnaire) — the domain ships; producers are follow-ups.
- Task assignment/reassignment workflows, sub-tasks, comments, priority beyond `status`.
- Appointment **write** routes (create/reschedule/cancel) — read surface only here; writes stay out until the HiX/pathway-runtime path lands.
- Calendar/timeline visualisation polish for Afspraken beyond a scheduled list.
- Re-introducing a multi-source task aggregator — explicitly reversed by this change.
