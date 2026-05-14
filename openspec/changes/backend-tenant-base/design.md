## Context

Backend is greenfield on the data side: `app/db/models/` contains only `__init__.py`, `alembic/versions/` is empty, and no domain tables exist yet. Postgres + async SQLAlchemy + alembic are already wired (see `app/db/engine.py`, `alembic/env.py`). The container entrypoint runs `alembic upgrade head` on start, so any new revision applies automatically.

The PoC runs against a single hospital (ZAS Antwerpen). Multi-tenant scoping middleware, tenant admin, and per-tenant configuration are out of PoC scope. But every future domain table (`users`, `pathways`, `patients`, `tasks`) will FK to a tenant row, so we want the table and a seeded row to exist before those domains land — otherwise each follow-up change has to bundle "create tenants table" as a side quest.

Stakeholders: backend (this change), every future backend domain (consumer of the FK), seed/onboarding flow (relies on `zas` slug existing on boot).

## Goals / Non-Goals

**Goals:**

- Persist a `tenants` table with stable shape (`id`, `slug`, `name`, timestamps).
- Seed exactly one row (`slug=zas`) as part of the same revision, so a fresh DB is immediately usable.
- Provide a thin `TenantRepository` so downstream services can look up the active tenant by slug without rewriting query code.
- Establish the alembic data-migration pattern (`op.bulk_insert`) for future seeds.

**Non-Goals:**

- HTTP API for tenants. No router, no schema, no operations exposed.
- Tenant resolution middleware / request-scoped tenant context. Future change.
- User, membership, role tables. Future change.
- Multi-tenant write paths or per-tenant config rows.

## Decisions

### Primary key: UUID (uuid7) over autoincrement integer

`Tenant.id` is `UUID` (Postgres `uuid` column), default generated server-side via `gen_random_uuid()` (pgcrypto) — or app-side via `uuid.uuid4()` if pgcrypto extension cost outweighs benefit at PoC scale.

- **Why**: every future domain FKs to this id; UUIDs avoid the integer-id leakage problem and make later sharding / multi-region cheap. Cost (16 bytes vs 4) is negligible for a hospital-scale table.
- **Alternative**: bigint autoincrement. Faster joins on huge tables, but tenants are O(10) rows ever — index size is irrelevant.
- **Decision**: app-side `uuid.uuid4()` default in the model. Avoids needing the pgcrypto extension in PoC; revisit at MVP if we standardise on DB-side UUIDs.

### Slug uniqueness + format

`slug` is `CITEXT` if available, else `VARCHAR(63)` with a unique index and a CHECK constraint enforcing `^[a-z][a-z0-9-]{0,62}$`.

- **Why**: slugs are the human-readable, URL-safe identifier used in routes (`/t/zas/...`) and tooling (`ZAS_TENANT_SLUG` env). Locking the regex now prevents accidental whitespace, uppercase, or unicode slipping in via future admin tooling.
- **Alternative**: skip CHECK, validate in Pydantic. Rejected — db is the only enforceable boundary across future tooling (alembic seeds, psql, scripts).
- **Decision**: plain `VARCHAR(63)` (matches Postgres identifier length) + unique index + CHECK. Skip CITEXT to keep migration portable.

### Timestamps: `created_at` + `updated_at` with `server_default=now()`

Standard housekeeping columns. `updated_at` updated app-side via `onupdate=datetime.now(UTC)` on the SQLAlchemy column; we do not add a Postgres trigger because the PoC has no out-of-band writers.

### Seed via Typer CLI, not alembic revision

Alembic revisions are schema-only. The `zas` row is inserted by a Typer subcommand `seed-tenant` under `app/cli/`, invoked as `python -m app.cli seed-tenant`. Idempotent: the command looks up the tenant by slug and no-ops if present.

- **Why**: separates schema (DDL — versioned forever, runs once per environment) from operational data (rows — re-runnable, env-dependent). Test DB stays empty after migrate. Prod deploys can re-seed without rolling a new migration. The CLI module also gives us the natural home for every future seed/maintenance/import command (`seed-users` lands in the user-auth change, future imports follow).
- **Alternative — `op.bulk_insert` in the revision**: tight coupling between schema and one specific seed row; test DB inherits the seed; "re-seed without a migration" requires SQL gymnastics. Rejected.
- **Alternative — startup hook in `app/main.py` lifespan**: every test client + every prod replica runs the hook; needs locking or `INSERT ... ON CONFLICT DO NOTHING` boilerplate; pollutes the app surface with data-management concerns. Rejected.
- **Constraint**: the seeded tenant id must be stable across environments so future seed commands (`seed-users`, etc.) can reference it. The CLI uses a hard-coded UUID literal for the `zas` row, defined as a module-level constant in `app/cli/seed.py` and re-used by tests + later seed commands.

### CLI shape

`app/cli/` is a Typer-based command group invoked via `python -m app.cli`. PoC subcommands land incrementally:

- `seed-tenant` (this change) — inserts the `zas` tenant if missing.
- `seed-users` (`backend-user-auth-base`) — inserts the bootstrap admin + demo caregiver if missing.
- `seed-all` (`backend-user-auth-base`) — runs `seed-tenant` then `seed-users`.

Each subcommand:

- Builds its own short-lived `AsyncEngine` + session (does NOT depend on the FastAPI app state).
- Uses the existing repositories — no raw SQL.
- Logs `INFO` on insert, `INFO` on no-op (idempotency confirmation), `ERROR` on unexpected failure.
- Returns exit code 0 on success (including no-op), non-zero on failure.

Moon tasks (in `apps/backend/moon.yml`) wrap the CLI for the standard `zas_backend` container, e.g. `moon run backend:seed-tenant`, `moon run backend:seed-users`, `moon run backend:seed`.

The dev container entrypoint becomes `alembic upgrade head && python -m app.cli seed-all` (in this change the `seed-all` group resolves to just `seed-tenant`; once the user change lands it includes users too). Test container entrypoint stays migrate-only.

### Repository surface

`TenantRepository` exposes `get_by_slug(slug: str) -> Tenant | None` and inherits `list()` from `BaseRepository`. No `add` / `update` / `delete` — there is no service path that needs them in PoC.

### Module layout

Follows the per-domain split mandated by `apps/backend/AGENTS.md`:

```
app/db/models/tenant/
  __init__.py         # re-exports Tenant
  tenant.py           # ORM model
app/repositories/tenant/
  __init__.py         # re-exports TenantRepository, TenantRepoDep
  tenant_repository.py
  deps.py             # TenantRepoDep alias
```

No service / router / schema folders yet — this change is pure persistence.

## Risks / Trade-offs

- **Risk**: future change forgets the FK on a new domain table → orphaned rows. **Mitigation**: document in `app/db/models/tenant/__init__.py` that any new domain model with rows owned by a tenant must FK to `tenants.id` and include the column in its primary unique indexes.
- **Risk**: app-side UUID default means alembic autogen won't notice DB-side default mismatches. **Mitigation**: acceptable at PoC; revisit when we standardise.
- **Risk**: prod deploy runs `alembic upgrade head` but forgets to run `python -m app.cli seed-all` → empty `users` table, login broken. **Mitigation**: dev entrypoint chains the two; document the chain prominently in `apps/backend/README.md`; CI runs the seed step as part of the deploy script.
- **Risk**: seed UUID literal hard-coded in `app/cli/seed.py` drifts from any test fixture that hard-codes it. **Mitigation**: export the literal as `ZAS_TENANT_ID: UUID = UUID("...")` from a single module; tests + later seeds import it.
- **Trade-off**: CHECK constraint on slug locks the regex in the schema — adjusting it later requires a migration. Accepted; the regex is conservative.
- **Trade-off**: adding a CLI module is a new surface area (Typer dep, entrypoint, moon task). Accepted — pays for itself the moment a second seed/operational command lands (which is in the immediately-following `backend-user-auth-base` change).

## Migration Plan

- Forward: dev container entrypoint runs `alembic upgrade head` (creates `tenants` DDL), then `python -m app.cli seed-all` (inserts `zas` row idempotently).
- Rollback: `alembic downgrade -1` drops the table; the seed row goes with it. CLI no-op next time it runs against an empty DB → inserts again.
- Re-seed without migration: just re-run `moon run backend:seed-tenant`. Idempotent.
- Test DB: entrypoint runs `alembic upgrade head` only — no seed. Each test inserts what it needs via fixtures.
- No production deploy concerns — PoC only.

## Open Questions

- None blocking. Open: whether to install the `pgcrypto` extension at MVP so UUID default moves DB-side. Defer to a future infra change.
