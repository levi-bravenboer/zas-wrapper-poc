## Why

PoC needs the `F1 Login` + `F8 Admin` features wired end-to-end on the backend before any clinician-facing feature (`F2`..`F7`) can call `CurrentUserDep`. The existing `auth-stub` spec defines the cookie surface but pins the user store to an in-memory dict — usable for a smoke test, useless once an admin needs to "assign caregiver role" (F8) or any other domain wants per-user audit. This change replaces the in-memory store with DB-backed users, lines up identity on email (so MVP eID claims map cleanly), and lands the dependency surface (`CurrentUserDep`, `require_role`) other domains will sit on top of.

Tier: `[poc]`.

## What Changes

- Add `users` table with `id` (UUID), `tenant_id` (FK `tenants.id`, NOT NULL), `email`, `password_hash` (argon2), `display_name`, `role` (Postgres-native enum), `is_active`, `created_at`, `updated_at`. Unique on `(tenant_id, lower(email))`; index on `(tenant_id, role)`.
- Add `Role` enum at `app/core/enums/user.py` with values `admin`, `caregiver`, `external`. Re-exported from `app/core/enums/__init__.py`. Mapped to a Postgres `enum` type via `sa.Enum(Role, name="role", native_enum=True, create_constraint=True)`.
- Add `User` SQLAlchemy ORM model under `app/db/models/user/`.
- Add `UserRepository` under `app/repositories/user/` (`get_by_email`, `get_by_id`, `list_in_tenant`, `update`).
- Add `UserService` under `app/services/user/` exposing admin operations (`list_in_tenant`, `assign_role`).
- Add `AuthService` under `app/services/auth/` with an `Authenticator` Protocol seam and a `PasswordAuthenticator` implementation (argon2 verify) — MVP eID lands as a sibling `EidAuthenticator` impl without touching callers.
- Add `app/services/auth/deps.py` exporting `AuthServiceDep`, `CurrentUserDep`, and a `require_role(Role)` factory dep.
- Add `app/api/routers/auth/auth_router.py` (`POST /auth/login`, `GET /auth/me`, `POST /auth/logout`) per the modified `auth-stub` spec — uses DB-backed `AuthService`, login key is `email`, and `SessionUser` now carries `tenant_id` + `role`.
- Add `app/api/routers/user/user_router.py` (`GET /users` admin-only list, `PATCH /users/{user_id}/role` admin-only role update), both tenant-scoped via `CurrentUserDep.tenant_id`.
- Add **BREAKING** changes to `auth-stub`: login key flips from `username` to `email`; `SessionUser` gains `tenant_id` + `role`; in-memory store retired in favour of `UserRepository`. The shape change is justified by the spec never having been implemented.
- Add `argon2-cffi` and `alembic-postgresql-enum` Python deps to `apps/backend/pyproject.toml`. Import `alembic_postgresql_enum` in `alembic/env.py` so Postgres-native enum autogenerate produces correct `CREATE TYPE` / `DROP TYPE` / `ALTER TYPE ADD VALUE` ops.
- Alembic revision creates the `users` table — **schema only, no seed**. Bootstrap admin + demo caregiver are inserted by a new `seed-users` Typer subcommand under `app/cli/`, extending the CLI surface introduced by `backend-tenant-base`. The `seed-all` umbrella is extended to invoke `seed-tenant` then `seed-users`. Passwords come from `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` / `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` env vars; if unset, fall back to `"changeme"` and the CLI logs a `WARNING` (no `# POC ONLY` banner in alembic since alembic no longer touches user data — the banner sits on `app/cli/seed.py`).

## Capabilities

### New Capabilities

- `user-base`: persistence + admin-operations layer for users. Owns the `users` table, `User` ORM model, `UserRepository`, `UserService`, and the admin-only HTTP surface (`GET /users`, `PATCH /users/{user_id}/role`). Includes the `Role` enum and its placement under `app/core/enums/user.py`.

### Modified Capabilities

- `auth-stub`: switches the backing store from in-memory dict to `UserRepository`; flips login key from `username` to `email`; expands `SessionUser` with `tenant_id` and `role`; introduces the `Authenticator` Protocol seam and `PasswordAuthenticator` implementation. Cookie shape, `itsdangerous` signing, 8h TTL, security flags, and operation IDs stay as currently specified.
- `backend-cli`: extends the CLI introduced by `backend-tenant-base` with `seed-users` and updates `seed-all` to chain `seed-tenant → seed-users`. No structural change to the CLI scaffolding itself.

## Impact

- **Code**: new files under `app/db/models/user/`, `app/repositories/user/`, `app/services/user/`, `app/services/auth/`, `app/api/routers/user/`, `app/api/routers/auth/`, `app/schemas/user/`, `app/schemas/auth/`, `app/core/enums/`. New seed function in `app/cli/seed.py` and a registered `seed-users` subcommand on the existing Typer `app`. `alembic/env.py` gains a single import (`alembic_postgresql_enum`).
- **Schema**: new `users` table, new Postgres `role` enum type. `users.tenant_id` FK depends on `tenants` table from `backend-tenant-base` already being applied.
- **Migrations**: this change's revision must be ordered AFTER the `backend-tenant-base` revision (set `down_revision` to that revision's hash). DDL only — no `op.bulk_insert`.
- **Seed**: bootstrap admin + caregiver inserted via `python -m app.cli seed-users` (or `seed-all`). Dev entrypoint already chains migrate + `seed-all` (set up in `backend-tenant-base`), so adding `seed-users` to the umbrella is enough — no entrypoint edit here.
- **Deps**: `pyproject.toml` adds `argon2-cffi`, `alembic-postgresql-enum`. `uv.lock` regenerates.
- **Specs**: new `user-base` spec, delta on existing `auth-stub` spec, delta on the `backend-cli` capability introduced by `backend-tenant-base`.
- **Tests**: repository tests (`get_by_email`, `list_in_tenant`, uniqueness), service tests (`assign_role`, cross-tenant rejection), auth-service tests (`authenticate`, session mint/verify, expired session, role gating), router tests (login flow, admin-only guards, /auth/me parity).
- **Frontend**: out of scope — orchestrator wiring lands in a follow-up change once routes are stable.
- **MVP**: eID lands as a new `EidAuthenticator` sibling that satisfies the `Authenticator` Protocol; `users.password_hash` likely drops or becomes nullable at that point, but no churn to call sites.
