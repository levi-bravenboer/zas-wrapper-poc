# Tasks — generic-notes-and-attachments

**Ordering**: build generic backend → migrate (drop appointment-specific, create generic) → per-entity routes → remove old appointment collab → frontend panels → consumers → verify.

## 1. Generic domain (backend)
- [ ] `app/core/enums/collaboration.py` — `OwnerType` (`appointment`, `task`, `patient`).
- [ ] `app/db/models/collaboration/note.py` — `Note(TenantOwnedEntity)`: `owner_type`, `owner_id` (no FK), `patient_id` (FK patients, NOT NULL), `author_user_id`, `body`. `__realtime_resource__="notes"` + `__audited__`.
- [ ] `app/db/models/collaboration/attachment.py` — `Attachment(TenantOwnedEntity)`: `owner_type`, `owner_id`, `patient_id` (FK), `uploaded_by`, `filename`, `content_type`, `size`, `storage_key` (unique). realtime + audited.
- [ ] Register models; add `Note`/`Attachment` to audited-set conformance.
- [ ] Indexes: `(owner_type, owner_id)` open; `patient_id` open; unique `storage_key`.

## 2. Repositories + services (shared, authz-free)
- [ ] `app/repositories/collaboration/note_repository.py` — `list_for_owner`, `list_for_patient`, `add`.
- [ ] `app/repositories/collaboration/attachment_repository.py` — `list_for_owner`, `list_for_patient`, `add`, `get`, `soft_delete`.
- [ ] `app/services/collaboration/note_service.py` — `list_for_owner`, `list_for_patient`, `add` (owner_type, owner_id, patient_id, author).
- [ ] `app/services/collaboration/attachment_service.py` — same + presign create/url/delete; reuse `S3Storage`, `storage_key = {owner_type}/{owner_id}/{uuid}/{filename}`, 50 MB cap, uploader-only delete.
- [ ] Schemas `NoteRead`/`NoteCreate`, `AttachmentRead`/`AttachmentCreate`/`AttachmentUploadResponse`/`AttachmentDownload` (+ `owner_type` on reads for the aggregate).

## 3. Migration
- [ ] Drop `appointment_notes` + `appointment_attachments`; create `owner_type` enum + `notes` + `attachments` (+ indexes). Chain after `split` head.

## 4. Per-entity routes (each its own access guard → shared service)
- [ ] Owner-patient resolver per type: appointment→patient_id, task→patient_id (422 if null), patient→self.
- [ ] `/appointments/{id}/notes|attachments` — `AppointmentAccessDep`.
- [ ] `/tasks/{id}/notes|attachments` — task assignee/admin guard.
- [ ] `/patients/{id}/notes|attachments` — `PatientAccessDep`.
- [ ] Patient aggregate: `GET /patients/{id}/notes` + `…/attachments` return ALL about the patient across owners, each tagged `owner_type`, newest-first.
- [ ] Register routers.

## 5. Remove appointment-specific collab
- [ ] Delete `app/db/models/appointment/appointment_note.py` + `appointment_attachment.py`, their repos/services/deps/errors/schemas, `note_router.py` + `attachment_router.py`.
- [ ] Move/rewrite the appointment notes/attachments tests onto the generic appointment routes.

## 6. Contract + frontend
- [ ] Regen OpenAPI + types.
- [ ] `modules/collaboration/` — generic api/hooks keyed by `(ownerType, ownerId)`; `<NotesPanel>` + `<AttachmentsPanel>` (extract from appointment detail).
- [ ] Appointment detail → use the generic panels.
- [ ] Task detail → add notes + attachments panels.
- [ ] Patient profile → notes + attachments panel(s) for owner=patient, AND an aggregate "Notities & documenten" view (all about the patient, grouped by type + owner_type label).

## 7. Verify
- [ ] `cd apps/backend && uv run python -m pytest` (full); typecheck/lint.
- [ ] `moon run orchestrator:typecheck orchestrator:lint` + tests.
- [ ] Seed: a couple demo notes/attachments across owners so the patient aggregate shows the grouping.
