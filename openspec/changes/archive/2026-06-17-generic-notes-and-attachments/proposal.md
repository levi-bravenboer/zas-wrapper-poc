**Tier**: [mvp]
**Promotes**: a reusable collaboration layer — attributed notes + document attachments that any entity (appointment, task, patient, …) plugs into, all patient-keyed so a patient view can show everything about them.

## Why

`split-appointments-and-tasks` shipped notes + attachments, but **bolted to appointments** (`appointment_notes`, `appointment_attachments`, appointment-only models/repos/services/routers, and appointment-coupled frontend sections). The moment we want the same on **tasks** or directly on a **patient**, we'd copy that whole stack again per entity — three near-identical implementations.

We want the opposite: build the notes + file subsystem **once**, generic over the owner entity, with reusable backend (service/repo/storage) + reusable frontend panels. Adding it to a new entity becomes "wire one access guard + drop in a panel", not "rebuild it".

Two product needs drive the shape:
1. **Any entity** can carry notes + documents (appointments, tasks, patients now; more later).
2. **Always about a patient.** Every note/attachment records the patient it concerns, so the patient detail view can surface **all** notes + documents about that patient — grouped by **type** (note / document) and by **where it was added** (the owner: "op afspraak X", "op taak Y", "op patiënt").

## What Changes

### New capability — `entity-collaboration`

- **Two generic tables**, replacing the appointment-specific ones:
  - `notes` — `owner_type` (enum), `owner_id` (UUID, no FK — polymorphic), `patient_id` (FK patients, the subject), `author_user_id`, `body`. Append-only.
  - `attachments` — `owner_type`, `owner_id`, `patient_id`, `uploaded_by`, `filename`, `content_type`, `size`, `storage_key`. Uploader soft-deletes own.
  - `OwnerType` enum: `appointment | task | patient`.
- **Shared backend**: one `NoteService`/`NoteRepository` + one `AttachmentService`/`AttachmentRepository` parameterised by `owner_type` + `owner_id`, reusing the existing `S3Storage` (key = `{owner_type}/{owner_id}/{uuid}/{filename}`). The service is **authz-free**; each route supplies access.
- **Per-entity nested routes**, each enforcing that entity's own access guard then delegating to the shared service:
  - `GET/POST /appointments/{id}/notes`, `…/attachments` (+ url, delete) — appointment visibility guard.
  - `GET/POST /tasks/{id}/notes`, `…/attachments` — task assignee/admin guard.
  - `GET/POST /patients/{id}/notes`, `…/attachments` — patient-access guard.
  - The route resolves `patient_id` from the owner (appointment→`patient_id`, task→`patient_id`, patient→self) and passes it to the service.
- **Patient aggregate read**: `GET /patients/{id}/collaboration` (or `…/notes` + `…/attachments` returning ALL items about the patient across owners), each item tagged with its `owner_type` + a display label, so the patient view can group by type + source.
- **Replace, don't keep**: delete `appointment_notes`/`appointment_attachments` tables + their appointment-specific models/repos/services/routers (added in the not-yet-merged `split` branch — no prod data to migrate).

## Capabilities

### Added Capabilities

- `entity-collaboration` — generic `notes` + `attachments` (polymorphic owner, patient-keyed) + shared service/repo/storage + per-entity nested routes + patient aggregate read + reusable `<NotesPanel>` / `<AttachmentsPanel>` frontend.

### Modified Capabilities

- `appointment-collab` — **superseded**: its appointment-specific notes/attachments are replaced by `entity-collaboration`. The appointment detail consumes the generic panels.
- `tasks-base` — task detail gains notes + attachments (generic).
- `patient-profile-ui` — patient profile gains a notes + documents view aggregating everything about the patient, grouped by type + owner.

## Impact

- **DB**: drop `appointment_notes` + `appointment_attachments`; create `notes` + `attachments` + `owner_type` enum. One migration (chained after `split`'s).
- **Backend**: generic `app/db/models/collaboration/{note,attachment}.py`, `app/core/enums/collaboration.py` (`OwnerType`), `app/repositories/collaboration/`, `app/services/collaboration/` (note + attachment service, owner-parameterised), per-entity routers (appointment/task/patient notes+attachments) + patient aggregate. Remove `app/db/models/appointment/appointment_note.py` + `appointment_attachment.py`, their repos/services/routers/schemas.
- **Frontend**: extract `<NotesPanel ownerType ownerId>` + `<AttachmentsPanel ownerType ownerId>` (+ a generic api/hooks factory) into a shared `modules/collaboration/`. Appointment detail, task detail, patient profile all consume them. Patient profile adds an aggregate "Notities & documenten" view.
- **OpenAPI / types**: regenerated.

## Risks and mitigations

- **R1 — Polymorphic `owner_id` has no FK; orphaned rows when an owner is deleted.** **Mitigation accepted**: owners soft-delete; an orphan-sweep can run later. `patient_id` keeps an FK so the patient axis stays clean.
- **R2 — `patient_id` required, but a task may have no patient.** **Mitigation**: notes/attachments require a patient; the task route 422s if the task has no `patient_id` (you can only collaborate on patient-linked tasks). Revisit if patientless-task collaboration is needed.
- **R3 — One generic service, three access models.** **Mitigation**: authz lives in the per-entity route (its access dep), never in the shared service — the service trusts a resolved `(owner_type, owner_id, patient_id)`.
- **R4 — Refactoring fresh appointment-collab code.** **Mitigation**: it is unmerged; replace in place, no data migration, tests move with it.

## Out of scope

- Notes edit/delete (still append-only); attachment delete stays uploader-only.
- Owner types beyond appointment/task/patient.
- Cross-entity search / a global collaboration feed (only patient-axis aggregate).
- Realtime wiring nuances (tracked in `split` follow-up).
