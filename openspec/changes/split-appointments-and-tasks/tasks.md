# Tasks — split-appointments-and-tasks

**Ordering rule**: never leave the app broken. Appointments get their own read surface *before* `/tasks` stops serving them; infra lands *before* the code that needs it; shared UI primitives *before* the views; regen types *between* backend and frontend.

## 1. Appointment read surface + patient attendees (additive — nothing removed yet)
- [x] `app/db/models/appointment/appointment_patient_attendee.py` — `appointment_patient_attendees` (`appointment_id`, `patient_id`, timestamps); register.
- [x] `app/services/appointment/` read service + repository (booked-window + user-participant visibility, lifted from `AppointmentSource`).
- [x] `AppointmentRead` schema.
- [x] `appointment_router`: `GET /appointments` (internal, `ADMIN|CAREGIVER` + participant scope), `GET /appointments/{id}` (access-based: participant OR `require_patient_access`, admits external grant-holders), `GET /patients/{id}/appointments` (patient-access-gated about/with).
- [x] Patient-keyed query: `patient_id == p` (about) ∪ attendee rows (with).
- [x] Migration: `appointment_patient_attendees`.
- [x] Tests: participant scope, admin tenant-wide, detail 404 hiding, about/with union (5 tests, pass).

## 2. Real task domain + CUTOVER (replaces the appointment-as-task projection)
- [x] `app/core/enums/task.py` — `TaskStatus` (`open`, `done`).
- [x] `app/db/models/task/task.py` — `Task(TenantOwnedEntity)`: `assignee_user_id`, `title`, `description?`, `status`, `due_at?`, `patient_id?`, `source_ref?`. Declares `__realtime_resource__` + `__audited__`.
- [x] `TaskRepository` + `TaskService` (list-for-caller, get, create+assign [service-only], set-status) + `TaskRead`/`TaskStatusUpdate`.
- [x] `task_router` (rewrite `/tasks`): `GET /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}`; `ADMIN|CAREGIVER`; assignee/admin visibility. NO `POST`.
- [x] Deleted the projection: `app/services/tasks/`, `schemas/task/task_item.py`, `task_read_state` model + repo, `appointment_task_repository`. Migration: create `tasks` (+ `task_status`), **drop `task_read_state`**. Audited-set conformance updated (+Task).
- [x] Tests: assignee filter, service create+assign, close-via-status, auth; old aggregator tests replaced. Full suite 1022 passed / 0 failed.

## 3. Storage infra — MinIO (before any attachment code)
- [ ] Add `zas_minio` (S3-compatible) to `docker-compose.yml` (`zas_`-prefixed; volume `zas_minio_data`); one-shot bucket init.
- [ ] `app/services/storage/` — S3 client wrapper (`boto3`/`aioboto3`): presign PUT/GET (mint against `BACKEND_S3_PUBLIC_URL`), 50 MB size guard, no content-type allow-list.
- [ ] Backend `.env`: `BACKEND_S3_ENDPOINT_URL=http://minio:9000`, `BACKEND_S3_PUBLIC_URL=http://localhost:9000`, bucket, creds. (AWS deploy track provisions real EU-region S3 + IAM — out of scope.)

## 4. Appointment notes (backend — no infra dependency)
- [ ] `appointment_note.py` — append-only (`appointment_id`, `author_user_id`, `body`); `__realtime_resource__` + `__audited__`.
- [ ] `GET/POST /appointments/{id}/notes`; guard = appointment visibility (internal + external grant-holders).
- [ ] Migration: `appointment_notes`. Tests: add/attribution (incl. external author), append-only, realtime + audit.

## 5. Appointment attachments (backend — needs §3)
- [ ] `appointment_attachment.py` — metadata (`uploaded_by`, `filename`, `content_type`, `size`, `storage_key`, soft-delete); `__realtime_resource__` + `__audited__`.
- [ ] `GET /…/attachments`, `POST /…/attachments` (presign PUT + metadata), `GET /…/attachments/{aid}/url` (presign GET), `DELETE /…/attachments/{aid}` (uploader-only soft-delete).
- [ ] Migration: `appointment_attachments`. Tests: presign auth, 50 MB guard, uploader-only delete, realtime + audit.

## 6. Contract regen (between backend and frontend)
- [ ] `moon run backend:openapi` + `orchestrator:typegen` — new `/appointments`, notes, attachments ops + `/tasks` real-task shape.

## 7. Frontend — neutral rail primitives (before the views)
- [ ] `components/rail/` — `MasterDetailRail`, `GroupedList` + `GroupedListSection`, `RailRow` (icon + primary + secondary + optional `trailing`), `RailEmptyState`/`RailSelectionEmptyState`. No domain imports. Generalise from `routes/_auth/tasks/route.tsx` + `TaskRow`. Unit tests.

## 8. Frontend — Afspraken (rail + custom detail)
- [ ] `modules/appointment/` — api + hooks + adapter (`AppointmentRead` → rail rows; time/location trailing, no unread/polling).
- [ ] `routes/_auth/appointments/` — list (rail) + `$appointmentId` custom detail: info + **"Open patiënt"** action + **notes** (append-only feed + add box) + **attachments** (upload presigned PUT, download presigned GET, delete own).
- [ ] Sidebar: add "Afspraken" nav item (above Taken).

## 9. Frontend — Taken (rewrite via rail primitives)
- [ ] Rewrite `modules/tasks/` to read real `/tasks` (`TaskRead`) through `components/rail/`; trailing slot = `status`; empty state; drop appointment payload/opened logic.
- [ ] Keep "Taken" nav; guard `ADMIN|CAREGIVER`.

## 10. Frontend — patient profile Afspraken tab
- [ ] Add "Afspraken" tab (after Metingen/Labresultaten) listing about (subject) + with (attendee) appointments, linking to `/_auth/appointments/$appointmentId`.

## 11. Seed + verify
- [ ] Seed: appointments visible via Afspraken (existing `seed_appointments`); add `seed_tasks` demo (assigned to demo caregiver) so Taken isn't empty; optionally demo notes/attendees.
- [ ] `moon run backend:typecheck backend:lint` + backend tests; `moon run orchestrator:typecheck orchestrator:lint` + orchestrator tests.
- [ ] Manual: Afspraken list + detail (open patiënt, add note, upload/download/delete attachment); Taken real tasks; patient Afspraken tab (about/with).
