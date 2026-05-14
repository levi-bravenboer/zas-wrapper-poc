## 1. Dependencies + AGENTS.md

- [ ] 1.1 Add `argon2-cffi` and `alembic-postgresql-enum` to `apps/backend/pyproject.toml`; regenerate `uv.lock` via `moon run backend:install`
- [ ] 1.2 Add `import alembic_postgresql_enum  # noqa: F401` to `apps/backend/alembic/env.py` (top of file, after `from __future__ import annotations`)
- [ ] 1.3 Verify `apps/backend/AGENTS.md` mentions the `app/core/enums/<domain>.py` convention and the `alembic-postgresql-enum` rule (already added in this change; sanity-check after rebase)

## 2. Role enum

- [ ] 2.1 Create `apps/backend/app/core/enums/__init__.py` that re-exports `Role`
- [ ] 2.2 Create `apps/backend/app/core/enums/user.py` with `class Role(StrEnum)` and members `ADMIN = "admin"`, `CAREGIVER = "caregiver"`, `EXTERNAL = "external"`. Stdlib-only — no `pydantic`, no `sqlalchemy`, no `app.*` imports

## 3. User ORM model

- [ ] 3.1 Create `apps/backend/app/db/models/user/__init__.py` re-exporting `User`
- [ ] 3.2 Create `apps/backend/app/db/models/user/user.py` with `User(Base)` mapping the `users` table per spec (UUID pk, tenant FK ON DELETE RESTRICT, email, password_hash, display_name, `role: Mapped[Role] = mapped_column(sa.Enum(Role, name="role", native_enum=True, create_constraint=True))`, is_active, timestamps)
- [ ] 3.3 Add the functional unique index `UNIQUE (tenant_id, lower(email))` and supporting index `(tenant_id, role)` to the model's `__table_args__`
- [ ] 3.4 Import `app.db.models.user` from `apps/backend/app/db/models/__init__.py` so alembic autogenerate sees it

## 4. Password hasher wrapper

- [ ] 4.1 Create `apps/backend/app/services/auth/password.py` with `class PasswordHasher` wrapping `argon2.PasswordHasher`, exposing `hash(plain: str) -> str` and `verify(hashed: str, plain: str) -> bool` (catching `argon2.exceptions.VerifyMismatchError` and returning `False`)

## 5. Authenticator Protocol + PasswordAuthenticator

- [ ] 5.1 Create `apps/backend/app/services/auth/authenticator.py` with `class Authenticator(Protocol)` defining `async def authenticate(self, *, email: str, password: str) -> User | None`
- [ ] 5.2 Add `class PasswordAuthenticator` in the same module (constructor takes `UserRepository` and `PasswordHasher`; implementation does case-insensitive lookup via `get_by_email`, returns `None` for missing rows / inactive users / mismatched hashes)

## 6. UserRepository

- [ ] 6.1 Create `apps/backend/app/repositories/user/__init__.py` re-exporting `UserRepository` and `UserRepoDep`
- [ ] 6.2 Create `apps/backend/app/repositories/user/user_repository.py` extending `BaseRepository[User]`, implementing `get_by_id`, `get_by_email` (case-insensitive via `func.lower`), `list_in_tenant(tenant_id, *, active=None)`, `update`
- [ ] 6.3 Create `apps/backend/app/repositories/user/deps.py` defining `get_user_repository(session: SessionDep) -> UserRepository` and `UserRepoDep`

## 7. AuthService + errors + deps

- [ ] 7.1 Create `apps/backend/app/services/auth/errors.py` with `InvalidCredentialsError`, `UnauthenticatedError`, `ForbiddenRoleError` (subclasses of `AppError`, with codes per design)
- [ ] 7.2 Create `apps/backend/app/services/auth/auth_service.py` with `class AuthService` (constructor: `Authenticator`, `UserRepository`, `Settings`). Methods: `login(email, password) -> SessionUser` (raises `InvalidCredentialsError`), `mint_session_token(user_id) -> str` (uses `itsdangerous.URLSafeTimedSerializer`), `verify_session_token(token) -> UUID` (returns user_id, raises `UnauthenticatedError` on bad/expired token; max age 8h), `load_session_user(user_id) -> SessionUser` (DB load + inactive check)
- [ ] 7.3 Create `apps/backend/app/services/auth/deps.py`:
   - factory `get_auth_service(...)` and `AuthServiceDep`
   - `async def get_current_user(...)` reads cookie via `Request`, calls `verify_session_token` + `load_session_user`, returns `SessionUser`
   - `CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]`
   - `def require_role(role: Role) -> Callable[..., SessionUser]` factory returning a Depends-compatible callable that raises `ForbiddenRoleError` if mismatched
- [ ] 7.4 Update `apps/backend/app/services/auth/__init__.py` to re-export `AuthService`, `AuthServiceDep`, `CurrentUserDep`, `require_role`

## 8. UserService + errors + deps

- [ ] 8.1 Create `apps/backend/app/services/user/errors.py` with `UserNotFoundError`, `CrossTenantAccessError`
- [ ] 8.2 Create `apps/backend/app/services/user/user_service.py` with `class UserService(repo: UserRepository)`. Methods: `list_in_tenant(tenant_id, *, active=None)`, `assign_role(actor: SessionUser, target_user_id: UUID, role: Role)` enforcing the cross-tenant / not-found rules. Self-targets MUST be permitted — no `SelfRoleChangeError`
- [ ] 8.3 Create `apps/backend/app/services/user/deps.py` with `get_user_service` factory and `UserServiceDep`
- [ ] 8.4 Update `apps/backend/app/services/user/__init__.py` re-exports

## 9. Schemas

- [ ] 9.1 Create `apps/backend/app/schemas/auth/auth.py` with `LoginRequest { email: EmailStr, password: SecretStr }` and `SessionUser { id: UUID, email: EmailStr, display_name: str, tenant_id: UUID, role: Role }`. Import `Role` from `app.core.enums.user`
- [ ] 9.2 Update `apps/backend/app/schemas/auth/__init__.py` re-exports
- [ ] 9.3 Create `apps/backend/app/schemas/user/user.py` with `UserRow { id, email, display_name, role, is_active, created_at }` and `AssignRoleRequest { role: Role }`
- [ ] 9.4 Update `apps/backend/app/schemas/user/__init__.py` re-exports

## 10. Routers

- [ ] 10.1 Create `apps/backend/app/api/routers/auth/auth_router.py` exposing `router = APIRouter(tags=["auth"])` with `POST /auth/login` (operation_id `login_user`), `GET /auth/me` (`get_current_user`), `POST /auth/logout` (`logout_user`). Login uses `AuthServiceDep`; me uses `CurrentUserDep`; logout clears the cookie. Cookie set with `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` iff `Settings.env == "production"`
- [ ] 10.2 Create `apps/backend/app/api/routers/user/user_router.py` exposing `router = APIRouter(tags=["users"])` with `GET /users` (operation_id `list_tenant_users`, query param `active: bool | None = None`, guarded by `Depends(require_role(Role.ADMIN))`) and `PATCH /users/{user_id}/role` (operation_id `update_user_role`, body `AssignRoleRequest`, same guard, returns updated `UserRow`)
- [ ] 10.3 Register both routers in `apps/backend/app/main.py` (or wherever the app factory composes routers)
- [ ] 10.4 In the FastAPI lifespan startup, add a guard: if `settings.env == "production"` and `settings.session_secret_key == "change-me-in-production"`, raise `RuntimeError("session_secret_key must be overridden in production")` before yielding. Non-production envs skip the check

## 11. Alembic revision (schema only)

- [ ] 11.1 Generate revision: `moon run backend:make-migration "create users table"`
- [ ] 11.2 Set `down_revision = "<backend-tenant-base revision hash>"`; verify the chain is `None → tenants → users`
- [ ] 11.3 In `upgrade()`, create the `role` Postgres enum and the `users` table per spec, including the functional unique index `(tenant_id, lower(email))` and the `(tenant_id, role)` index
- [ ] 11.4 In `downgrade()`, drop the `users` table then drop the `role` enum type (`alembic-postgresql-enum` handles the `DROP TYPE` op)
- [ ] 11.5 Verify the revision contains **no** `op.bulk_insert` / `op.execute("INSERT ...")` — DDL only. No `# POC ONLY` banner needed (alembic touches no user data)

## 12. `seed-users` CLI subcommand

- [ ] 12.1 Add `# POC ONLY — bootstrap seed; replace before non-PoC deployment` banner at the top of `apps/backend/app/cli/seed.py` (the file introduced by `backend-tenant-base`)
- [ ] 12.2 Add `seed_users` async function in `app/cli/seed.py` that:
   1. Opens a CLI session (via `_db.py` helper from `backend-tenant-base`)
   2. Looks up the `zas` tenant via `TenantRepository.get_by_slug("zas")`; if missing, log `ERROR cannot seed users: zas tenant missing — run seed-tenant first` and exit non-zero
   3. For each of `(admin@zas.local, admin, "ZAS Admin", BACKEND_BOOTSTRAP_ADMIN_PASSWORD)` and `(caregiver@zas.local, caregiver, "Demo Caregiver", BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD)`: call `UserRepository.get_by_email(zas_tenant_id, email)`; insert if `None`, no-op if present
   4. Derive the `password_hash` via `PasswordHasher().hash(os.getenv(<var>, "changeme"))`; log a `WARNING` line `"bootstrap password env var <name> unset, using 'changeme' fallback"` when the env var is missing
   5. Log `INFO seeded user email=<email> role=<role>` on insert, `INFO user email=<email> already present` on no-op
- [ ] 12.3 Register the subcommand on the Typer `app` (from `app/cli/__init__.py`) with name `seed-users`
- [ ] 12.4 Extend the `seed-all` subcommand (introduced by `backend-tenant-base`) so it invokes `seed_tenant` first, then `seed_users`. If `seed_tenant` raises, `seed_users` MUST NOT run

## 13. Moon + entrypoint wiring

- [ ] 13.1 Add `seed-users` task to `apps/backend/moon.yml` running `python -m app.cli seed-users` inside `zas_backend`
- [ ] 13.2 No edit to `apps/backend/docker/entrypoint.sh` — it already chains `seed-all` (set up in `backend-tenant-base`), and `seed-all` now picks up `seed-users` automatically
- [ ] 13.3 Confirm `zas_backend_test` entrypoint (or compose override) still runs migrate only — NO `seed-all` invocation
- [ ] 13.4 Update `apps/backend/README.md` per-task table to list the new `seed-users` moon task and the `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` / `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` env vars

## 14. Tests

- [ ] 14.1 `tests/repositories/user/test_user_repository.py` — case-insensitive `get_by_email`, tenant-scoped `list_in_tenant`, active filter, unique-violation on duplicate `lower(email)` per tenant, same email across tenants succeeds
- [ ] 14.2 `tests/services/auth/test_password_hasher.py` — round-trip hash + verify, verify rejects wrong password
- [ ] 14.3 `tests/services/auth/test_authenticator.py` — `PasswordAuthenticator` happy path, wrong password returns `None`, inactive user returns `None`, unknown email returns `None`
- [ ] 14.4 `tests/services/auth/test_auth_service.py` — `login` happy path returns `SessionUser` w/ tenant_id+role, `login` invalid credentials raises, `mint`/`verify` round-trip, expired token raises, deactivated-user re-load raises
- [ ] 14.5 `tests/services/user/test_user_service.py` — `assign_role` happy path, cross-tenant raises, missing target raises, self-target succeeds and persists the new role
- [ ] 14.6 `tests/api/routers/auth/test_auth_router.py` — full login/me/logout flow against seeded admin, invalid creds → 401, /auth/me without cookie → 401, expired cookie → 401, deactivated user via /auth/me → 401, cookie security flags present
- [ ] 14.7 `tests/api/routers/user/test_user_router.py` — caregiver cannot list (403), admin lists seeded users, admin updates caregiver role (200), cross-tenant target → 403, self target → 200 (and the same client's next admin-only request → 403 because role re-loaded as `caregiver`)
- [ ] 14.8 `tests/cli/test_seed_users.py` — against a DB seeded with the `zas` tenant: `seed-users` inserts both rows with correct email/role/tenant_id; second invocation no-ops; missing tenant exits non-zero with the documented log line; `BACKEND_BOOTSTRAP_ADMIN_PASSWORD=s3cret` env var produces a hash that argon2-verifies against `"s3cret"`; unset env var falls back to `"changeme"` and emits the `WARNING` log line
- [ ] 14.9 Extend the `seeded_zas_tenant` fixture story (from `backend-tenant-base`) with a `seeded_zas_users` fixture in `tests/conftest.py` that invokes the CLI seed function and yields the two seeded `User` rows — downstream domain tests reuse it

## 15. Quality gates

- [ ] 15.1 `moon run backend:lint` clean
- [ ] 15.2 `moon run backend:format` clean
- [ ] 15.3 `moon run backend:typecheck` clean
- [ ] 15.4 `moon run backend:test -- tests/services/auth tests/services/user tests/repositories/user tests/api/routers/auth tests/api/routers/user tests/cli` green
- [ ] 15.5 `moon run backend:test` full suite green
- [ ] 15.6 Spin up `moon run backend:dev`; confirm entrypoint logs show `alembic upgrade head` → `seeded tenant slug=zas` → `seeded user email=admin@zas.local` → `seeded user email=caregiver@zas.local`. Re-run `moon run backend:seed-users`, confirm no-op logs. Hit `POST /auth/login` with seeded admin via curl or /docs, verify cookie set + `SessionUser` shape; hit `GET /users` with the cookie, verify list contains both seeded users; hit `PATCH /users/<caregiver_id>/role` with `{"role":"external"}`, verify update; logout, verify subsequent `GET /auth/me` returns 401
- [ ] 15.7 `moon run backend:openapi` regenerates `openapi.json`; commit the regenerated file alongside the change

## 16. OpenAPI client regen (orchestrator)

- [ ] 16.1 Run the orchestrator's typegen step to consume the regenerated `openapi.json` (deferred: only land if it is fast and non-breaking; otherwise queue under a follow-up frontend change)
