# Design — generic-notes-and-attachments

Build the notes + attachments subsystem once, generic over the owner entity, patient-keyed. Replace the appointment-specific implementation from `split-appointments-and-tasks`.

## Decisions

### D-POLY — polymorphic owner, patient-keyed

Two `TenantOwnedEntity` tables, both `__audited__` + `__realtime_resource__`:

```python
class OwnerType(StrEnum):  # app/core/enums/collaboration.py
    APPOINTMENT = "appointment"
    TASK = "task"
    PATIENT = "patient"

class Note(TenantOwnedEntity):           # "notes"
    owner_type: OwnerType
    owner_id: UUID                        # no FK (polymorphic)
    patient_id: UUID                      # FK patients.id — the subject (NOT NULL)
    author_user_id: UUID                  # FK users.id
    body: str

class Attachment(TenantOwnedEntity):     # "attachments"
    owner_type: OwnerType
    owner_id: UUID                        # no FK
    patient_id: UUID                      # FK patients.id (NOT NULL)
    uploaded_by: UUID                     # FK users.id
    filename / content_type / size / storage_key
```

Indexes: `(owner_type, owner_id)` for the per-entity list; `patient_id` for the patient aggregate; partial-unique on `storage_key`. `owner_id` has NO FK (any entity) — `patient_id` keeps its FK so the patient axis is integrity-clean.

### D-PATIENT-KEY — every item records the patient it's about

`patient_id` is resolved from the owner at create time and stored on the row:
- owner = appointment → `appointment.patient_id`
- owner = task → `task.patient_id` (422 if the task has no patient)
- owner = patient → the patient itself (`owner_id == patient_id`)

This makes the patient aggregate a single indexed `WHERE patient_id = ?` — no fan-out across owner tables.

### D-SERVICE — one authz-free service per kind, owner-parameterised

`NoteService` / `AttachmentService` take `(owner_type, owner_id, patient_id)` (already access-checked by the route) + the actor. They never check authorization. `AttachmentService` reuses `S3Storage` with `storage_key = f"{owner_type}/{owner_id}/{uuid4()}/{filename}"` + the 50 MB cap. Repos: `list_for_owner(owner_type, owner_id)`, `list_for_patient(patient_id)` (aggregate), `add`, `get`, `soft_delete`.

### D-ROUTES — per-entity nested routes, each its own guard

A small router per (entity × kind), each enforcing the entity's existing access dep, then calling the shared service with the resolved owner + patient:

| Route | Access guard | owner_type | patient_id from |
|---|---|---|---|
| `/appointments/{id}/notes` `…/attachments` | `AppointmentAccessDep` | appointment | appointment.patient_id |
| `/tasks/{id}/notes` `…/attachments` | task assignee/admin | task | task.patient_id |
| `/patients/{id}/notes` `…/attachments` | `PatientAccessDep` | patient | the patient |

Plus the **patient aggregate** (`PatientAccessDep`): `GET /patients/{id}/notes` and `…/attachments` return ALL items about the patient across owners, each carrying `owner_type` + a label hint, ordered newest-first. (The patient-owned and the aggregate read share a path — the aggregate is the patient-owner list broadened to `patient_id` match; spec pins the exact shape.)

Authz stays in routes; the service trusts its inputs (D-SERVICE).

### D-REPLACE — delete the appointment-specific layer

Remove (added on the `split` branch, unmerged): `appointment_notes` + `appointment_attachments` tables; `app/db/models/appointment/appointment_note.py` + `appointment_attachment.py`; their repos/services/deps/errors/routers/schemas. Migration drops the two tables + creates `notes` + `attachments` + the `owner_type` enum. Move the appointment notes/attachments tests onto the generic routes.

### D-FE — reusable panels + generic api factory

Extract from the appointment detail into `modules/collaboration/`:
- `<NotesPanel ownerType ownerId>` — attributed feed + append box (append-only).
- `<AttachmentsPanel ownerType ownerId>` — list + presigned upload + download + delete-own.
- A generic api/hooks layer keyed by `(ownerType, ownerId)` calling the per-entity routes.

Consumers: appointment detail, **task detail** (new), patient profile. Patient profile adds an aggregate **"Notities & documenten"** view: fetch patient notes + attachments, render two groups (type), each sub-grouped/labelled by `owner_type` ("Op afspraak" / "Op taak" / "Op patiënt").

## Migration

- Drop `appointment_notes`, `appointment_attachments`.
- Create `owner_type` enum + `notes` + `attachments` (+ indexes).
- Chained after `split`'s head.

## Test focus

- Generic repo: list-for-owner vs list-for-patient; storage_key shape.
- Each entity's routes enforce the right guard (caregiver/admin/patient-access/appointment-visibility) + resolve patient_id; task with no patient → 422.
- Patient aggregate returns items across owner types, tagged by owner_type.
- Attachment presign auth + 50 MB + uploader-only delete (unchanged behaviour, new home).
- Frontend: panels render + mutate against each owner; patient aggregate groups by type + owner.
