## Context

Backend is greenfield on the data side: `app/db/models/` contains only `__init__.py`, `alembic/versions/` is empty, and no domain tables exist yet. Postgres + async SQLAlchemy + alembic are already wired (see `app/db/engine.py`, `alembic/env.py`). The container entrypoint runs `alembic upgrade head` on start, so any new revision applies automatically.

The PoC runs against a single hospital (ZAS Antwerpen). Multi-tenant scoping middleware, tenant admin, and per-tenant configuration are out of PoC scope. But every future domain table (`users`, `pathways`, `patients`, `tasks`) will FK to a tenant row, so we want the table and a seeded row to exist before those domains land — otherwise each follow-up change has to bundle "create tenants table" as a side quest.

Stakeholders: backend (this change), every future backend domain (consumer of the FK), seed/onboarding flow (relies on `zas` slug existing on boot).

## Goals / Non-Goals

**Goals:**

- Persist a `tenants` table with stable shape (`id`, `slug`, `name`, timestamps).
- Seed exactly one row (`slug=zas`) as part of the same revision, so a fresh DB is immediately usable.
- Provide a thin `TenantRepository` so downstream services can look up the active tenant by slug without rewriting query code.
- Establish the script-based seed pattern (`scripts/seed_<thing>.py`) for future seeds.

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

### Three-tier abstract ORM base hierarchy

`app/db/base.py` defines three abstract bases that every concrete model picks one of:

```
Base (DeclarativeBase)
└── Entity (__abstract__)              # id + created_at + updated_at + deleted_at
    └── AuditableEntity (__abstract__) # + created_by / updated_by / deleted_by user FKs
        └── TenantOwnedEntity (__abstract__) # + tenant_id FK (NOT NULL)
```

- `Entity` — universal id + timestamps + soft delete. Used by root rows (`Tenant`) and any future global, non-tenant-scoped entity (none planned for PoC).
- `AuditableEntity` — every row that is mutated by a known actor. Adds `created_by` / `updated_by` (`NOT NULL`) and `deleted_by` (`NULL`able). All three FK `users.id` with `ON DELETE RESTRICT`.
- `TenantOwnedEntity` — every row owned by a hospital. Adds `tenant_id` (`NOT NULL`, FK `tenants.id`, `ON DELETE RESTRICT`, indexed). Because it inherits `AuditableEntity`, hospital-owned rows are auditable by construction.

**Concrete model mapping** (PoC + planned):

- `Tenant(Entity)` — root scoping row. Skips `AuditableEntity` (would create chicken-and-egg with `users.created_by`) and `TenantOwnedEntity` (it *is* the tenant).
- `User(TenantOwnedEntity)` — lands in `backend-user-auth-base`. Users belong to a tenant and carry their own audit fields. The bootstrap admin breaks the FK cycle by self-referencing: `created_by = updated_by = own id` on insert.
- Every future hospital-owned domain (`Pathway`, `Patient`, `Task`, ...) — `TenantOwnedEntity`. Full tenant + audit coverage with zero per-domain column wiring.

- **Why three tiers**: tenant-owned rows always need audit; non-tenant-owned global rows do not exist yet but Tenant is one — so we cleanly separate the two concerns. Subclassing `Tenant` from `Entity` (not `AuditableEntity`) keeps the bootstrap from depending on a `users` row that does not exist yet.
- **Alternative — flat single base with optional columns**: nullable `tenant_id` / `created_by` defeats the FK guarantee. Rejected.
- **Alternative — sibling mixins (`SoftDeleteMixin`, `AuditMixin`, `TenantScopedMixin`)**: per-model opt-in inflates surface area and risks omission. Rejected — the seam should make missing-tenant-FK impossible to ship, not merely flag it.
- **Alternative — flip direction (`AuditableEntity(TenantOwnedEntity)`)**: implies "every audited row is tenant-scoped" but `Tenant` itself is the natural counterexample. Auditable-without-tenant is plausible (e.g. future cross-tenant admin actions); tenant-scoped-without-audit is not. Rejected.

### Soft delete is universal, opt-out via dedicated repo method

Every `Entity` row carries `deleted_at: TIMESTAMPTZ | NULL`. `BaseRepository.list()` filters `deleted_at IS NULL` by default; `BaseRepository.list_including_deleted()` opts in. `BaseRepository.soft_delete(entity)` sets `deleted_at = func.now()` and (for `AuditableEntity`) `deleted_by` from `session.info[SESSION_ACTOR_KEY]`. `BaseRepository.hard_delete(entity)` stays available for cases where retention rules forbid keeping the row.

- **Why default-on**: healthcare workloads almost never want a true `DELETE` — clinical undo, audit reconstruction, and accidental-deletion recovery all require the row to survive. Defaulting `list()` to soft-delete-aware avoids 100% of "I forgot the filter" leaks.
- **Custom repo queries**: any subclass method that does `select(model)` MUST add `.where(model.deleted_at.is_(None))` unless it intentionally surfaces deleted rows. Documented in `app/repositories/base.py` docstring.

### Audit hook via `session.info` + `before_flush` listener

`app/db/audit.py` exposes `SESSION_ACTOR_KEY = "actor"` and `install_audit_hooks()`. The latter registers ONE module-level listener on SQLAlchemy's `Session.before_flush` event. On every flush, the listener reads `session.info.get(SESSION_ACTOR_KEY)`; if an actor is set, it stamps:

- `tenant_id` on every new `TenantOwnedEntity` whose `tenant_id` is `None`.
- `created_by` + `updated_by` on every new `AuditableEntity` whose corresponding field is `None`.
- `updated_by` on every dirty `AuditableEntity` (whether or not the caller touched the column).

`session.info` is the canonical SQLAlchemy slot for session-scoped, non-persisted state (docs: `Session.info`). It is naturally scoped to a single session — no global, no ContextVar leak across asyncio tasks, no per-call boilerplate at the repo seam.

- **Why a hook, not explicit repo args**: forcing every caller to pass `actor=` to `repo.create()` / `repo.update()` adds a parameter that the type system cannot keep honest, and skipping it silently produces orphaned rows. A session-level hook makes the stamp the default; bypass requires explicitly setting the field before flush.
- **Why `session.info`, not `ContextVar`**: ContextVar bleeds into background tasks and test fixtures unless every entry point resets it; misses make audit fields silently wrong. `session.info` is set when the session is built (one place per entry point: HTTP dep, script helper, test fixture) and cannot escape that session.
- **Why one module-level listener, not per-session**: SQLAlchemy event listeners on the `Session` class fire for every session; one registration at app import is sufficient. Tests reset registrations only if they swap `Base` — they don't.
- **Why `before_flush`, not `before_insert`/`before_update`**: `before_flush` runs before SQLAlchemy emits SQL, sees both `session.new` and `session.dirty`, and operates on Python objects (so we can read `obj.tenant_id is None`). Per-mapper insert/update hooks fire mid-emit and complicate the dirty-update path.
- **What happens with no actor**: the listener early-returns. Bootstrap script (`seed_tenant`) and the unauthenticated request path leave `session.info[SESSION_ACTOR_KEY]` unset; rows that REQUIRE `created_by` (i.e. `AuditableEntity` rows) MUST be inserted by callers that DO set the actor (script: `seed_users` passes the just-inserted admin; HTTP: any auth-gated route resolves `CurrentUserDep` first). The hook does NOT enforce non-null — the DB does, via `NOT NULL` on `created_by` / `updated_by`. A caller that forgets to set the actor gets an `IntegrityError` at flush, not silent corruption.

### Actor wiring per entry point

- **HTTP**: `app/db/engine.get_session` resolves the optional current user (dep introduced by `backend-user-auth-base`) and writes `session.info[SESSION_ACTOR_KEY]` before yielding. In this change the slot is reserved but unset — no `users` table exists yet, so the hook stays idle. Once auth lands, every authenticated route automatically populates audit fields without per-handler boilerplate.
- **Scripts**: `scripts/_db.script_session(*, actor: SessionUser | None = None)` writes `session.info[SESSION_ACTOR_KEY]` when an actor is supplied. `run_script(coro_factory, *, actor=None)` forwards. Bootstrap seeds that have no actor (`seed_tenant`) pass `actor=None`; seeds that need audit (`seed_users` after creating the admin row) pass a `SessionUser` built from the admin.
- **Tests**: a `session_actor` pytest fixture (defaults `None`) is read by the shared `db_session` fixture, which writes `session.info[SESSION_ACTOR_KEY]`. Per-test overrides supply an admin or caregiver `SessionUser` to exercise audit paths.

### Bootstrap self-reference

The admin user row is the FK cycle's escape hatch: it is inserted with `id`, `created_by`, and `updated_by` all set to the same generated UUID literal (`scripts.seed_users.ADMIN_USER_ID`). After that insert, every subsequent `AuditableEntity` row in PoC can rely on the admin existing as a valid FK target. The detailed pattern lives in `backend-user-auth-base/design.md`; this change establishes that the abstract base hierarchy MUST support it (i.e. `created_by` is `NOT NULL` but the row may FK to itself).

### Timestamps: `created_at` + `updated_at` with `server_default=now()`

Standard housekeeping columns. `updated_at` updated app-side via `onupdate=datetime.now(UTC)` on the SQLAlchemy column; we do not add a Postgres trigger because the PoC has no out-of-band writers.

### Seed via standalone scripts, not alembic revision

Alembic revisions are schema-only. The `zas` row is inserted by `scripts/seed_tenant.py`, invoked as `python -m scripts.seed_tenant`. Idempotent: the script looks up the tenant by slug and no-ops if present.

- **Why**: separates schema (DDL — versioned forever, runs once per environment) from operational data (rows — re-runnable, env-dependent). Test DB stays empty after migrate. Prod deploys can re-seed without rolling a new migration. The scripts package also gives us the natural home for every future seed/maintenance/import command (`seed_users.py` lands in the user-auth change, future imports follow).
- **Alternative — `op.bulk_insert` in the revision**: tight coupling between schema and one specific seed row; test DB inherits the seed; "re-seed without a migration" requires SQL gymnastics. Rejected.
- **Alternative — startup hook in `app/main.py` lifespan**: every test client + every prod replica runs the hook; needs locking or `INSERT ... ON CONFLICT DO NOTHING` boilerplate; pollutes the app surface with data-management concerns. Rejected.
- **Alternative — Typer CLI group**: pulls in a CLI framework dependency for what each seed script needs anyway (a single `main()` entry). Plain `python -m scripts.<name>` is one less moving part, and the entry-point lives next to the data it owns. Rejected.
- **Constraint**: the seeded tenant id must be stable across environments so future seed scripts (`seed_users`, etc.) can reference it. `scripts/seed_tenant.py` defines a hard-coded UUID literal `ZAS_TENANT_ID` re-used by tests + later seeds.

### Scripts package shape

`apps/backend/scripts/` is a regular Python package (with `__init__.py`) invoked via `python -m scripts.<name>`. PoC modules land incrementally:

- `seed_tenant.py` (this change) — inserts the `zas` tenant if missing.
- `seed_users.py` (`backend-user-auth-base`) — inserts the bootstrap admin + demo caregiver if missing.
- `seed_all.py` (this change, extended by the user change) — chains `seed_zas_tenant` and later `seed_users`.

Each script:

- Builds its own short-lived `AsyncEngine` + session via `scripts._db.script_session()` (does NOT depend on the FastAPI app state).
- Exposes an importable async helper (e.g. `async def seed_zas_tenant(session)`) plus a sync `main()` entry — tests drive the helper directly, the container entrypoint and moon tasks run `main()`.
- Calls `app.core.logging.configure_logging(get_settings())` at entry so output matches the FastAPI runtime formatter (JSON in `production`, human-readable elsewhere).
- Uses the existing repositories — no raw SQL.
- Logs `INFO` on insert, `INFO` on no-op (idempotency confirmation), `ERROR` on unexpected failure.
- Returns exit code 0 on success (including no-op), non-zero on failure.

Moon tasks (in `apps/backend/moon.yml`) wrap the scripts for the standard `zas_backend` container, e.g. `moon run backend:seed-tenant`, `moon run backend:seed`.

The dev container entrypoint becomes `alembic upgrade head && python -m scripts.seed_all` (in this change `seed_all` resolves to just `seed_zas_tenant`; once the user change lands it includes users too). Test container entrypoint stays migrate-only.

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

- **Risk**: future change forgets the FK on a new domain table → orphaned rows. **Mitigation**: the abstract base hierarchy makes the FK structural — any model that should be tenant-scoped inherits `TenantOwnedEntity` and so cannot ship without `tenant_id`. AGENTS.md restates the rule.
- **Risk**: caller forgets to set `session.info[SESSION_ACTOR_KEY]` before flushing an `AuditableEntity` row → `IntegrityError`. **Mitigation**: the DB constraint is the safety net (loud failure, not silent corruption). Each entry point (HTTP `get_session`, `script_session(actor=)`, `db_session` fixture via `session_actor`) writes the slot in exactly one place; missing wiring fails fast in tests.
- **Risk**: a soft-deleted row leaks into a custom repo query that forgot the `deleted_at IS NULL` predicate. **Mitigation**: `BaseRepository.list()` default is correct; `BaseRepository.list_including_deleted()` is the only opt-in path; the rule is documented in `app/repositories/base.py` docstring and AGENTS.md. A future hardening change can switch to `with_loader_criteria` for defense in depth.
- **Risk**: app-side UUID default means alembic autogen won't notice DB-side default mismatches. **Mitigation**: acceptable at PoC; revisit when we standardise.
- **Risk**: prod deploy runs `alembic upgrade head` but forgets to run `python -m scripts.seed_all` → empty `users` table, login broken. **Mitigation**: dev entrypoint chains the two; document the chain prominently in `apps/backend/README.md`; CI runs the seed step as part of the deploy script.
- **Risk**: seed UUID literal hard-coded in `scripts/seed_tenant.py` drifts from any test fixture that hard-codes it. **Mitigation**: export the literal as `ZAS_TENANT_ID: UUID = UUID("...")` from a single module; tests + later seeds import it.
- **Trade-off**: CHECK constraint on slug locks the regex in the schema — adjusting it later requires a migration. Accepted; the regex is conservative.
- **Trade-off**: adding a scripts package is a new surface area (entrypoint, moon tasks). Accepted — zero extra third-party deps, and the convention pays for itself the moment a second seed/operational script lands (which is in the immediately-following `backend-user-auth-base` change).

## Migration Plan

- Forward: dev container entrypoint runs `alembic upgrade head` (creates `tenants` DDL), then `python -m scripts.seed_all` (inserts `zas` row idempotently).
- Rollback: `alembic downgrade -1` drops the table; the seed row goes with it. Script no-op next time it runs against an empty DB → inserts again.
- Re-seed without migration: just re-run `moon run backend:seed-tenant`. Idempotent.
- Test DB: entrypoint runs `alembic upgrade head` only — no seed. Each test inserts what it needs via fixtures.
- No production deploy concerns — PoC only.

## Open Questions

- None blocking. Open: whether to install the `pgcrypto` extension at MVP so UUID default moves DB-side. Defer to a future infra change.
