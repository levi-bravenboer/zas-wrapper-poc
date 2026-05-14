## ADDED Requirements

### Requirement: Tenants table persists hospital scopes

The backend SHALL persist a `tenants` table whose rows represent the hospital scopes that own all downstream PoC domain data. Every row MUST carry an immutable UUID primary key, a unique kebab-case slug, a human-readable name, and creation/update timestamps.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** a `tenants` table exists with columns `id` (UUID, primary key, not null), `slug` (varchar 63, unique, not null), `name` (text, not null), `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`)

#### Scenario: Slug uniqueness enforced

- **WHEN** an insert attempts to create a second row with the same `slug` value as an existing row
- **THEN** the database MUST reject the insert with a unique-violation error

#### Scenario: Slug format enforced

- **WHEN** an insert attempts a `slug` value that does not match `^[a-z][a-z0-9-]{0,62}$`
- **THEN** the database MUST reject the insert with a check-constraint violation

### Requirement: Default ZAS tenant seeded via CLI

The backend SHALL provide a Typer subcommand `seed-tenant` under `app/cli/` that inserts a tenant with `slug = "zas"` and `name = "ZAS Antwerpen"` if no row with `slug = "zas"` exists. The command MUST be idempotent: re-running against a database that already has the row MUST be a no-op (no error, no duplicate). The inserted row MUST use a stable UUID literal (defined as a module-level constant in `app/cli/seed.py`, e.g. `ZAS_TENANT_ID`) so future seed commands and tests can reference the same id.

Alembic revisions in this change SHALL NOT insert any rows — they create DDL only.

#### Scenario: Seed inserts when missing

- **WHEN** `python -m app.cli seed-tenant` runs against a freshly migrated, empty database
- **THEN** the command exits 0 and `tenants` contains exactly one row with `slug = "zas"`, `name = "ZAS Antwerpen"`, and `id = ZAS_TENANT_ID`

#### Scenario: Seed is idempotent

- **WHEN** `python -m app.cli seed-tenant` is run a second time against a database that already contains the `zas` row
- **THEN** the command exits 0 and `tenants` still contains exactly one row with the same `id`

#### Scenario: Seed id stable across environments

- **WHEN** `seed-tenant` runs against any environment (dev container, CI, fresh local)
- **THEN** the resulting `zas` row MUST have the same UUID value (the `ZAS_TENANT_ID` literal)

#### Scenario: Dev entrypoint chains migrate and seed

- **WHEN** the `zas_backend` dev container starts
- **THEN** its entrypoint MUST run `alembic upgrade head` followed by `python -m app.cli seed-all` (which resolves to `seed-tenant` at minimum), so the `zas` row exists before the FastAPI app accepts requests

#### Scenario: Test entrypoint does not seed

- **WHEN** the `zas_backend_test` container starts
- **THEN** its entrypoint MUST run `alembic upgrade head` only — no CLI seed command — so tests start with empty tables

### Requirement: Tenant ORM model exposes the row shape

The backend SHALL expose a `Tenant` SQLAlchemy ORM model under `app/db/models/tenant/` that maps to the `tenants` table, is registered on `Base.metadata`, and is imported by `app/db/models/__init__.py` so alembic autogenerate discovers it.

#### Scenario: Model registered on metadata

- **WHEN** the application imports `app.db.models`
- **THEN** `Base.metadata.tables` MUST contain the `tenants` table mapped from the `Tenant` model

#### Scenario: Model attribute parity with table

- **WHEN** code accesses `Tenant.id`, `Tenant.slug`, `Tenant.name`, `Tenant.created_at`, `Tenant.updated_at`
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
