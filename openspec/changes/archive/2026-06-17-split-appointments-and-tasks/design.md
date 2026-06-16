# Design — split-appointments-and-tasks

Split the conflated `/tasks` projection into two real things: appointments (first-class read surface + own UI) and tasks (a real stored domain). Remove the projection that pretended appointments were tasks.

## Current state (what we're changing)

- `app/services/tasks/` — `TasksAggregator` + `sources/appointment_source.py` project appointments into a `TaskItem`. `app/schemas/task/task_item.py` = the projection envelope. **All removed.**
- `app/db/models/task/task_read_state.py` + `repositories/task/task_read_state_repository.py` — per-user appointment read-state. **Removed** (superseded by `Task.status`).
- `app/api/routers/task/task_router.py` — `GET /tasks`, `GET /tasks/{source}/{source_id}` over the aggregator. **Rewritten** against the real task domain.
- Appointments (`app/db/models/appointment/`) have a model + validator but **no HTTP routes**. **Added.**
- Orchestrator `modules/tasks/` + `routes/_auth/tasks/` render the appointment-inbox. **Taken rewritten; Afspraken added.**

## Decisions

### D-SPLIT — two surfaces, two domains

`Afspraken` (appointments) and `Taken` (tasks) are independent menu items, routes, views, backend endpoints. Neither projects the other. An appointment MAY later spawn a task (via `source_ref`), but they are not the same row and not the same surface.

### D-TASK-MODEL — `Task` is a first-class `TenantOwnedEntity`

```python
class Task(TenantOwnedEntity):  # tenant_id + audit cols inherited
    assignee_user_id: UUID        # FK users.id ON DELETE RESTRICT — the caregiver
    title: str                    # varchar(255)
    description: str | None        # text
    status: TaskStatus            # enum task_status: open | done (default open)
    due_at: datetime | None        # timestamptz, nullable
    patient_id: UUID | None        # FK patients.id ON DELETE RESTRICT, nullable
    source_ref: str | None         # opaque origin pointer e.g. "appointment:<uuid>", NO FK
```

- `TaskStatus = open | done` only at MVP (no `in_progress` until a workflow needs it). Completion is a status flip, not a soft-delete.
- `source_ref` is free-text, no FK: a task may originate from any domain (or none). Keeps tasks decoupled from appointments — the whole point of the split.
- Visibility: a caregiver sees tasks where `assignee_user_id == caller.id` (admins: tenant-wide). No care-team predicate needed — assignment is explicit.

Alternative rejected: reuse `task_read_state`'s `(source, source_id)` shape. That modelled "appointment seen", not "work assigned". Real tasks need an assignee + status, which read-state never had.

### D-APPT-READ — appointments get a direct read API, reusing the existing predicate

`GET /appointments` + `GET /appointments/{id}` move the window + participant-visibility logic out of `AppointmentSource` into an appointment read service/repository. Same predicate (`status='booked'` window + active `appointment_participant` for the caller, or admin tenant-wide), now returning an `AppointmentRead` (not a `TaskItem`). The detail route stays patient-access-gated via the existing `require_patient_access` for the linked patient.

**Guard layering (consequence of external note authors).** Because external collaborators (referring GP etc.) may author notes, they must be able to open the appointment detail. So:
- **List** `GET /appointments` (the Afspraken rail) — internal only: `ADMIN | CAREGIVER` + participant scope. External users do not browse appointments.
- **Detail + notes + attachments** `GET /appointments/{id}`, `.../notes`, `.../attachments` — **patient-access-based** via `require_patient_access`, which already admits external grant-holders. NOT a hard `ADMIN|CAREGIVER` role gate. This lets an external collaborator with a grant to the patient open the appointment and add a note, while keeping the list internal.

### D-AFSPRAKEN-UI — Afspraken reuses the rail pattern via extracted neutral primitives

The Afspraken view reuses the **layout pattern** the current Taken view already has (master-detail rail + date-grouped list), minus the inbox affordances (unread dot, mark-on-open, polling-as-inbox — appointments are scheduled, not read/unread). It does NOT reuse the `Task`-coupled components directly.

Instead, the shared presentation is **extracted into domain-neutral primitives** (named after what they ARE, not after tasks or appointments), consumed by both `modules/tasks` (real tasks) and `modules/appointment` (Afspraken):

- `<MasterDetailRail>` — the two-column rail+detail shell (currently inline in `routes/_auth/tasks/route.tsx`).
- `<GroupedList>` + `<GroupedListSection>` — date/section grouping (the `MORGEN / VR 19 JUN` headers).
- `<RailRow>` — leading icon tile + primary line + secondary line + optional trailing slot (generalises `TaskRow`; the unread dot becomes an optional `trailing` slot the caller supplies).
- `<RailEmptyState>` / `<RailSelectionEmptyState>` — the "geen items" / "selecteer" panels.

Home for the primitives: `apps/orchestrator/src/components/rail/` (presentation, no domain imports). Taken passes a status/unread trailing slot; Afspraken passes time/location — same primitives, different data adapters. Detail panes both reuse `<EntityDetailPage>`.

### D-APPT-DETAIL — custom appointment detail: info + authored notes + tracked attachments

The appointment detail is a **custom view** that borrows proven UI patterns from the patient profile (`<EntityDetailPage>` header chrome, tab strip, card sections) but is appointment-specific. Sections:

1. **Appointment info** — time/window, kind, modality, location, status, participants, linked patient summary + a prominent **"open patiënt"** action that jumps to the patient profile (`/_auth/patients/$patientId`). Clinical data (measurements/labs) is NOT duplicated here — the quick link is how you get to it.
2. **Notes** — anyone with appointment access (internal staff + external collaborators) can add a note before/during the appointment. Attributed feed (author + timestamp via `users.display_name`). New domain: `appointment_notes` (`appointment_id` FK, `author_user_id` FK, `body` text, timestamps). **Append-only** (no edit/delete).
3. **Attachments** — documents attached to the appointment, tracking uploader + time. New domain: `appointment_attachments` (`appointment_id` FK, `uploaded_by` FK, `filename`, `content_type`, `size`, `storage_key`, timestamps). List + upload + download + **uploader soft-deletes own** (DELETE sets `deleted_at`; S3 bytes left to a lifecycle rule, not deleted inline).

**Realtime + audit.** `Task`, `appointment_notes`, `appointment_attachments` all declare `__realtime_resource__` (so a note/attachment another user adds appears live via the existing realtime-invalidation provider) AND `__audited__ = True` (the merged audit-trail records who created/deleted — clinical notes especially).

### D-STORAGE — attachments on S3-compatible object storage (MinIO local → S3 in AWS)

Attachment bytes live in **S3-compatible object storage**, accessed via the S3 API (`boto3`/`aioboto3`) against a configurable endpoint.

**Why MinIO, not LocalStack.** The deployed stack is mostly self-hosted containers — Temporal (runtime), backend, orchestrator, Kratos — none of which are AWS-managed services LocalStack emulates. The *only* AWS-managed service in scope is S3 (attachments). LocalStack's value is broad multi-service emulation we don't need; MinIO covers the single S3 need, boots lighter, and is itself production-capable object storage. So: MinIO local, real S3 in AWS.

- **Local dev**: a `zas_minio` container in `docker-compose.yml`; bucket auto-created on boot (one-shot init).
- **AWS**: point the same client at real **S3 in an EU region** (Belgian data-residency); the deploy track provisions the bucket + IAM role. No code change — only config differs.
- **Transfer**: presigned PUT (upload) / presigned GET (download) — bytes never proxy through the API. The API only writes/reads the `appointment_attachments` metadata row + mints presigned URLs. (Proxy-through-API was considered as a simpler local fallback but rejected: it routes PHI bytes through the app and is less AWS-ideal.)

**Presign host split (local only).** SigV4 signs the host, and the browser cannot resolve the docker service name. So two endpoints locally:
- `BACKEND_S3_ENDPOINT_URL=http://minio:9000` — server-side ops (bucket create, head).
- `BACKEND_S3_PUBLIC_URL=http://localhost:9000` — used ONLY to mint presigned URLs the browser hits.

The backend only *mints* the public URL (never calls it), so it needs no route to `localhost:9000`. In AWS both collapse to the one real S3 host — no split. Config: `BACKEND_S3_ENDPOINT_URL`, `BACKEND_S3_PUBLIC_URL`, `BACKEND_S3_BUCKET`, `BACKEND_S3_REGION`, creds (local static; AWS via IAM role).

### D-PATIENT-APPTS-TAB — patient profile Afspraken tab; subject vs attendee

The patient profile (`patient-profile-ui`) gains an **Afspraken** tab listing appointments related to the patient under two relations:

- **About (subject)** — `appointments.patient_id == patient` (the existing link; the appointment is about this patient).
- **With (attendee)** — the patient attends an appointment whose subject is someone else. This needs a NEW patient-attendee link: appointments today only have *user* participants (`appointment_participants`). Add `appointment_patient_attendees` (`appointment_id` FK, `patient_id` FK, timestamps) so a patient can be an attendee distinct from the subject.

The tab unions both, labelled (e.g. an "Over patiënt" / "Met patiënt" grouping or badge). The Afspraken main view (caregiver) still keys off user-participant visibility; the patient tab is patient-keyed.

### D-REMOVE — delete the projection + read-state

`TasksAggregator`, `AppointmentSource`, `TaskItem`/`AppointmentPayload` schemas, `task_read_state` (model + repo + table) are deleted. The `task_read_state` drop is a migration (the table was added in the prior change). Appointments do not get read-state in their new view; if "seen appointments" is wanted later, it is a separate, appointment-owned concern.

## Migration

- Add `tasks` table + `task_status` enum.
- Drop `task_read_state` table + `uq_task_read_state_*` indexes.
- `appointments` untouched.

## Test focus

- Backend: `Task` model + migration; `TaskRepository.list` filters by assignee; `TaskService` create/complete; `GET/POST/PATCH /tasks`; `GET /appointments` honours the participant predicate (caregiver sees only their appointments; admin tenant-wide); `GET /appointments/{id}` 404s outside visibility (existence hiding).
- Removal: no `/tasks/{source}/{source_id}` route; no `task_read_state` table; no `TaskItem` schema in OpenAPI.
- Frontend: Afspraken nav + list + detail render; Taken reads real tasks (empty state when none); both routes guarded `ADMIN|CAREGIVER`.
