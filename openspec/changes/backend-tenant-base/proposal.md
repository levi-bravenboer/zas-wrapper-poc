## Why

Backend has no tenancy primitive yet. Every future PoC domain (users, pathways, patients, tasks) needs a stable tenant FK to scope rows. Landing the Tenant table early — even with a single seeded `zas` row — avoids retrofitting `tenant_id` columns onto a half-built schema later. Tier: `[poc]`.

## What Changes

- Add a `tenants` table with `id` (UUID), `slug` (unique, kebab-case), `name`, `created_at`, `updated_at`.
- Add a `Tenant` SQLAlchemy ORM model under `app/db/models/tenant/`.
- Add an alembic revision that creates the table — **schema only, no seed data**.
- Add a Typer-based CLI module at `app/cli/` (entry: `python -m app.cli`) with a `seed-tenant` subcommand that inserts the `zas` tenant (`slug = "zas"`, `name = "ZAS Antwerpen"`) idempotently — looks up by slug first and no-ops if present.
- Add a `moon run backend:seed-tenant` task wired to that CLI subcommand inside the `zas_backend` container.
- Update the dev container entrypoint to run `alembic upgrade head && python -m app.cli seed-tenant` so `moon run backend:up` Just Works. Test container entrypoint stays migrate-only — tests get empty tables.
- Add a `TenantRepository` (read-only for now: `get_by_slug`, `list`).
- No user model, no membership table, no API surface, no auth wiring — those land in follow-up changes.

## Capabilities

### New Capabilities

- `tenant-base`: persistence-layer tenant primitive (table, model, repository) that downstream domains FK against. Read-only at the API boundary in PoC; no admin CRUD.
- `backend-cli`: Typer-based CLI module at `app/cli/` invoked via `python -m app.cli`, with one subcommand here (`seed-tenant`). Establishes the convention that alembic owns DDL and the CLI owns seed/operational data. The user change extends this with `seed-users` and `seed-all`.

### Modified Capabilities

<!-- None. No existing spec changes shape. -->

## Impact

- **Code**: new files under `app/db/models/tenant/`, `app/repositories/tenant/`, `app/cli/`, `alembic/versions/`.
- **Schema**: new `tenants` table (DDL only). Future domain tables will gain `tenant_id` FK to `tenants.id`.
- **Migration**: first non-trivial alembic revision; establishes the rule that revisions are schema-only and seed data lives in `app/cli/`.
- **Runtime**: dev entrypoint is extended to `alembic upgrade head && python -m app.cli seed-tenant`. Test entrypoint stays migrate-only. Prod deploys run the CLI as an explicit step after migration.
- **Tooling**: adds `typer` to `pyproject.toml` (if not already present transitively via `fastapi[standard]`); registers `python -m app.cli` entry point.
- **Tests**: repository test against live `zas_test_db`; CLI subcommand test covering idempotency.
- **Out of scope**: HTTP routes, multi-tenant scoping middleware, user/membership tables, tenant admin UI.
