## 0. Abstract ORM base hierarchy

- [x] 0.1 Update `apps/backend/app/db/base.py` so `class Base(DeclarativeBase)` is followed by three `__abstract__ = True` bases in this order:
  - `class Entity(Base)` — `id: Mapped[UUID]` (pk, default `uuid4`), `created_at` (`server_default=now()`, not null), `updated_at` (`server_default=now()`, `onupdate=now()`, not null), `deleted_at: Mapped[datetime | None]` (nullable, default `None`).
  - `class AuditableEntity(Entity)` — `created_by: Mapped[UUID]` (FK `users.id`, `ondelete="RESTRICT"`, not null), `updated_by: Mapped[UUID]` (FK `users.id`, `ondelete="RESTRICT"`, not null), `deleted_by: Mapped[UUID | None]` (FK `users.id`, `ondelete="RESTRICT"`, nullable).
  - `class TenantOwnedEntity(AuditableEntity)` — `tenant_id: Mapped[UUID]` (FK `tenants.id`, `ondelete="RESTRICT"`, not null, indexed).
- [x] 0.2 Add a module docstring to `app/db/base.py` documenting which base each concrete model picks (`Tenant → Entity`, every hospital-owned domain → `TenantOwnedEntity`), the soft-delete contract, and the audit-hook expectation.
- [x] 0.3 Update `app/repositories/base.py` `BaseRepository[T]`:
  - `T = TypeVar("T", bound=Entity)`.
  - `list()` now `select(self.model).where(self.model.deleted_at.is_(None))`.
  - Add `list_including_deleted()` that omits the predicate.
  - Add `soft_delete(entity)` that sets `entity.deleted_at = func.now()` and, when the entity is an `AuditableEntity`, sets `entity.deleted_by` from `session.info.get(SESSION_ACTOR_KEY)` (no-op when unset).
  - Keep `hard_delete(entity)` for retention-rule cases.
  - Docstring states: custom queries MUST add `where(model.deleted_at.is_(None))` unless they intentionally surface soft-deleted rows.

## 1. ORM Model

- [x] 1.1 Create `app/db/models/tenant/__init__.py` that re-exports `Tenant`
- [x] 1.2 Create `app/db/models/tenant/tenant.py` with `Tenant(Entity)`: `slug: Mapped[str]` (unique, max 63, CHECK constraint), `name: Mapped[str]`. `Tenant` inherits `Entity` only (NOT `AuditableEntity`, NOT `TenantOwnedEntity`) — it is the root scoping row and a `users` row to FK `created_by` against does not yet exist when the bootstrap tenant is seeded
- [x] 1.3 Import `app.db.models.tenant` from `app/db/models/__init__.py` so alembic autogenerate sees it
- [x] 1.4 Add a module-level comment in `tenant.py` documenting that downstream hospital-owned models MUST inherit `TenantOwnedEntity` (which already FKs to `tenants.id`) and that the seeded `zas` UUID literal lives at `scripts.seed_tenant.ZAS_TENANT_ID`

## 2. Alembic Revision (schema only)

- [x] 2.1 Generate revision: `moon run backend:make-migration "create tenants table"`
- [x] 2.2 In `upgrade()`, create the `tenants` table with columns from 1.2 plus the inherited `Entity` columns (`created_at`, `updated_at`, `deleted_at`), a unique index on `slug`, and a `CHECK (slug ~ '^[a-z][a-z0-9-]{0,62}$')` constraint named `ck_tenants_slug_format`
- [x] 2.3 In `downgrade()`, drop the table (CHECK + unique index dropped implicitly)
- [x] 2.4 Verify revision is the first non-empty file under `alembic/versions/`, has `down_revision = None`, and contains **no** `op.bulk_insert` / `op.execute("INSERT ...")` — DDL only

## 3. Tenant Repository

- [x] 3.1 Create `app/repositories/tenant/__init__.py` that re-exports `TenantRepository` and `TenantRepoDep`
- [x] 3.2 Create `app/repositories/tenant/tenant_repository.py` with `class TenantRepository(BaseRepository[Tenant])` setting `model = Tenant` and adding `async def get_by_slug(self, slug: str) -> Tenant | None`
- [x] 3.3 Create `app/repositories/tenant/deps.py` exposing `TenantRepoDep = Annotated[TenantRepository, Depends(get_tenant_repository)]` and the corresponding factory that takes `SessionDep`

## 3b. Audit module + entry-point wiring

- [x] 3b.1 Create `apps/backend/app/db/audit.py` exposing `SESSION_ACTOR_KEY: Final[str] = "actor"` and `def install_audit_hooks() -> None`. Inside, register a single `@event.listens_for(Session, "before_flush")` handler that:
  - reads `actor = session.info.get(SESSION_ACTOR_KEY)`; returns immediately when `actor is None`
  - for each `obj in session.new`: if `isinstance(obj, TenantOwnedEntity) and obj.tenant_id is None: obj.tenant_id = actor.tenant_id`; if `isinstance(obj, AuditableEntity)` and `obj.created_by is None`, set both `created_by` and `updated_by` to `actor.id`
  - for each `obj in session.dirty`: if `isinstance(obj, AuditableEntity)` and `session.is_modified(obj, include_collections=False)`, set `obj.updated_by = actor.id`
- [x] 3b.2 Call `install_audit_hooks()` once at module import time in `apps/backend/app/main.py` (top of file, after imports, before `create_app`). The listener registration is process-global and idempotent for a single import.
- [x] 3b.3 Update `apps/backend/app/db/engine.py` `get_session` so it reads an optional current-user dep (signature placeholder: `actor: "SessionUser | None" = None`) and writes `session.info[SESSION_ACTOR_KEY] = actor` when not `None`. In this change the dep stays unwired (no `users` table yet) — leave a TODO referencing `backend-user-auth-base` and ensure the slot remains unset so the hook stays idle.
- [x] 3b.4 Update `apps/backend/scripts/_db.py`:
  - `script_session(*, actor: "SessionUser | None" = None) -> AsyncIterator[AsyncSession]`: when `actor` is supplied, write `session.info[SESSION_ACTOR_KEY] = actor` before yielding.
  - `run_script(coro_factory, *, actor=None)`: forward to `script_session(actor=actor)`.
  - Type-hint `actor` via `TYPE_CHECKING` import of `SessionUser` to avoid the runtime import (the schema lives in `backend-user-auth-base`; in this change scripts call `actor=None` and the type stays a forward reference).

## 4. Scripts package scaffolding

- [x] 4.1 Create `apps/backend/scripts/__init__.py` with a brief module docstring documenting the convention (`python -m scripts.<name>`, idempotent, importable async helpers)
- [x] 4.2 Create `scripts/_db.py` exposing `script_session()` — an `asynccontextmanager` that builds a short-lived `AsyncEngine` + `async_sessionmaker` from `Settings.database_url`, yields a session, commits on success, and disposes the engine on exit. Scripts MUST NOT depend on FastAPI app state.
- [x] 4.3 Wire `scripts/` into `apps/backend/moon.yml` `fileGroups.sources` and `apps/backend/pyproject.toml` `[tool.pyright].include` so lint, format, and typecheck pick it up

## 5. `seed_tenant` script

- [x] 5.1 Create `scripts/seed_tenant.py` defining `ZAS_TENANT_ID: UUID = UUID("<stable literal>")` and `ZAS_TENANT_NAME = "ZAS Antwerpen"` constants for downstream scripts to import
- [x] 5.2 Add `async def seed_zas_tenant(session: AsyncSession) -> Tenant` that calls `TenantRepository.get_by_slug("zas")`, inserts `Tenant(id=ZAS_TENANT_ID, slug="zas", name=ZAS_TENANT_NAME)` when missing, and returns the row either way. Log `INFO seeded tenant slug=zas` on insert, `INFO tenant slug=zas already present` on no-op.
- [x] 5.3 Add `def main() -> None` that calls `app.core.logging.configure_logging(get_settings())` then runs the helper inside `script_session()` via `asyncio.run`. Guard with `if __name__ == "__main__": main()`.

## 6. `seed_all` umbrella script

- [x] 6.1 Create `scripts/seed_all.py` exposing `def main()` that runs every registered seed step in dependency order — in this change just `seed_zas_tenant`. Same logging + `script_session` pattern as `seed_tenant.py`.

## 7. Moon + entrypoint wiring

- [x] 7.1 Add `seed-tenant` task to `apps/backend/moon.yml` running `python -m scripts.seed_tenant` inside `zas_backend`
- [x] 7.2 Add `seed` task running `python -m scripts.seed_all`
- [x] 7.3 Update `apps/backend/docker/entrypoint.sh` (dev container path) so the dev startup chain is `alembic upgrade head && python -m scripts.seed_all && exec <existing fastapi command>`
- [x] 7.4 Confirm `zas_backend_test` entrypoint (or compose override) runs migrate only — NO `scripts.seed_all` invocation
- [x] 7.5 Update `apps/backend/README.md` per-task table to list the new `seed-tenant` / `seed` moon tasks and document the prod-deploy chain ("after migrate, run `python -m scripts.seed_all`")

## 8. Tests

- [x] 8.1 `tests/repositories/tenant/test_tenant_repository.py` — `get_by_slug("zas")` returns the row after seeding; `get_by_slug("missing")` returns `None`; invalid slug insert raises integrity error (CHECK constraint live); `soft_delete(tenant)` sets `deleted_at` and a subsequent `list()` excludes it while `list_including_deleted()` returns it
- [x] 8.2 `tests/scripts/test_seed_tenant.py` — `seed_zas_tenant` against empty DB inserts the row with `id == ZAS_TENANT_ID`; second invocation is no-op (row count stays 1); subprocess `python -m scripts.seed_tenant` exits 0 to cover entry-point wiring
- [x] 8.3 `tests/scripts/test_seed_all.py` — subprocess `python -m scripts.seed_all` exits 0 and the `zas` row is present afterwards
- [x] 8.4 Add a `seeded_zas_tenant` fixture in `tests/conftest.py` that calls `seed_zas_tenant(db_session)` and yields the row — downstream domain tests reuse it
- [x] 8.5 Add per-layer `_autoclean_tenants` autouse fixtures in `tests/scripts/conftest.py` and `tests/repositories/tenant/conftest.py` that delegate to the shared `clean_tenants` fixture in `tests/conftest.py`
- [x] 8.6 Update `tests/conftest.py` `db_engine` session fixture to run `await conn.run_sync(Base.metadata.drop_all)` BEFORE `Base.metadata.create_all` so schema additions (e.g. `deleted_at`, future audit columns) apply to a previously-created test DB on the same volume
- [x] 8.7 Add a `session_actor` pytest fixture in `tests/conftest.py` (default returns `None`) and have the `db_session` fixture write `session.info[SESSION_ACTOR_KEY] = session_actor` when not `None` before yielding. Per-test overrides supply a `SessionUser` to exercise audit auto-fill — that exercise lives in `backend-user-auth-base`; in this change the fixture exists but stays unused

## 9. AGENTS + capability docs

- [x] 9.1 Update `apps/backend/AGENTS.md` "Coding Rules" so the "Seed data via scripts, not Alembic" entry points at `scripts/`, references `python -m scripts.<name>`, and removes the Typer requirement
- [x] 9.2 Add a `scripts/*` row to the AGENTS "Layer Rules" table allowing imports of `app.core.*`, `app.db.*`, `app.repositories.*`, `app.services.*`, sibling `scripts.*` and forbidding `app.api.*` / `fastapi.*`
- [x] 9.3 Add `scripts/` to the AGENTS "Layout" ASCII tree

## 10. Quality Gates

- [x] 10.1 `moon run backend:lint` clean
- [x] 10.2 `moon run backend:format` clean
- [x] 10.3 `moon run backend:typecheck` clean
- [x] 10.4 `moon run backend:test -- tests/repositories/tenant tests/scripts` green
- [x] 10.5 `moon run backend:test` full suite green
- [x] 10.6 Bring up the stack: `moon run backend:dev`. Confirm entrypoint logs show `alembic upgrade head` then `seeded tenant slug=zas`. Run `moon run backend:psql -c 'select id, slug, name from tenants'` — returns one row with `id = ZAS_TENANT_ID`. Re-run `moon run backend:seed-tenant`, confirm no-op log
