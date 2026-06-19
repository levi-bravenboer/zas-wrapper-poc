# audit-trail-base Specification

## Purpose
TBD - created by archiving change backend-audit-event-logging. Update Purpose after archive.
## Requirements
### Requirement: Append-only audit_events table

The backend SHALL persist an `audit_events` table that records one immutable row per audited event. The table SHALL inherit `Base` directly (not `Entity`), carrying `id` + `created_at` only — no `updated_at`, no `deleted_at`, no soft-delete — so immutability is structural. `tenant_id` and `actor_id` SHALL carry NO foreign keys so a row survives tenant archival and user deletion; `actor_label` SHALL denormalise the actor display name so a row stays legible after rename/delete. The table SHALL provide indexes for the resource, actor, and tenant query axes plus an `(action, result, created_at)` index and a `request_id` index.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** an `audit_events` table exists with columns `id` (UUID, primary key), `created_at` (timestamptz, not null, default `now()`), `actor_type` (enum, not null), `actor_id` (UUID, nullable), `actor_label` (varchar 255, nullable), `tenant_id` (UUID, nullable), `action` (enum, not null), `result` (enum, not null, default `success`), `resource_type` (varchar 100, nullable), `resource_id` (UUID, nullable), `request_id` (UUID, nullable), `changes` (jsonb, nullable), `context` (jsonb, nullable)

#### Scenario: No actor or tenant foreign keys

- **WHEN** the `audit_events` table is inspected
- **THEN** neither `actor_id` nor `tenant_id` MUST have a foreign key constraint

#### Scenario: Append-only — no soft-delete column

- **WHEN** the `AuditEvent` model is inspected
- **THEN** it MUST NOT carry `updated_at` or `deleted_at` columns, and MUST NOT be an `AuditableEntity`

### Requirement: Audit enums are verb-only actions plus orthogonal outcome

The backend SHALL define three Postgres-backed `StrEnum`s in `app/core/enums/audit.py`: `ActorType` (`user | system | anonymous`), `AuditAction` (`created | updated | deleted | login | published`), and `AuditResult` (`success | failure`). `AuditAction` SHALL hold the operation VERB only; the noun SHALL live in the free-text `resource_type` column so auditing a new model reuses `created` / `updated` / `deleted` with no enum migration. A new verb SHALL be added ONLY for a state transition that cannot be expressed as create/update/delete (e.g. `published`, the concept→published transition), and such a verb SHALL be generic and reusable across resource types rather than resource-specific. Outcome SHALL be the orthogonal `AuditResult`, not a `login_failed` verb.

#### Scenario: Failed login recorded as login + failure

- **WHEN** a login attempt fails
- **THEN** the audit row MUST have `action = login` and `result = failure` (not a distinct failure verb)

#### Scenario: Publish recorded with the published verb

- **WHEN** a resource undergoes a publish state transition (e.g. a pathway version is published)
- **THEN** the audit row MUST have `action = published` — a generic state-transition verb usable by any publishable resource type — and the resource noun lives in `resource_type`

### Requirement: Automatic data-change capture via before_flush hook

The shared `before_flush` listener in `app/db/audit.py` SHALL capture an append-only `AuditEvent` for every create, update, and delete of a model that opts in with `__audited__ = True`, in addition to its existing `created_by` / `updated_by` stamping. The hook SHALL build a `FieldChange` map from SQLAlchemy attribute history, classify a `deleted_at` transition as `deleted`, honour `__audit_exclude__` per model, and `session.add()` the event onto the same flush so it commits in the same transaction as the change. `AuditEvent` SHALL NOT be `__audited__`, so capture never recurses.

#### Scenario: Update emits an updated event with field changes

- **WHEN** an audited model row is updated within a request session
- **THEN** one `AuditEvent` with `action = updated` is captured carrying a `changes` map of the modified columns' old/new values, excluding `updated_at` and any `__audit_exclude__` columns

#### Scenario: Soft-delete classified as deleted

- **WHEN** an audited row's `deleted_at` transitions from null to a timestamp
- **THEN** the captured event MUST have `action = deleted`

#### Scenario: Non-audited model emits nothing

- **WHEN** a model without `__audited__ = True` is created, updated, or deleted
- **THEN** no `AuditEvent` row is captured for it

#### Scenario: No recursion on AuditEvent

- **WHEN** the hook adds `AuditEvent` rows during a flush
- **THEN** those rows MUST NOT themselves trigger capture

### Requirement: Authentication events survive a rolled-back request

The backend SHALL provide `emit_committed()` in `app/services/audit/emit.py` that records a security event in its own short-lived, separately-committed session, so a failed login that returns 401 (rolling back the request session) is still recorded. The auth flow SHALL call it for login success and login failure. An audit-store error MUST be best-effort and MUST NOT turn a login into a 500 or fail a login whose credentials already verified. `emit_committed()` SHALL validate any explicit `resource_type` against the audited-resource registry of known ORM model names before writing.

#### Scenario: Failed login is recorded despite the 401

- **WHEN** a login attempt fails and the request returns 401 with the request session rolled back
- **THEN** an `AuditEvent` with `action = login` and `result = failure` MUST be persisted independently

#### Scenario: Unknown resource_type rejected

- **WHEN** `emit_committed()` is called with a `resource_type` that is not a known ORM model name
- **THEN** it MUST raise a `ValueError` and write no row

### Requirement: Typed jsonb payloads and JSON-safe serialisation

The backend SHALL type the two jsonb columns at the write/read boundary while keeping storage as `jsonb`: `FieldChange{old, new}` for the `changes` map (named fields, not a positional list) and `AuditContext` (`extra="allow"`, typed known keys `ip`, `user_agent`, `reason`) for `context`. A `json_safe` coercion helper SHALL recursively reduce UUID, datetime, date, Decimal, and Enum values to JSON-native primitives before storage.

#### Scenario: Non-JSON-native values coerced

- **WHEN** a `changes` or `context` payload contains a UUID, datetime, Decimal, or Enum value
- **THEN** the persisted jsonb MUST hold its JSON-native string/number form

### Requirement: Admin-only audit read API

The backend SHALL expose an admin-only `GET /audit-events` list endpoint backed by `AuditEventRepository` (extending `BaseListRepository`), returning a paged `AuditEventRead`. The endpoint SHALL support filtering by `resource_type`, `resource_id`, `actor_id`, `action`, `result`, `request_id`, and a `created_at` range, ordered by `created_at` descending by default. The endpoint SHALL be read-only — no write operations on the audit trail are exposed.

#### Scenario: Non-admin denied

- **WHEN** a non-admin caller requests `GET /audit-events`
- **THEN** the request MUST be rejected by the admin-role dependency

#### Scenario: Admin filters the trail

- **WHEN** an admin requests `GET /audit-events?filter[resource_type][eq]=Patient&filter[resource_id][eq]=<id>`
- **THEN** the response MUST contain only that patient's audit rows, newest first

