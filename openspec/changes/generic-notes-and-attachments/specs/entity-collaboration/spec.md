## ADDED Requirements

### Requirement: Notes and attachments are generic over the owner entity and keyed to a patient

The backend SHALL persist two polymorphic, tenant-owned tables — `notes` and `attachments` — each with `owner_type` (enum `owner_type`: `appointment | task | patient`), `owner_id` (UUID, NO foreign key), and `patient_id` (UUID, FK `patients.id`, NOT NULL — the patient the item is about). `notes` adds `author_user_id` + `body` (append-only). `attachments` adds `uploaded_by`, `filename`, `content_type`, `size`, `storage_key` (unique), with bytes on S3 via presigned URLs. Both declare `__realtime_resource__` + `__audited__`. The appointment-specific `appointment_notes` / `appointment_attachments` tables are REMOVED and replaced by these.

A shared, authz-free `NoteService`/`AttachmentService` (+ repositories) serve every owner, parameterised by `(owner_type, owner_id, patient_id)`; the attachment service reuses the existing S3 storage with `storage_key = "{owner_type}/{owner_id}/{uuid}/{filename}"` and the 50 MB cap.

#### Scenario: Generic tables created, appointment-specific tables dropped

- **WHEN** the database is migrated to head
- **THEN** `notes` + `attachments` + the `owner_type` enum exist, and `appointment_notes` + `appointment_attachments` do NOT

#### Scenario: Every item records its subject patient

- **WHEN** a note or attachment is created on any owner
- **THEN** its `patient_id` MUST be set to the owner's patient (appointment→`patient_id`, task→`patient_id`, patient→self); a task with no patient MUST yield `422`

### Requirement: Per-entity routes enforce that entity's access, then delegate to the shared service

The backend SHALL expose nested notes + attachments routes under each owner, each guarded by that entity's existing access dependency and delegating to the shared service with the resolved owner + patient:

- `/appointments/{id}/notes` + `…/attachments` — appointment visibility guard.
- `/tasks/{id}/notes` + `…/attachments` — task assignee/admin guard.
- `/patients/{id}/notes` + `…/attachments` — patient-access guard.

Authorization MUST live in the route, never in the shared service.

#### Scenario: Owner access is enforced per entity

- **WHEN** a caller without access to a given owner posts a note/attachment to it
- **THEN** the response MUST be `404`/`403` per that entity's guard, and nothing is created

#### Scenario: Same service backs all owners

- **WHEN** notes/attachments are created on an appointment, a task, and a patient
- **THEN** all three MUST persist into the same `notes`/`attachments` tables via the same service, differing only by `owner_type`/`owner_id`

### Requirement: A patient view aggregates all notes + attachments about the patient

The backend SHALL expose `GET /patients/{id}/notes` and `GET /patients/{id}/attachments` (patient-access guarded) returning ALL items whose `patient_id` matches — across every owner type — newest-first, each item carrying its `owner_type` (and owner id) so the UI can group by type and by where it was added.

#### Scenario: Aggregate spans owner types

- **WHEN** a patient has a note added on an appointment and a document added on a task
- **THEN** `GET /patients/{id}/notes` returns the appointment note and `GET /patients/{id}/attachments` returns the task document, each tagged with its `owner_type`

### Requirement: Reusable frontend notes + attachments panels

The orchestrator SHALL provide domain-neutral `<NotesPanel ownerType ownerId>` and `<AttachmentsPanel ownerType ownerId>` components (with a generic api/hooks layer keyed by `(ownerType, ownerId)`) consumed by the appointment detail, the task detail, and the patient profile. The patient profile SHALL additionally render an aggregate "Notities & documenten" view grouping all items about the patient by type and by owner.

#### Scenario: One panel implementation, many owners

- **WHEN** the appointment detail, task detail and patient profile render their notes/attachments
- **THEN** they MUST use the same `<NotesPanel>` / `<AttachmentsPanel>` components, differing only by the `ownerType`/`ownerId` props
