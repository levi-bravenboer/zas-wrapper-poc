## REMOVED Requirements

### Requirement: `/tasks` is a server-side aggregator over multiple source domains, not a standalone table

**Reason**: the aggregator only ever projected appointments, conflating "task" with "appointment". This change makes appointments a first-class surface (`appointment-base` read API + `appointments-ui`) and rebuilds tasks as a real, stored domain. The projection, its `AppointmentSource`, and the `TaskItem` envelope are deleted.

**Migration**:
- Delete `app/services/tasks/` (aggregator + `sources/`) and `app/schemas/task/task_item.py`.
- The `GET /tasks/{source}/{source_id}` read-one route is removed; tasks are addressed by their own `id` (see new requirements).

### Requirement: `GET /tasks` returns a unified `TaskItem` envelope with typed source payload

**Reason**: replaced by a real `TaskRead` over a `tasks` table. `TaskItem`/`AppointmentPayload` are deleted.

**Migration**:
- `GET /tasks` now returns `Page[TaskRead]` of stored tasks (see below), not projected appointments.
- Appointment data moves to `GET /appointments` (`appointment-base`).

### Requirement: Per-caller task read-state (`task_read_state`)

**Reason**: read-state modelled "appointment seen" for the mislabeled inbox. Real tasks carry an explicit `status` instead.

**Migration**:
- Drop the `task_read_state` table + indexes; delete its model + repository.
- The "opened/unread" indicator is replaced by `Task.status` (`open` | `done`).

## ADDED Requirements

### Requirement: Task is a tenant-scoped work item assigned to a caregiver

The backend SHALL persist a `tasks` table where each row is one assignable unit of work for exactly one user within one tenant. `Task` SHALL inherit `TenantOwnedEntity` (inherited `id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `tenant_id`) plus: `assignee_user_id` (UUID, NOT NULL, FK `users.id`, ON DELETE RESTRICT), `title` (varchar 255, NOT NULL), `description` (text, NULL), `status` (enum `task_status`, NOT NULL, default `open`), `due_at` (timestamptz, NULL), `patient_id` (UUID, NULL, FK `patients.id`, ON DELETE RESTRICT), `source_ref` (varchar 255, NULL, NO FK — an opaque origin pointer such as `"appointment:<uuid>"`).

#### Scenario: Table + enum created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** a `tasks` table exists with the columns above, and a Postgres enum `task_status` exists with values `('open', 'done')`

#### Scenario: source_ref has no foreign key

- **WHEN** the `tasks` table is inspected
- **THEN** `source_ref` MUST be a nullable varchar with NO foreign-key constraint — a task may originate from any domain or none

#### Scenario: Task is realtime + audited

- **WHEN** the `Task` model is inspected
- **THEN** it MUST declare `__realtime_resource__` (live invalidation of the Taken list) AND `__audited__ = True` (audit-trail capture)

### Requirement: `/tasks` exposes the caller's tasks; creation is a service-level function

The backend SHALL expose `GET /tasks` (the caller's tasks via the shared `ListQuery` envelope → `Page[TaskRead]`), `GET /tasks/{id}` (read-one), and `PATCH /tasks/{id}` (`TaskStatusUpdate` → `TaskRead`). All routes SHALL be guarded by `Role.ADMIN | Role.CAREGIVER`.

Task **creation + assignment** SHALL be a `TaskService` function (`create(assignee_user_id, title, …)`) used by seeds and future task producers. NO public `POST /tasks` HTTP route ships at this tier — there is no create UI; tasks are produced programmatically. (A create endpoint can be added later when a producer needs it.)

A caregiver SHALL see only tasks where `assignee_user_id == caller.id`; an admin SHALL see all tasks within the tenant. A task addressed by `{id}` outside the caller's visibility SHALL return `404 Not Found` (existence hiding).

#### Scenario: Caregiver sees only assigned tasks

- **WHEN** a caregiver calls `GET /tasks`
- **THEN** the response MUST contain only tasks whose `assignee_user_id` equals the caregiver's user id

#### Scenario: Completing a task flips status, not soft-delete

- **WHEN** a caregiver `PATCH /tasks/{id}` with `status = done`
- **THEN** the row's `status` becomes `done`, `deleted_at` stays NULL, and the task still appears in `GET /tasks` (filterable by status)

#### Scenario: Empty inbox is valid

- **WHEN** no tasks are assigned to the caller
- **THEN** `GET /tasks` MUST return an empty page (total 0) — tasks are not auto-populated from appointments
