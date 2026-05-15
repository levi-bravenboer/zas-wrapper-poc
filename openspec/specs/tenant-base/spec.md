# tenant-base Specification

## Purpose
TBD - created by archiving change backend-tenant-base. Update Purpose after archive.
## Requirements
### Requirement: Abstract ORM base hierarchy provides id, timestamps, soft delete, audit, and tenant scope

The backend SHALL define three `__abstract__ = True` SQLAlchemy bases in `apps/backend/app/db/base.py`, layered so concrete models pick exactly one base depending on their tier:

- `class Entity(Base)` — universal columns: `id` (UUID primary key, app-side default `uuid4`), `created_at` (timestamptz, not null, `server_default=now()`), `updated_at` (timestamptz, not null, `server_default=now()`, `onupdate=now()`), `deleted_at` (timestamptz, nullable).
- `class AuditableEntity(Entity)` — adds `created_by` (UUID, not null, FK `users.id` `ON DELETE RESTRICT`), `updated_by` (UUID, not null, same FK), `deleted_by` (UUID, nullable, same FK).
- `class TenantOwnedEntity(AuditableEntity)` — adds `tenant_id` (UUID, not null, FK `tenants.id` `ON DELETE RESTRICT`, indexed).

`Tenant` SHALL inherit `Entity` only (not `AuditableEntity`, not `TenantOwnedEntity`) so the bootstrap tenant can be inserted before any `users` row exists. Every future hospital-owned model SHALL inherit `TenantOwnedEntity`.

#### Scenario: Bases registered as abstract

- **WHEN** code inspects `Entity.__abstract__`, `AuditableEntity.__abstract__`, `TenantOwnedEntity.__abstract__`
- **THEN** all three MUST equal `True` (no table is created for the bases themselves)

#### Scenario: Concrete models inherit the right base

- **WHEN** code inspects `Tenant.__mro__`
- **THEN** `Entity` MUST appear and `AuditableEntity` / `TenantOwnedEntity` MUST NOT appear (`Tenant` is the bootstrap)

#### Scenario: FK ondelete rules preserve audit + tenant integrity

- **WHEN** a database reviewer inspects the FK definitions for `created_by`, `updated_by`, `deleted_by`, and `tenant_id` on any model that inherits `TenantOwnedEntity`
- **THEN** every FK MUST declare `ON DELETE RESTRICT` — no cascade

### Requirement: Soft delete is the default deletion path

Every `Entity` row carries a nullable `deleted_at: timestamptz`. `BaseRepository.list()` MUST filter `deleted_at IS NULL` by default; `BaseRepository.list_including_deleted()` MUST omit the predicate. `BaseRepository.soft_delete(entity)` MUST set `entity.deleted_at = func.now()` and, for `AuditableEntity` rows, MUST set `entity.deleted_by` from `session.info[SESSION_ACTOR_KEY]` when set. `BaseRepository.hard_delete(entity)` MUST remain available for cases where retention rules forbid keeping the row. Custom repository queries MUST add `where(model.deleted_at.is_(None))` unless they intentionally surface soft-deleted rows.

#### Scenario: list() filters soft-deleted rows

- **WHEN** a row's `deleted_at` is non-null and a caller invokes `BaseRepository.list()`
- **THEN** the result MUST NOT contain that row

#### Scenario: list_including_deleted() returns soft-deleted rows

- **WHEN** a row's `deleted_at` is non-null and a caller invokes `BaseRepository.list_including_deleted()`
- **THEN** the result MUST contain that row

#### Scenario: soft_delete sets deleted_at and (when applicable) deleted_by

- **WHEN** `BaseRepository.soft_delete(entity)` is awaited and `session.info[SESSION_ACTOR_KEY]` is a `SessionUser`
- **THEN** the entity's `deleted_at` MUST be non-null, and if the entity is an `AuditableEntity` its `deleted_by` MUST equal the actor's `id`

### Requirement: Audit hook auto-fills tenant + audit fields from `session.info[SESSION_ACTOR_KEY]`

The backend SHALL expose `apps/backend/app/db/audit.py` defining `SESSION_ACTOR_KEY = "actor"` and `install_audit_hooks() -> None`. `install_audit_hooks()` MUST register a single SQLAlchemy `Session.before_flush` listener that:

- Reads `actor = session.info.get(SESSION_ACTOR_KEY)`; returns immediately when `actor is None`.
- For every newly added `TenantOwnedEntity` with `tenant_id is None`, sets `tenant_id = actor.tenant_id`.
- For every newly added `AuditableEntity` whose `created_by is None`, sets `created_by = actor.id` and `updated_by = actor.id`.
- For every dirty `AuditableEntity`, sets `updated_by = actor.id`.

`install_audit_hooks()` MUST be called exactly once at process import time from `app/main.py`. Entry points that build sessions MUST set `session.info[SESSION_ACTOR_KEY]` to the appropriate `SessionUser` before flushing rows that require audit/tenant columns:

- HTTP: `app/db/engine.get_session` writes the slot from the optional current-user dep (the dep itself lands in `backend-user-auth-base`; the seam exists in this change).
- Scripts: `scripts/_db.script_session(*, actor=None)` writes the slot when `actor` is supplied.
- Tests: a `session_actor` pytest fixture (default `None`) is read by the shared `db_session` fixture, which writes the slot when not `None`.

When no actor is set, the hook is a no-op; rows that require `created_by` / `updated_by` (NOT NULL columns) MUST be inserted by callers that DO set the actor. The DB constraint is the safety net — a missing actor on an `AuditableEntity` flush MUST fail loudly with an `IntegrityError`, never silently produce orphaned rows.

#### Scenario: Hook stamps tenant + audit fields on insert

- **GIVEN** `session.info[SESSION_ACTOR_KEY]` is a `SessionUser { id: U, tenant_id: T, role: caregiver }`
- **WHEN** a new `TenantOwnedEntity` subclass instance is added to the session without `tenant_id` / `created_by` / `updated_by` set, and `session.flush()` is awaited
- **THEN** the inserted row MUST have `tenant_id = T`, `created_by = U`, and `updated_by = U`

#### Scenario: Hook stamps updated_by on update

- **GIVEN** `session.info[SESSION_ACTOR_KEY]` is a `SessionUser` with `id = U2`
- **WHEN** a previously-inserted `AuditableEntity` row's non-audit column is modified and `session.flush()` is awaited
- **THEN** the row's `updated_by` MUST equal `U2`

#### Scenario: Hook is a no-op when actor is unset

- **WHEN** `session.info[SESSION_ACTOR_KEY]` is unset and a non-auditable `Entity` (e.g. a `Tenant`) is inserted
- **THEN** the flush MUST succeed without raising; the `Tenant` row MUST be persisted unchanged

#### Scenario: Missing actor on AuditableEntity insert raises

- **WHEN** `session.info[SESSION_ACTOR_KEY]` is unset and a new `AuditableEntity` row without an explicit `created_by` is flushed
- **THEN** the database MUST reject the insert with a `NOT NULL` violation (the hook does NOT manufacture a value)

### Requirement: Tenants table persists hospital scopes

The backend SHALL persist a `tenants` table whose rows represent the hospital scopes that own all downstream PoC domain data. Every row MUST carry an immutable UUID primary key, a unique kebab-case slug, a human-readable name, creation/update timestamps, and a nullable `deleted_at` soft-delete column. `tenants` rows MUST NOT carry `created_by` / `updated_by` / `deleted_by` columns — `Tenant` inherits `Entity` only.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** a `tenants` table exists with columns `id` (UUID, primary key, not null), `slug` (varchar 63, unique, not null), `name` (text, not null), `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`), `deleted_at` (timestamptz, nullable)

#### Scenario: Slug uniqueness enforced

- **WHEN** an insert attempts to create a second row with the same `slug` value as an existing row
- **THEN** the database MUST reject the insert with a unique-violation error

#### Scenario: Slug format enforced

- **WHEN** an insert attempts a `slug` value that does not match `^[a-z][a-z0-9-]{0,62}$`
- **THEN** the database MUST reject the insert with a check-constraint violation

### Requirement: Default ZAS tenant seeded via script

The backend SHALL provide a `scripts/seed_tenant.py` module that inserts a tenant with `slug = "zas"` and `name = "ZAS Antwerpen"` if no row with `slug = "zas"` exists. The script MUST be idempotent: re-running against a database that already has the row MUST be a no-op (no error, no duplicate). The inserted row MUST use a stable UUID literal (defined as a module-level constant in `scripts/seed_tenant.py`, named `ZAS_TENANT_ID`) so future seed scripts and tests can reference the same id.

Alembic revisions in this change SHALL NOT insert any rows — they create DDL only.

#### Scenario: Seed inserts when missing

- **WHEN** `python -m scripts.seed_tenant` runs against a freshly migrated, empty database
- **THEN** the command exits 0 and `tenants` contains exactly one row with `slug = "zas"`, `name = "ZAS Antwerpen"`, and `id = ZAS_TENANT_ID`

#### Scenario: Seed is idempotent

- **WHEN** `python -m scripts.seed_tenant` is run a second time against a database that already contains the `zas` row
- **THEN** the command exits 0 and `tenants` still contains exactly one row with the same `id`

#### Scenario: Seed id stable across environments

- **WHEN** `scripts.seed_tenant` runs against any environment (dev container, CI, fresh local)
- **THEN** the resulting `zas` row MUST have the same UUID value (the `ZAS_TENANT_ID` literal)

#### Scenario: Dev entrypoint chains migrate and seed

- **WHEN** the `zas_backend` dev container starts
- **THEN** its entrypoint MUST run `alembic upgrade head` followed by `python -m scripts.seed_all` (which resolves to `seed_zas_tenant` at minimum), so the `zas` row exists before the FastAPI app accepts requests

#### Scenario: Test entrypoint does not seed

- **WHEN** the `zas_backend_test` container starts
- **THEN** its entrypoint MUST run `alembic upgrade head` only — no script seed invocation — so tests start with empty tables

### Requirement: Tenant ORM model exposes the row shape

The backend SHALL expose a `Tenant` SQLAlchemy ORM model under `app/db/models/tenant/` that maps to the `tenants` table, is registered on `Base.metadata`, and is imported by `app/db/models/__init__.py` so alembic autogenerate discovers it.

#### Scenario: Model registered on metadata

- **WHEN** the application imports `app.db.models`
- **THEN** `Base.metadata.tables` MUST contain the `tenants` table mapped from the `Tenant` model

#### Scenario: Model attribute parity with table

- **WHEN** code accesses `Tenant.id`, `Tenant.slug`, `Tenant.name`, `Tenant.created_at`, `Tenant.updated_at`, `Tenant.deleted_at`
- **THEN** each attribute MUST resolve to a SQLAlchemy mapped column matching the corresponding `tenants` column

### Requirement: Tenant repository provides read access by slug

The backend SHALL expose a `TenantRepository` under `app/repositories/tenant/` that extends `BaseRepository[Tenant]` and provides a `get_by_slug(slug: str) -> Tenant | None` method, plus the inherited `list()`. The repository MUST NOT expose write methods (`add`, `update`, `delete`) in this change.

#### Scenario: Lookup by existing slug

- **WHEN** `TenantRepository.get_by_slug("zas")` is awaited against a freshly migrated database
- **THEN** it MUST return a `Tenant` instance with `slug = "zas"` and `name = "ZAS Antwerpen"`

#### Scenario: Lookup by missing slug

- **WHEN** `TenantRepository.get_by_slug("does-not-exist")` is awaited
- **THEN** it MUST return `None` and MUST NOT raise

#### Scenario: No write surface exposed

- **WHEN** code inspects `TenantRepository`'s public methods
- **THEN** the class MUST NOT define `add`, `update`, or `delete` overrides beyond what is needed to satisfy the type system; downstream code SHALL NOT rely on the base `add` / `delete` for tenant rows in this change

