**Tier**: [poc]
**Promotes**: backend audit trail / observability requirement — a queryable record of who did what, when, across data changes, authentication, and explicit domain actions.

## Why

The backend has **half** an audit story today and no trace store:

- `AuditableEntity` stamps `created_by` / `updated_by` / `deleted_by` on every auditable row, auto-filled by the `before_flush` listener in `app/db/audit.py` from `session.info[SESSION_ACTOR_KEY]`. This is **last-writer only** — it tells you who currently owns a row, not the history of changes, not the before/after values.
- There is **no record** of authentication events (login success/failure, logout).
- There is **no way** to log explicit domain actions ("pathway published", "patient exported", "break-glass access") for an audit trail.

For a clinical product handling PHI (patients, tenants = hospitals, Luscii vitals), a unified, append-only audit trail is a compliance and operability need, not a nice-to-have. "Show me everything that touched patient X" and "show me everything caregiver Y did" must be answerable from one store.

### Off-the-shelf was researched and rejected

- **Dedicated audit-as-a-service** (Retraced, BoxyHQ Hermes): stalled / archived. Not a foundation for PHI.
- **Hosted** (WorkOS Audit Logs): clean API but PHI leaving to a SaaS is a DPA problem.
- **ORM audit libs** (`sqlalchemy-history`, `sqlalchemy-continuum`): cover data-diffs **only** — no auth/business events — and store them in per-model version tables, splitting the trace across two stores. `sqlalchemy-history` async support is still an open, in-flight issue; not a base for a PHI-critical path.
- **Postgres triggers / CDC** (`postgresql-audit`, `pgMemento`, Debezium): trade Python plumbing for SQL/Kafka plumbing and an actor-via-GUC dance; still cover data-diffs only.

Every external option covers at most one of the three layers and forces a second store for the other two. Custom unifies them, reuses machinery we already run (the actor slot + the `before_flush` listener), and keeps PHI in our own Postgres in the same transaction as the change.

This change ships a custom, append-only **unified audit trail** capturing all three layers in one `audit_events` table.

## What Changes

### New backend capability — `audit-trail-base`

- **New `audit_events` table** — append-only, immutable. One row per audited event. Inherits `Base` directly (not `Entity`) so it carries `id` + `created_at` only — no `updated_at`, no `deleted_at`, no soft-delete: immutability is structural. Columns: `actor_type`, `actor_id?`, `actor_label?`, `tenant_id?`, `action`, `result`, `resource_type?`, `resource_id?`, `changes jsonb?`, `context jsonb?` (the metadata column — named `context` to avoid SQLAlchemy's reserved `metadata`). No FKs on `tenant_id` / `actor_id` — the record must survive tenant archival / user deletion. Supporting indexes for the three query axes (by resource, by actor, by tenant timeline) + `(action, result, …)`.
- **Three new Postgres enums** (`app/core/enums/audit.py`): `ActorType` (user|system|service|anonymous), `AuditAction` (the **verb** — created/updated/deleted/login/logout/exported/published/access_granted), `AuditResult` (success|failure). The action is the verb only; the noun lives in free-text `resource_type` — so auditing a new model reuses `created/updated/deleted` with **no enum migration**. Outcome is the orthogonal `result` field, not a `login_failed` verb.
- **Two typed Pydantic payloads** for the jsonb columns (storage stays jsonb): `FieldChange{old,new}` (`changes: dict[str, FieldChange]` — named fields, not a positional `[old,new]` list) and `AuditContext` (`extra="allow"`; typed known keys `ip: IPvAnyAddress`, `user_agent`, `request_id`, `reason`).
- **Three capture feeds into that one table:**
  1. **Automatic data-change diffs** — extend the existing `before_flush` listener in `app/db/audit.py`. Models opt in via `__audited__ = True`. The hook reads SQLAlchemy attribute history, builds the `FieldChange` map, and `session.add()`s an `AuditEvent` riding the same transaction. Emits `action=created/updated/deleted` (soft-delete detected as a `deleted_at` transition → `deleted`).
  2. **Explicit domain events** — an `emit(session, *, action, result=…, resource_type=…, resource_id=…, changes=…, context=…)` helper callable from any service. Rides the request transaction (if the action rolls back, its audit row does too — correct).
  3. **Authentication events** — `emit()` calls in the auth flow for `login` / `logout` (and `login` + `result=failure`). Security events that must survive a rolled-back / 4xx request use a **separately-committed** variant (`emit_committed`) so a failed login is still recorded.
- **Audited-resource registry** — `emit()` validates `resource_type` against an app-level set of audited names (type-safe at the boundary, migration-free on new models).
- **Read access** — `AuditEventRepository` (extends `BaseListRepository`) + an admin-only `GET /audit-events` list endpoint with filters (`resource_type`, `resource_id`, `actor_id`, `action`, `result`, time range) so the custom UI (built separately) has a typed, paged data source.
- **JSON-safe serialisation** — a coercion helper for `changes` / `context` (UUID, datetime, date, Decimal, Enum → JSON primitives).

## Capabilities

### Added Capabilities

- `audit-trail-base` — append-only `audit_events` table; three enums (`ActorType` / `AuditAction` / `AuditResult`); typed payloads (`FieldChange` / `AuditContext`); automatic data-change diff capture via the extended `before_flush` hook (`__audited__` opt-in); `emit()` / `emit_committed()` helpers + audited-resource registry for domain + auth events; `AuditEventRepository` + admin-only `GET /audit-events` read API; JSON-safe serialiser.

### Modified Capabilities

- The shared `before_flush` audit hook (`app/db/audit.py`) gains data-diff emission alongside its existing `created_by` / `updated_by` stamping. The stamping behaviour is unchanged.

## Impact

- **DB**: one new `audit_events` table + supporting indexes. One alembic migration. No changes to existing tables (the `__audited__` opt-in is Python-side metadata, not a schema change).
- **Backend code** (`apps/backend/app/`):
  - `db/models/audit/audit_event.py` — `AuditEvent` ORM model (inherits `Base`).
  - `db/audit.py` — extend the `before_flush` listener with diff capture; add `__audited__` / `__audit_exclude__` class markers (on `Entity`, default off).
  - `services/audit/emit.py` — `emit()` + `emit_committed()` + JSON-safe coercion helper.
  - `repositories/audit/audit_event_repository.py` — `AuditEventRepository(BaseListRepository)`.
  - `schemas/audit/audit_event.py` — `AuditEventRead` + filter params.
  - `api/routers/audit/audit_router.py` — admin-only `GET /audit-events`.
  - Auth flow — `emit()` / `emit_committed()` calls at login / logout / login-failure.
  - First `__audited__ = True` opt-ins on a starter set (recommend `User`, `Patient`; expand later).
- **OpenAPI / typed client**: regenerated (`GET /audit-events` is a new operation).

## Risks and mitigations

- **R1 — `before_flush` adding rows mid-flush.** SQLAlchemy supports `session.add()` inside `before_flush`; new objects join the same flush. `AuditEvent` is not `__audited__`, so it cannot recurse. **Mitigation**: explicit exclusion + a recursion test.
- **R2 — Auto-diffs on PHI tables make `changes` blobs PHI.** **Mitigation accepted**: the table is PHI-classed with the same residency/retention as the rest of Postgres; `__audit_exclude__` drops sensitive/noisy columns per model.
- **R3 — Login-failure audit lost when the request returns 401 and the session rolls back.** **Mitigation**: `emit_committed()` writes security events in an independent, separately-committed session (D-AUTH-COMMIT).
- **R4 — Volume growth / no purge.** **Mitigation accepted v1**: keep forever; partitioning / retention is a flagged follow-up, not v1.
- **R5 — Opt-in means a model can be silently un-audited.** **Mitigation**: explicit `__audited__` list + a conformance test asserting the intended starter set is audited.
- **R6 — Out-of-app writes (manual SQL, migrations) bypass the app-level hook.** **Mitigation accepted**: PHI rows are not hand-edited in prod; if a hard compliance line emerges, a DB-trigger feed can be added later into the same table without changing the read side.

## Out of scope

- Any audit-trail **UI** — built separately by the team; this change ships the data layer + read API only.
- Read/access auditing (logging who *viewed* a record on every `GET`) — `emit()` can be called manually in a sensitive read path, but no automatic SELECT capture v1.
- Revert / time-travel / object versioning (this is an append-only trail, not a version store).
- Per-model version tables.
- Retention / partitioning / purge jobs / archival export.
- Forwarding to an external sink (Retraced / SIEM) — possible later as an additional feed; the local table stays source of truth.
- Tamper-evident hash chaining of events.
- Auditing every existing model — only a starter opt-in set v1.
