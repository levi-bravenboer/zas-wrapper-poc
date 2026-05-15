## Why

Backend has no tenancy primitive yet. Every future PoC domain (users, pathways, patients, tasks) needs a stable tenant FK to scope rows. Landing the Tenant table early — even with a single seeded `zas` row — avoids retrofitting `tenant_id` columns onto a half-built schema later. Tier: `[poc]`.

## What Changes

- Add a three-tier abstract ORM base hierarchy in `app/db/base.py`:
  - `Entity(Base)` — universal id + `created_at` + `updated_at` + `deleted_at` (soft delete).
  - `AuditableEntity(Entity)` — adds `created_by` / `updated_by` / `deleted_by` user FKs (`ON DELETE RESTRICT`).
  - `TenantOwnedEntity(AuditableEntity)` — adds non-null `tenant_id` FK (`ON DELETE RESTRICT`). Every future hospital-owned row inherits this and so is auditable + tenant-scoped by construction.
- Add a session-level audit hook at `app/db/audit.py`: `install_audit_hooks()` registers a single `before_flush` listener on `Session` that reads the request-/script-scoped actor from `session.info[SESSION_ACTOR_KEY]` ("actor") and stamps `tenant_id` (when null) on every new `TenantOwnedEntity`, `created_by` + `updated_by` (when null) on every new `AuditableEntity`, and `updated_by` on every dirty `AuditableEntity`. `install_audit_hooks()` is called once from `app/main.py` module import.
- Wire actor into `session.info`:
  - HTTP: `get_session` in `app/db/engine.py` writes `session.info[SESSION_ACTOR_KEY]` from an optional current-user dep (the dep itself lands in `backend-user-auth-base`; for this change the slot is reserved and unset — hook stays a no-op until auth lands).
  - Scripts: `script_session(*, actor: SessionUser | None = None)` writes `session.info[SESSION_ACTOR_KEY]` when an actor is supplied. Scripts that bootstrap before any user exists (`seed_tenant`) pass `actor=None`; seeds that mutate auditable rows (`seed_users`, future seeds) build a `SessionUser` from the freshly-inserted admin row and pass it in.
- Add a `tenants` table with `id` (UUID), `slug` (unique, kebab-case), `name`, `created_at`, `updated_at`, `deleted_at`.
- Add a `Tenant(Entity)` SQLAlchemy ORM model under `app/db/models/tenant/`. `Tenant` is the root scoping row — it does NOT inherit `AuditableEntity` (no `created_by` chicken-and-egg with `users`) and does NOT inherit `TenantOwnedEntity` (it IS the tenant). Every other hospital-owned domain model inherits `TenantOwnedEntity` and therefore picks up tenant FK + audit fields uniformly.
- Soft delete becomes the default deletion path: `BaseRepository.list()` filters `deleted_at IS NULL`; `BaseRepository.list_including_deleted()` opts in; `BaseRepository.soft_delete(entity)` sets `deleted_at = func.now()` and (for `AuditableEntity` rows) `deleted_by` from `session.info[SESSION_ACTOR_KEY]`. Custom repo queries MUST add `where(model.deleted_at.is_(None))` unless they intentionally surface soft-deleted rows.
- Add an alembic revision that creates the `tenants` table — **schema only, no seed data** — including the `deleted_at` column.
- Add an operational scripts package at `apps/backend/scripts/` with `seed_tenant.py` (inserts the `zas` tenant — `slug = "zas"`, `name = "ZAS Antwerpen"` — idempotently) and `seed_all.py` (umbrella that chains every seed in dependency order).
- Add `moon run backend:seed-tenant` and `moon run backend:seed` tasks wired to `python -m scripts.seed_tenant` / `python -m scripts.seed_all` inside the `zas_backend` container.
- Update the dev container entrypoint to run `alembic upgrade head && python -m scripts.seed_all` so `moon run backend:up` Just Works. Test container entrypoint stays migrate-only — tests get empty tables.
- Add a `TenantRepository` (read-only for now: `get_by_slug`, `list`).
- No user model, no membership table, no API surface, no auth wiring — those land in follow-up changes.

## Capabilities

### New Capabilities

- `tenant-base`: persistence-layer tenant primitive (table, model, repository) plus the universal ORM base hierarchy (`Entity` → `AuditableEntity` → `TenantOwnedEntity`), soft-delete semantics, and the session-scoped audit hook that auto-stamps `tenant_id` / `created_by` / `updated_by` / `deleted_by` from `session.info[SESSION_ACTOR_KEY]`. Read-only at the API boundary in PoC; no admin CRUD.
- `backend-scripts`: standalone Python scripts under `apps/backend/scripts/` invoked via `python -m scripts.<name>`, with one script here (`seed_tenant.py`) plus the `seed_all.py` umbrella. Establishes the convention that alembic owns DDL and `scripts/` owns seed/operational data. The user change extends this with a `seed_users` script and appends it to `seed_all`.

### Modified Capabilities

<!-- None. No existing spec changes shape. -->

## Impact

- **Code**: new files under `app/db/models/tenant/`, `app/repositories/tenant/`, `scripts/`, `alembic/versions/`; new abstract bases in `app/db/base.py`; new `app/db/audit.py`; `app/main.py`, `app/db/engine.py`, `app/repositories/base.py`, and `scripts/_db.py` updated to wire actor into `session.info`.
- **Schema**: new `tenants` table (DDL only) including `deleted_at`. Future domain tables will gain `tenant_id` + audit user FKs by inheriting `TenantOwnedEntity`.
- **Migration**: first non-trivial alembic revision; establishes the rule that revisions are schema-only and seed data lives in `scripts/`.
- **Runtime**: dev entrypoint is extended to `alembic upgrade head && python -m scripts.seed_all`. Test entrypoint stays migrate-only. Prod deploys run the umbrella as an explicit step after migration.
- **Tooling**: no new third-party dependencies — scripts use the stdlib `asyncio` runner plus existing SQLAlchemy/asyncpg infrastructure.
- **Tests**: repository test against live `zas_test_db`; script tests covering the async helper directly plus a subprocess invocation that verifies entry-point wiring.
- **Out of scope**: HTTP routes, multi-tenant scoping middleware, user/membership tables, tenant admin UI.
