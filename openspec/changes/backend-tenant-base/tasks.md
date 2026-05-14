## 1. ORM Model

- [ ] 1.1 Create `app/db/models/tenant/__init__.py` that re-exports `Tenant`
- [ ] 1.2 Create `app/db/models/tenant/tenant.py` with `Tenant(Base)`: `id: Mapped[UUID]` (pk, default `uuid.uuid4`), `slug: Mapped[str]` (unique, max 63), `name: Mapped[str]`, `created_at` / `updated_at: Mapped[datetime]` (server_default `now()`, `onupdate` UTC now)
- [ ] 1.3 Import `app.db.models.tenant` from `app/db/models/__init__.py` so alembic autogenerate sees it
- [ ] 1.4 Add a module-level comment in `tenant.py` documenting that downstream domains must FK to `tenants.id` and that the seeded `zas` UUID literal lives at `app.cli.seed.ZAS_TENANT_ID`

## 2. Alembic Revision (schema only)

- [ ] 2.1 Generate revision: `moon run backend:make-migration "create tenants table"`
- [ ] 2.2 In `upgrade()`, create the `tenants` table with columns from 1.2, a unique index on `slug`, and a `CHECK (slug ~ '^[a-z][a-z0-9-]{0,62}$')` constraint named `ck_tenants_slug_format`
- [ ] 2.3 In `downgrade()`, drop the table (CHECK + unique index dropped implicitly)
- [ ] 2.4 Verify revision is the first non-empty file under `alembic/versions/`, has `down_revision = None`, and contains **no** `op.bulk_insert` / `op.execute("INSERT ...")` — DDL only

## 3. Tenant Repository

- [ ] 3.1 Create `app/repositories/tenant/__init__.py` that re-exports `TenantRepository` and `TenantRepoDep`
- [ ] 3.2 Create `app/repositories/tenant/tenant_repository.py` with `class TenantRepository(BaseRepository[Tenant])` setting `model = Tenant` and adding `async def get_by_slug(self, slug: str) -> Tenant | None`
- [ ] 3.3 Create `app/repositories/tenant/deps.py` exposing `TenantRepoDep = Annotated[TenantRepository, Depends(get_tenant_repository)]` and the corresponding factory that takes `SessionDep`

## 4. CLI scaffolding

- [ ] 4.1 Add `typer` to `apps/backend/pyproject.toml` if not already pulled in transitively; regenerate `uv.lock` via `moon run backend:install`
- [ ] 4.2 Create `app/cli/__init__.py` with `app: typer.Typer = typer.Typer(no_args_is_help=True)` and a brief module docstring
- [ ] 4.3 Create `app/cli/__main__.py` that imports `app` and runs it (`app()`)
- [ ] 4.4 Create `app/cli/_db.py` (or similar) with a helper that builds a short-lived `AsyncEngine` + sessionmaker from `Settings.database_url` — CLI subcommands MUST NOT depend on FastAPI app state
- [ ] 4.5 Create `app/cli/seed.py` defining `ZAS_TENANT_ID: UUID = UUID("<stable literal>")` and `ZAS_TENANT_NAME = "ZAS Antwerpen"` constants for downstream commands to import

## 5. `seed-tenant` subcommand

- [ ] 5.1 Add `seed_tenant` async function in `app/cli/seed.py` that opens a session, calls `TenantRepository.get_by_slug("zas")`, and inserts a new `Tenant(id=ZAS_TENANT_ID, slug="zas", name=ZAS_TENANT_NAME)` if `None`. Log `INFO seeded tenant slug=zas` on insert, `INFO tenant slug=zas already present` on no-op
- [ ] 5.2 Register the subcommand on the Typer `app` with name `seed-tenant`
- [ ] 5.3 Register `seed-all` subcommand that currently invokes only `seed_tenant`

## 6. Moon + entrypoint wiring

- [ ] 6.1 Add `seed-tenant` task to `apps/backend/moon.yml` running `python -m app.cli seed-tenant` inside `zas_backend`
- [ ] 6.2 Add `seed` task running `python -m app.cli seed-all`
- [ ] 6.3 Update `apps/backend/docker/entrypoint.sh` (dev container path) so the dev startup chain is `alembic upgrade head && python -m app.cli seed-all && exec <existing fastapi command>`
- [ ] 6.4 Confirm `zas_backend_test` entrypoint (or compose override) runs migrate only — NO `seed-all` invocation
- [ ] 6.5 Update `apps/backend/README.md` per-task table to list the new `seed-tenant` / `seed` moon tasks and document the prod-deploy chain ("after migrate, run `python -m app.cli seed-all`")

## 7. Tests

- [ ] 7.1 `tests/repositories/tenant/test_tenant_repository.py` — `get_by_slug("zas")` returns the row after seeding; `get_by_slug("missing")` returns `None`; invalid slug insert raises integrity error (CHECK constraint live)
- [ ] 7.2 `tests/cli/test_seed.py` — `seed-tenant` against empty DB inserts the row with `id == ZAS_TENANT_ID`; second invocation is no-op; assert exit codes via Typer's `CliRunner`
- [ ] 7.3 Add a `seeded_zas_tenant` fixture in `tests/conftest.py` (or `tests/repositories/conftest.py`) that calls the CLI seed function (not the alembic revision) and yields the row — downstream domain tests reuse it

## 8. Quality Gates

- [ ] 8.1 `moon run backend:lint` clean
- [ ] 8.2 `moon run backend:format` clean
- [ ] 8.3 `moon run backend:typecheck` clean
- [ ] 8.4 `moon run backend:test -- tests/repositories/tenant tests/cli` green
- [ ] 8.5 `moon run backend:test` full suite green
- [ ] 8.6 Bring up the stack: `moon run backend:dev`. Confirm entrypoint logs show `alembic upgrade head` then `seeded tenant slug=zas`. Run `moon run backend:psql -c 'select id, slug, name from tenants'` — returns one row with `id = ZAS_TENANT_ID`. Re-run `moon run backend:seed-tenant`, confirm no-op log
