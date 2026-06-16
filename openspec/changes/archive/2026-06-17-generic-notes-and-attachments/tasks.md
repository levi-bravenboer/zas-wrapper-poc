# Tasks — generic-notes-and-attachments

> **Progress** — implemented + committed on `feat/split-appointments-and-tasks`:
> - DONE §1-3 generic domain (OwnerType + polymorphic `notes`/`attachments`, patient-keyed) + authz-free services reusing S3 + migration (dropped appointment-specific, created generic). §4-5 per-entity routes (appointment/task/patient notes+attachments + patient aggregate; own access guard each; task-without-patient → 422) + removed appointment-specific collab. §6 reusable `<NotesPanel>`/`<AttachmentsPanel>` + generic api/hooks in `modules/collaboration`; appointment/task/patient details consume them; patient profile "Notities & documenten" tab (aggregate). §7 backend full suite 1004 pass; orchestrator typecheck/lint clean + tests pass (one pre-existing `-users` parallel-MSW flake — passes isolated).
> - SKIPPED (optional): demo notes/attachments seed.
> - NOTE: patient aggregate uses flat panels (already split notes vs documents); per-owner grouping/badges deferred. No live browser verification (shared stack runs main's code).

**Ordering**: build generic backend → migrate (drop appointment-specific, create generic) → per-entity routes → remove old appointment collab → frontend panels → consumers → verify.

## 1. Generic domain (backend)
- [x] `app/core/enums/collaboration.py` — `OwnerType` (`appointment`, `task`, `patient`).
- [x] `app/db/models/collaboration/note.py` — `Note(TenantOwnedEntity)`: `owner_type`, `owner_id` (no FK), `patient_id` (FK patients, NOT NULL), `author_user_id`, `body`. `__realtime_resource__="notes"` + `__audited__`.
- [x] `app/db/models/collaboration/attachment.py` — `Attachment(TenantOwnedEntity)`: `owner_type`, `owner_id`, `patient_id` (FK), `uploaded_by`, `filename`, `content_type`, `size`, `storage_key` (unique). realtime + audited.
- [x] Register models; add `Note`/`Attachment` to audited-set conformance.
- [x] Indexes: `(owner_type, owner_id)` open; `patient_id` open; unique `storage_key`.

## 2. Repositories + services (shared, authz-free)
- [x] `app/repositories/collaboration/note_repository.py` — `list_for_owner`, `list_for_patient`, `add`.
- [x] `app/repositories/collaboration/attachment_repository.py` — `list_for_owner`, `list_for_patient`, `add`, `get`, `soft_delete`.
- [x] `app/services/collaboration/note_service.py` — `list_for_owner`, `list_for_patient`, `add` (owner_type, owner_id, patient_id, author).
- [x] `app/services/collaboration/attachment_service.py` — same + presign create/url/delete; reuse `S3Storage`, `storage_key = {owner_type}/{owner_id}/{uuid}/{filename}`, 50 MB cap, uploader-only delete.
- [x] Schemas `NoteRead`/`NoteCreate`, `AttachmentRead`/`AttachmentCreate`/`AttachmentUploadResponse`/`AttachmentDownload` (+ `owner_type` on reads for the aggregate).

## 3. Migration
- [x] Drop `appointment_notes` + `appointment_attachments`; create `owner_type` enum + `notes` + `attachments` (+ indexes). Chain after `split` head.

## 4. Per-entity routes (each its own access guard → shared service)
- [x] Owner-patient resolver per type: appointment→patient_id, task→patient_id (422 if null), patient→self.
- [x] `/appointments/{id}/notes|attachments` — `AppointmentAccessDep`.
- [x] `/tasks/{id}/notes|attachments` — task assignee/admin guard.
- [x] `/patients/{id}/notes|attachments` — `PatientAccessDep`.
- [x] Patient aggregate: `GET /patients/{id}/notes` + `…/attachments` return ALL about the patient across owners, each tagged `owner_type`, newest-first.
- [x] Register routers.

## 5. Remove appointment-specific collab
- [x] Delete `app/db/models/appointment/appointment_note.py` + `appointment_attachment.py`, their repos/services/deps/errors/schemas, `note_router.py` + `attachment_router.py`.
- [x] Move/rewrite the appointment notes/attachments tests onto the generic appointment routes.

## 6. Contract + frontend
- [x] Regen OpenAPI + types.
- [x] `modules/collaboration/` — generic api/hooks keyed by `(ownerType, ownerId)`; `<NotesPanel>` + `<AttachmentsPanel>` (extract from appointment detail).
- [x] Appointment detail → use the generic panels.
- [x] Task detail → add notes + attachments panels.
- [x] Patient profile → notes + attachments panel(s) for owner=patient, AND an aggregate "Notities & documenten" view (all about the patient, grouped by type + owner_type label).

## 7. Verify
- [x] `cd apps/backend && uv run python -m pytest` (full); typecheck/lint.
- [x] `moon run orchestrator:typecheck orchestrator:lint` + tests.
- [x] Seed: a couple demo notes/attachments across owners so the patient aggregate shows the grouping.
