## 1. Dependencies + AGENTS.md

- [x] 1.1 Add `argon2-cffi` and `alembic-postgresql-enum` to `apps/backend/pyproject.toml`; regenerate `uv.lock` via `moon run backend:install`
- [x] 1.2 Add `import alembic_postgresql_enum  # noqa: F401` to `apps/backend/alembic/env.py` (top of file, after `from __future__ import annotations`)
- [x] 1.3 Verify `apps/backend/AGENTS.md` mentions the `app/core/enums/<domain>.py` convention and the `alembic-postgresql-enum` rule (already added in this change; sanity-check after rebase)

## 2. Role enum

- [x] 2.1 Create `apps/backend/app/core/enums/__init__.py` that re-exports `Role`
- [x] 2.2 Create `apps/backend/app/core/enums/user.py` with `class Role(StrEnum)` and members `ADMIN = "admin"`, `CAREGIVER = "caregiver"`, `EXTERNAL = "external"`. Stdlib-only — no `pydantic`, no `sqlalchemy`, no `app.*` imports

## 3. User ORM model

- [x] 3.1 Create `apps/backend/app/db/models/user/__init__.py` re-exporting `User`
- [x] 3.2 Create `apps/backend/app/db/models/user/user.py` with `User(TenantOwnedEntity)` mapping the `users` table per spec. `User` inherits `id`, timestamps, soft delete, `tenant_id`, `created_by` / `updated_by` (NOT NULL), and `deleted_by` (nullable) from the abstract base hierarchy introduced in `backend-tenant-base`. Adds only: `email`, `password_hash`, `display_name`, `role: Mapped[Role] = mapped_column(sa.Enum(Role, name="role", native_enum=True, create_constraint=True))`, `is_active`
- [x] 3.3 Add the functional unique index `UNIQUE (tenant_id, lower(email))` and supporting index `(tenant_id, role)` to the model's `__table_args__`
- [x] 3.4 Import `app.db.models.user` from `apps/backend/app/db/models/__init__.py` so alembic autogenerate sees it
- [x] 3.5 Add a module-level comment in `user.py` documenting the self-referential FK invariant (`users.created_by` / `users.updated_by` / `users.deleted_by` all FK `users.id` with `ON DELETE RESTRICT`) and that the bootstrap admin row breaks the FK cycle by self-referencing (`created_by = updated_by = id`)

## 4. Password hasher wrapper

- [x] 4.1 Create `apps/backend/app/services/auth/password.py` with `class PasswordHasher` wrapping `argon2.PasswordHasher`, exposing `hash(plain: str) -> str` and `verify(hashed: str, plain: str) -> bool` (catching `argon2.exceptions.VerifyMismatchError` and returning `False`)

## 5. Authenticator Protocol + PasswordAuthenticator

- [x] 5.1 Create `apps/backend/app/services/auth/authenticator.py` with `class Authenticator(Protocol)` defining `async def authenticate(self, *, email: str, password: str) -> User | None`
- [x] 5.2 Add `class PasswordAuthenticator` in the same module (constructor takes `UserRepository` and `PasswordHasher`; implementation does case-insensitive lookup via `get_by_email`, returns `None` for missing rows / inactive users / mismatched hashes)

## 6. UserRepository

- [x] 6.1 Create `apps/backend/app/repositories/user/__init__.py` re-exporting `UserRepository` and `UserRepoDep`
- [x] 6.2 Create `apps/backend/app/repositories/user/user_repository.py` extending `BaseRepository[User]`, implementing `get_by_id`, `get_by_email` (case-insensitive via `func.lower`), `list_in_tenant(tenant_id, *, active=None)`, `update`
- [x] 6.3 Create `apps/backend/app/repositories/user/deps.py` defining `get_user_repository(session: SessionDep) -> UserRepository` and `UserRepoDep`

## 7. AuthService + errors + deps

- [x] 7.1 Create `apps/backend/app/services/auth/errors.py` with `InvalidCredentialsError`, `UnauthenticatedError`, `ForbiddenRoleError` (subclasses of `AppError`, with codes per design)
- [x] 7.2 Create `apps/backend/app/services/auth/auth_service.py` with `class AuthService` (constructor: `Authenticator`, `UserRepository`, `Settings`). Methods: `login(email, password) -> SessionUser` (raises `InvalidCredentialsError`), `mint_session_token(user_id) -> str` (uses `itsdangerous.URLSafeTimedSerializer`), `verify_session_token(token) -> UUID` (returns user_id, raises `UnauthenticatedError` on bad/expired token; max age 8h), `load_session_user(user_id) -> SessionUser` (DB load + inactive check)
- [x] 7.3 Create `apps/backend/app/services/auth/deps.py`:
   - factory `get_auth_service(...)` and `AuthServiceDep`
   - `async def get_current_user(...)` reads cookie via `Request`, calls `verify_session_token` + `load_session_user`, returns `SessionUser`
   - `CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]`
   - `async def get_optional_current_user(...)` mirrors `get_current_user` but returns `None` (no raise) on missing / expired / tampered cookie and on deactivated user. Wired into `app/db/engine.get_session` (introduced in `backend-tenant-base`) so authenticated traffic auto-populates `session.info[SESSION_ACTOR_KEY]`
   - `OptionalCurrentUserDep = Annotated[SessionUser | None, Depends(get_optional_current_user)]`
   - `def require_role(role: Role) -> Callable[..., SessionUser]` factory returning a Depends-compatible callable that raises `ForbiddenRoleError` if mismatched
- [x] 7.4 Update `apps/backend/app/services/auth/__init__.py` to re-export `AuthService`, `AuthServiceDep`, `CurrentUserDep`, `OptionalCurrentUserDep`, `require_role`
- [x] 7.5 Update `apps/backend/app/db/engine.get_session` (slot reserved in `backend-tenant-base`) to actually consume `OptionalCurrentUserDep` and write `session.info[SESSION_ACTOR_KEY] = current_user` when not `None`. Confirm the unauthenticated path (no cookie) yields a session with the slot unset, so the audit hook stays a no-op for login / health endpoints

## 8. UserService + errors + deps

- [x] 8.1 Create `apps/backend/app/services/user/errors.py` with `UserNotFoundError`, `CrossTenantAccessError`
- [x] 8.2 Create `apps/backend/app/services/user/user_service.py` with `class UserService(repo: UserRepository)`. Methods: `list_in_tenant(tenant_id, *, active=None)`, `assign_role(actor: SessionUser, target_user_id: UUID, role: Role)` enforcing the cross-tenant / not-found rules. Self-targets MUST be permitted — no `SelfRoleChangeError`
- [x] 8.3 Create `apps/backend/app/services/user/deps.py` with `get_user_service` factory and `UserServiceDep`
- [x] 8.4 Update `apps/backend/app/services/user/__init__.py` re-exports

## 9. Schemas

- [x] 9.1 Create `apps/backend/app/schemas/auth/auth.py` with `LoginRequest { email: EmailStr, password: SecretStr }` and `SessionUser { id: UUID, email: EmailStr, display_name: str, tenant_id: UUID, role: Role }`. Import `Role` from `app.core.enums.user`
- [x] 9.2 Update `apps/backend/app/schemas/auth/__init__.py` re-exports
- [x] 9.3 Create `apps/backend/app/schemas/user/user.py` with `UserRow { id, email, display_name, role, is_active, created_at }` and `AssignRoleRequest { role: Role }`
- [x] 9.4 Update `apps/backend/app/schemas/user/__init__.py` re-exports

## 10. Routers

- [x] 10.1 Create `apps/backend/app/api/routers/auth/auth_router.py` exposing `router = APIRouter(tags=["auth"])` with `POST /auth/login` (operation_id `login_user`), `GET /auth/me` (`get_current_user`), `POST /auth/logout` (`logout_user`). Login uses `AuthServiceDep`; me uses `CurrentUserDep`; logout clears the cookie. Cookie set with `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` iff `Settings.env == "production"`
- [x] 10.2 Create `apps/backend/app/api/routers/user/user_router.py` exposing `router = APIRouter(tags=["users"])` with `GET /users` (operation_id `list_tenant_users`, query param `active: bool | None = None`, guarded by `Depends(require_role(Role.ADMIN))`) and `PATCH /users/{user_id}/role` (operation_id `update_user_role`, body `AssignRoleRequest`, same guard, returns updated `UserRow`)
- [x] 10.3 Register both routers in `apps/backend/app/main.py` (or wherever the app factory composes routers)
- [ ] 10.4 In the FastAPI lifespan startup, add a guard: if `settings.env == "production"` and `settings.session_secret_key == "change-me-in-production"`, raise `RuntimeError("session_secret_key must be overridden in production")` before yielding. Non-production envs skip the check

## 11. Alembic revision (schema only)

- [x] 11.1 Generate revision: `moon run backend:make-migration "create users table"`
- [x] 11.2 Set `down_revision = "<backend-tenant-base revision hash>"`; verify the chain is `None → tenants → users`
- [x] 11.3 In `upgrade()`, create the `role` Postgres enum and the `users` table per spec — column list MUST include the inherited `Entity` / `AuditableEntity` / `TenantOwnedEntity` columns (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `tenant_id`) plus the user-specific columns. Include the self-referential FKs for `created_by` / `updated_by` / `deleted_by` → `users.id` (`ON DELETE RESTRICT`), the `tenant_id` FK → `tenants.id` (`ON DELETE RESTRICT`), the functional unique index `(tenant_id, lower(email))`, and the `(tenant_id, role)` index. The self-FK definitions MUST use `use_alter=True` on at least one side so alembic can create the table before resolving the cycle
- [x] 11.4 In `downgrade()`, drop the `users` table then drop the `role` enum type (`alembic-postgresql-enum` handles the `DROP TYPE` op)
- [x] 11.5 Verify the revision contains **no** `op.bulk_insert` / `op.execute("INSERT ...")` — DDL only. No `# POC ONLY` banner needed (alembic touches no user data)

## 12. `seed_users` script

- [x] 12.1 Create `apps/backend/scripts/seed_users.py` with a `# POC ONLY — bootstrap seed; replace before non-PoC deployment` banner at the top of the file and a module-level `ADMIN_USER_ID: UUID = UUID("<stable literal>")` constant for downstream scripts and tests to import
- [x] 12.2 Add `async def seed_users(session: AsyncSession) -> list[User]` in `scripts/seed_users.py` that:
   1. Looks up the `zas` tenant via `TenantRepository.get_by_slug("zas")`; if missing, log `ERROR cannot seed users: zas tenant missing — run seed_tenant first` and raise (script `main()` translates to non-zero exit)
   2. **Admin first (self-referential bootstrap)**: look up `(zas_tenant_id, "admin@zas.local")` via `UserRepository.get_by_email`; if missing, construct the `User` ORM instance with `id = ADMIN_USER_ID`, `tenant_id = zas_tenant_id`, AND `created_by = updated_by = ADMIN_USER_ID` explicitly set (the audit hook skips fields that are already non-`None`, so the self-FK survives the flush). `session.info[SESSION_ACTOR_KEY]` MUST be unset for this insert — the hook would otherwise overwrite the self-reference
   3. **Build the admin `SessionUser` in process** from the inserted (or pre-existing) admin row: `admin_actor = SessionUser(id=admin.id, email=..., display_name=..., tenant_id=zas_tenant_id, role=Role.ADMIN)`
   4. **Caregiver next (audit-hook driven)**: set `session.info[SESSION_ACTOR_KEY] = admin_actor`; look up `(zas_tenant_id, "caregiver@zas.local")`; if missing, construct the `User` instance WITHOUT setting `tenant_id` / `created_by` / `updated_by` — the audit hook MUST fill them from `admin_actor`. Flush
   5. Derive each `password_hash` via `PasswordHasher().hash(os.getenv(<var>, "changeme"))`; log a `WARNING` line `"bootstrap password env var <name> unset, using 'changeme' fallback"` when the env var is missing
   6. Log `INFO seeded user email=<email> role=<role>` on insert, `INFO user email=<email> already present` on no-op
- [x] 12.3 Add a sync `main()` entrypoint in `scripts/seed_users.py` matching the `scripts/seed_tenant.py` pattern: define `async def _seed(session: AsyncSession) -> None` that calls `seed_users(session)`, then `def main() -> None: run_script(_seed)`; guarded by `if __name__ == "__main__": main()`. `run_script` is called WITHOUT an `actor` arg — `seed_users` manages the actor handoff internally because the admin row is created mid-script
- [x] 12.4 Append `seed_users` to `scripts.seed_all.SEED_STEPS` after `seed_zas_tenant`. `SEED_STEPS` runs under a single `script_session()` — if `seed_zas_tenant` raises, the loop short-circuits and `seed_users` MUST NOT run

## 13. Moon + entrypoint wiring

- [x] 13.1 Add `seed-users` task to `apps/backend/moon.yml` running `python -m scripts.seed_users` inside `zas_backend`
- [x] 13.2 No edit to `apps/backend/docker/entrypoint.sh` — it already chains `python -m scripts.seed_all` (set up in `backend-tenant-base`), and `seed_all` now picks up `seed_users` automatically
- [x] 13.3 Confirm `zas_backend_test` entrypoint (or compose override) still runs migrate only — NO `scripts.seed_all` invocation
- [ ] 13.4 Update `apps/backend/README.md` per-task table to list the new `seed-users` moon task and the `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` / `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` env vars

## 14. Tests

- [x] 14.1 `tests/repositories/user/test_user_repository.py` — case-insensitive `get_by_email`, tenant-scoped `list_in_tenant`, active filter, unique-violation on duplicate `lower(email)` per tenant, same email across tenants succeeds
- [x] 14.2 `tests/services/auth/test_password_hasher.py` — round-trip hash + verify, verify rejects wrong password
- [x] 14.3 `tests/services/auth/test_authenticator.py` — `PasswordAuthenticator` happy path, wrong password returns `None`, inactive user returns `None`, unknown email returns `None`
- [x] 14.4 `tests/services/auth/test_auth_service.py` — `login` happy path returns `SessionUser` w/ tenant_id+role, `login` invalid credentials raises, `mint`/`verify` round-trip, expired token raises, deactivated-user re-load raises
- [x] 14.5 `tests/services/user/test_user_service.py` — `assign_role` happy path, cross-tenant raises, missing target raises, self-target succeeds and persists the new role; verify that the updated row's `updated_by` equals the actor's `id` (audit hook auto-fill exercised via the `session_actor` fixture)
- [x] 14.6 `tests/api/routers/auth/test_auth_router.py` — full login/me/logout flow against seeded admin, invalid creds → 401, /auth/me without cookie → 401, expired cookie → 401, deactivated user via /auth/me → 401, cookie security flags present
- [x] 14.7 `tests/api/routers/user/test_user_router.py` — caregiver cannot list (403), admin lists seeded users, admin updates caregiver role (200), cross-tenant target → 403, self target → 200 (and the same client's next admin-only request → 403 because role re-loaded as `caregiver`)
- [x] 14.8 `tests/scripts/test_seed_users.py` — against a DB seeded with the `zas` tenant: calling `seed_users(session)` inserts both rows with correct email/role/tenant_id; admin's `created_by == updated_by == admin.id` (self-reference verified); caregiver's `created_by == updated_by == admin.id` AND `tenant_id == zas_tenant_id` (audit hook auto-fill verified); second invocation no-ops; missing tenant raises with the documented `ERROR` log line; `BACKEND_BOOTSTRAP_ADMIN_PASSWORD=s3cret` env var produces a hash that argon2-verifies against `"s3cret"`; unset env var falls back to `"changeme"` and emits the `WARNING` log line. Add a subprocess test that `python -m scripts.seed_users` exits 0 when the `zas` tenant is present and non-zero when it is missing
- [x] 14.9 Extend the `seeded_zas_tenant` fixture story (from `backend-tenant-base`) with a `seeded_zas_users` fixture in `tests/conftest.py` that calls `seed_users(db_session)` and yields the two seeded `User` rows — downstream domain tests reuse it

## 15. Quality gates

- [x] 15.1 `moon run backend:lint` clean
- [x] 15.2 `moon run backend:format` clean
- [x] 15.3 `moon run backend:typecheck` clean
- [ ] 15.4 `moon run backend:test -- tests/services/auth tests/services/user tests/repositories/user tests/api/routers/auth tests/api/routers/user tests/scripts` green
- [ ] 15.5 `moon run backend:test` full suite green
- [x] 15.6 Spin up `moon run backend:dev`; confirm entrypoint logs show `alembic upgrade head` → `seeded tenant slug=zas` → `seeded user email=admin@zas.local` → `seeded user email=caregiver@zas.local`. Re-run `moon run backend:seed-users`, confirm no-op logs. Hit `POST /auth/login` with seeded admin via curl or /docs, verify cookie set + `SessionUser` shape; hit `GET /users` with the cookie, verify list contains both seeded users; hit `PATCH /users/<caregiver_id>/role` with `{"role":"external"}`, verify update; logout, verify subsequent `GET /auth/me` returns 401
- [x] 15.7 `moon run backend:openapi` regenerates `openapi.json`; commit the regenerated file alongside the change

## 16. OpenAPI client regen (orchestrator)

- [ ] 16.1 Run the orchestrator's typegen step to consume the regenerated `openapi.json` (deferred: only land if it is fast and non-breaking; otherwise queue under a follow-up frontend change)
