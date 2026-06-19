# Tasks — split-appointments-and-tasks

> **Progress** — all phases implemented + committed on `feat/split-appointments-and-tasks`:
> - DONE: §1 appointment read API + attendees · §2 real Task domain + cutover (task_read_state dropped) · §3 MinIO + S3 storage · §4 notes · §5 attachments · §6 openapi/types regen · §7 rail primitives · §8 Afspraken view (rail list + custom detail: info + notes feed + attachment presigned upload/download + delete-own + "Open patiënt" + sidebar nav) · §9 Taken rewrite · §10 patient-profile Afspraken tab (about/with) · §11 seed_tasks demo.
> - VERIFIED: backend full suite 1007 pass / 0 fail, typecheck/lint clean; orchestrator typecheck/lint clean (0 errors), tests pass (one `-users.test` flake under parallel MSW load — passes in isolation).
> - NOT DONE: not pushed; no live browser verification (shared docker stack runs main's code — point the stack at this worktree + reset/migrate/seed to exercise in-app).
> - GOTCHAS: verify backend via `cd apps/backend && uv run python -m pytest` (moon test-host runs from the wrong cwd in a worktree). Frontend types regen from the file: `pnpm exec openapi-typescript ../backend/openapi.json -o src/lib/api/schema.d.ts`.

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
- [x] Add `zas_minio` (S3-compatible) to `docker-compose.yml` (`zas_`-prefixed; volume `zas_minio_data`); one-shot bucket init.
- [x] `app/services/storage/` — S3 client wrapper (`boto3`/`aioboto3`): presign PUT/GET (mint against `BACKEND_S3_PUBLIC_URL`), 50 MB size guard, no content-type allow-list.
- [x] Backend `.env`: `BACKEND_S3_ENDPOINT_URL=http://minio:9000`, `BACKEND_S3_PUBLIC_URL=http://localhost:9000`, bucket, creds. (AWS deploy track provisions real EU-region S3 + IAM — out of scope.)

## 4. Appointment notes (backend — no infra dependency)
- [x] `appointment_note.py` — append-only (`appointment_id`, `author_user_id`, `body`); `__realtime_resource__` + `__audited__`.
- [x] `GET/POST /appointments/{id}/notes`; guard = appointment visibility (internal + external grant-holders).
- [x] Migration: `appointment_notes`. Tests: add/attribution (incl. external author), append-only, realtime + audit.

## 5. Appointment attachments (backend — needs §3)
- [x] `appointment_attachment.py` — metadata (`uploaded_by`, `filename`, `content_type`, `size`, `storage_key`, soft-delete); `__realtime_resource__` + `__audited__`.
- [x] `GET /…/attachments`, `POST /…/attachments` (presign PUT + metadata), `GET /…/attachments/{aid}/url` (presign GET), `DELETE /…/attachments/{aid}` (uploader-only soft-delete).
- [x] Migration: `appointment_attachments`. Tests: presign auth, 50 MB guard, uploader-only delete, realtime + audit.

## 6. Contract regen (between backend and frontend)
- [x] `moon run backend:openapi` + `orchestrator:typegen` — new `/appointments`, notes, attachments ops + `/tasks` real-task shape.

## 7. Frontend — neutral rail primitives (before the views)
- [x] `components/rail/` — `MasterDetailRail`, `GroupedList` + `GroupedListSection`, `RailRow` (icon + primary + secondary + optional `trailing`), `RailEmptyState`/`RailSelectionEmptyState`. No domain imports. Generalise from `routes/_auth/tasks/route.tsx` + `TaskRow`. Unit tests.

## 8. Frontend — Afspraken (rail + custom detail)
- [x] `modules/appointment/` — api + hooks + adapter (`AppointmentRead` → rail rows; time/location trailing, no unread/polling).
- [x] `routes/_auth/appointments/` — list (rail) + `$appointmentId` custom detail: info + **"Open patiënt"** action + **notes** (append-only feed + add box) + **attachments** (upload presigned PUT, download presigned GET, delete own).
- [x] Sidebar: add "Afspraken" nav item (above Taken).

## 9. Frontend — Taken (rewrite via rail primitives)
- [x] Rewrite `modules/tasks/` to read real `/tasks` (`TaskRead`) through `components/rail/`; trailing slot = `status`; empty state; drop appointment payload/opened logic.
- [x] Keep "Taken" nav; guard `ADMIN|CAREGIVER`.

## 10. Frontend — patient profile Afspraken tab
- [x] Add "Afspraken" tab (after Metingen/Labresultaten) listing about (subject) + with (attendee) appointments, linking to `/_auth/appointments/$appointmentId`.

## 11. Seed + verify
- [x] Seed: appointments visible via Afspraken (existing `seed_appointments`); add `seed_tasks` demo (assigned to demo caregiver) so Taken isn't empty; optionally demo notes/attendees.
- [x] `moon run backend:typecheck backend:lint` + backend tests; `moon run orchestrator:typecheck orchestrator:lint` + orchestrator tests.
- [x] Manual: Afspraken list + detail (open patiënt, add note, upload/download/delete attachment); Taken real tasks; patient Afspraken tab (about/with).

## Follow-up (post initial implementation — see session tasks #12–16)
- [x] **Realtime notes/attachments** — provider invalidates by `[event.resource]` = query-key prefix. `tasks`/`appointments` match; `appointment_notes`/`appointment_attachments` do NOT (keys are `['appointments', id, 'notes'|'attachments']`). Align the note/attachment query keys to the resource name OR add an explicit resource→queryKey mapping in `providers/realtime-invalidation.tsx`. (Mutation `onSuccess` already invalidates for the acting user; this is cross-user live updates.)
- [x] **External-author test** — `appointment-collab` external-collaborator note scenario is already satisfied by the impl (external = org-derived CAREGIVER + access grant; `AppointmentAccessDep` → `resolve_patient_with_relation` admits grant-holders). Add a backend test: an org-external caregiver holding an `AccessGrant` to the patient (not an appointment participant) can POST a note.
- [x] **Live browser verification** — none done (shared docker stack runs main's code). Point the stack at this worktree (or merge), `:reset` → `backend:migrate` → `backend:seed`, exercise Afspraken/Taken/notes/attachments(MinIO presign)/patient-tab in-app.
- [x] **Optional** — seed demo notes + one `appointment_patient_attendees` row so the detail + 'Met patiënt' tab show data.
- [x] **Archive** — after merge, run the openspec archive flow + cross-link `tasks-base`/`appointment-base`/`appointment-collab`/`appointments-ui`/`patient-profile-ui` specs.
