## ADDED Requirements

### Requirement: Users table persists tenant-scoped identities

The backend SHALL persist a `users` table where each row represents an authenticatable identity belonging to exactly one tenant. Every row MUST carry a UUID primary key, a non-null `tenant_id` foreign key referencing `tenants.id`, an `email`, an argon2 `password_hash`, a `display_name`, a `role` of type `role` (Postgres-native enum), an `is_active` flag, and `created_at` / `updated_at` timestamps.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `backend-tenant-base`)
- **THEN** a `users` table exists with columns `id` (UUID, primary key, not null), `tenant_id` (UUID, not null, references `tenants.id`, on delete RESTRICT), `email` (varchar 255, not null), `password_hash` (varchar 255, not null), `display_name` (varchar 255, not null), `role` (enum `role`, not null), `is_active` (boolean, not null, default `true`), `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`)

#### Scenario: Email is case-insensitive unique per tenant

- **WHEN** an insert attempts to create a second row in the same tenant whose `lower(email)` matches an existing row's `lower(email)`
- **THEN** the database MUST reject the insert with a unique-violation error

#### Scenario: Same email reusable across tenants

- **WHEN** two rows have identical `email` values but different `tenant_id` values
- **THEN** both inserts MUST succeed

### Requirement: Role enum is a single canonical value

The backend SHALL define exactly one Python `Role` enum at `app/core/enums/user.py` with values `admin`, `caregiver`, `external` (string-valued via `StrEnum`), re-exported from `app/core/enums/__init__.py`. This enum MUST be the source of truth for the `role` column type (`sa.Enum(Role, name="role", native_enum=True, create_constraint=True)`) and for every Pydantic `role` field in `app/schemas/`.

#### Scenario: ORM model imports Role from core

- **WHEN** the `User` ORM model declares its `role` column
- **THEN** it MUST import `Role` from `app.core.enums.user` and pass it to `sa.Enum(...)`

#### Scenario: Pydantic schemas import Role from core

- **WHEN** a Pydantic schema (e.g. `SessionUser`, `AssignRoleRequest`) types a `role` field
- **THEN** it MUST import `Role` from `app.core.enums.user`

#### Scenario: Postgres enum type created by migration

- **WHEN** the migration runs against a fresh database
- **THEN** a Postgres `enum` type named `role` MUST exist with exactly the values `'admin'`, `'caregiver'`, `'external'`

### Requirement: Bootstrap users seeded via CLI

The backend SHALL provide a Typer subcommand `seed-users` under `app/cli/` that inserts two rows under the `zas` tenant: a bootstrap admin (`email = "admin@zas.local"`, `role = admin`, `display_name = "ZAS Admin"`) and a demo caregiver (`email = "caregiver@zas.local"`, `role = caregiver`, `display_name = "Demo Caregiver"`). Each row's `password_hash` MUST be derived via argon2 from the corresponding env var (`BACKEND_BOOTSTRAP_ADMIN_PASSWORD`, `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD`), falling back to `"changeme"` if unset. The CLI module (`app/cli/seed.py`) MUST carry a `# POC ONLY` banner explaining the fallback. Alembic revisions in this change SHALL NOT insert any rows.

The subcommand MUST be idempotent: it looks each user up via `UserRepository.get_by_email(zas_tenant_id, email)` and inserts only if missing. Existing rows are not updated by this command.

#### Scenario: Seed inserts when missing

- **WHEN** `python -m app.cli seed-users` runs against a database that has the `zas` tenant but no users
- **THEN** the command exits 0 and `users` contains exactly two rows under the `zas` tenant matching the bootstrap admin + demo caregiver specs above

#### Scenario: Seed is idempotent

- **WHEN** `python -m app.cli seed-users` runs a second time against a database that already contains both seeded rows
- **THEN** the command exits 0 and `users` still contains exactly the same two rows — no duplicates, no password updates

#### Scenario: Seed depends on tenant being present

- **WHEN** `python -m app.cli seed-users` runs against a database where the `zas` tenant row is missing
- **THEN** the command exits non-zero and logs `ERROR cannot seed users: zas tenant missing — run seed-tenant first`

#### Scenario: Seed password matches env var when set

- **WHEN** `BACKEND_BOOTSTRAP_ADMIN_PASSWORD = "s3cret"` is exported and `seed-users` runs against a fresh DB
- **THEN** `PasswordHasher.verify(<admin password_hash>, "s3cret")` MUST return `True`

#### Scenario: Seed password falls back to literal when env unset

- **WHEN** `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` is unset and `seed-users` runs against a fresh DB
- **THEN** `PasswordHasher.verify(<admin password_hash>, "changeme")` MUST return `True` and a `WARNING` log line MUST record that the fallback was used

#### Scenario: `seed-all` chains tenant then users

- **WHEN** `python -m app.cli seed-all` runs after this change is applied
- **THEN** `seed-tenant` MUST run first, then `seed-users`; if `seed-tenant` fails, `seed-users` MUST NOT run

#### Scenario: Dev entrypoint produces a logged-in-ready DB

- **WHEN** the `zas_backend` dev container starts
- **THEN** after the entrypoint completes, the seeded admin MUST be able to authenticate via `POST /auth/login` with the bootstrap password (env var or `"changeme"` fallback)

### Requirement: User repository provides tenant-scoped access

The backend SHALL expose a `UserRepository` under `app/repositories/user/` that extends `BaseRepository[User]` and provides at minimum:

- `async def get_by_id(user_id: UUID) -> User | None`
- `async def get_by_email(tenant_id: UUID, email: str) -> User | None` — MUST compare via `lower(email)` so lookup is case-insensitive
- `async def list_in_tenant(tenant_id: UUID, *, active: bool | None = None) -> list[User]`
- `async def update(user: User) -> User`

#### Scenario: Lookup by email is case-insensitive

- **WHEN** `UserRepository.get_by_email(tenant_id, "ADMIN@zas.local")` is awaited against a freshly seeded database
- **THEN** the result MUST be the seeded admin row

#### Scenario: Listing scoped by tenant

- **WHEN** `UserRepository.list_in_tenant(zas_tenant_id)` is awaited
- **THEN** the result MUST contain only rows whose `tenant_id` equals `zas_tenant_id`

#### Scenario: Listing filterable by active flag

- **WHEN** `UserRepository.list_in_tenant(zas_tenant_id, active=True)` is awaited and the database contains both active and inactive rows
- **THEN** the result MUST contain only rows where `is_active = True`

### Requirement: User service exposes admin-only operations

The backend SHALL expose a `UserService` under `app/services/user/` whose constructor takes a `UserRepository` and which provides at minimum:

- `async def list_in_tenant(tenant_id: UUID, *, active: bool | None = None) -> list[User]`
- `async def assign_role(actor: SessionUser, target_user_id: UUID, role: Role) -> User`

`assign_role` MUST raise `CrossTenantAccessError` (`forbidden.user.cross_tenant`, 403) when the target user's `tenant_id` differs from `actor.tenant_id`, and `UserNotFoundError` (`not-found.user.not_found`, 404) when no row matches `target_user_id`. Self-targets (`target_user_id == actor.id`) are NOT blocked at this layer — callers may demote themselves, including the last active admin. Lockout is accepted as a PoC trade-off; recovery is a DB-side `UPDATE`.

#### Scenario: Successful role assignment

- **WHEN** an admin actor calls `assign_role` with a target user in the same tenant and a new role
- **THEN** the target user's `role` column MUST be updated to the new value and the updated `User` row returned

#### Scenario: Cross-tenant role assignment rejected

- **WHEN** an admin calls `assign_role` with a target user whose `tenant_id` differs from the admin's
- **THEN** `CrossTenantAccessError` MUST be raised and no row MUST be modified

#### Scenario: Self role change permitted

- **WHEN** an admin calls `assign_role` with `target_user_id` equal to their own `id` and a new role
- **THEN** the call MUST succeed and the actor's own `role` column MUST be updated — no error is raised even when the actor is the last active admin in the tenant

#### Scenario: Missing target rejected

- **WHEN** an admin calls `assign_role` with a `target_user_id` that does not exist
- **THEN** `UserNotFoundError` MUST be raised

### Requirement: Admin user router exposes list and role-update endpoints

The backend SHALL expose a router under `app/api/routers/user/` tagged `users` providing:

- `GET /users` — operation id `list_tenant_users`. Returns `list[UserRow]` (id, email, display_name, role, is_active, created_at). Tenant-scoped to `current_user.tenant_id`. Admin-only. Accepts optional `?active=true|false` query.
- `PATCH /users/{user_id}/role` — operation id `update_user_role`. Body: `AssignRoleRequest { role: Role }`. Returns the updated `UserRow`. Admin-only. Cross-tenant targets return 403. Self-targets are permitted and return 200 with the updated row.

Both endpoints MUST be guarded with `Depends(require_role(Role.ADMIN))`.

#### Scenario: Caregiver cannot list users

- **WHEN** an authenticated caregiver requests `GET /users`
- **THEN** the response is 403 with `ErrorResponse{ code: "forbidden.auth.role" }`

#### Scenario: Admin can list users in own tenant

- **WHEN** an authenticated admin requests `GET /users` against a freshly seeded database
- **THEN** the response is 200 with a body containing both seeded users (admin + caregiver) and no users from any other tenant

#### Scenario: Admin updates caregiver role

- **WHEN** an admin sends `PATCH /users/<caregiver_id>/role` with body `{"role": "external"}`
- **THEN** the response is 200 with the updated `UserRow` showing `role = "external"`

#### Scenario: Admin attempts cross-tenant role update

- **WHEN** an admin sends `PATCH /users/<other_tenant_user_id>/role` with body `{"role": "caregiver"}`
- **THEN** the response is 403 with `ErrorResponse{ code: "forbidden.user.cross_tenant" }`

#### Scenario: Admin self role update permitted

- **WHEN** an admin sends `PATCH /users/<own_id>/role` with body `{"role": "caregiver"}`
- **THEN** the response is 200 with the updated `UserRow` showing `role = "caregiver"`. Subsequent admin-only requests by that session MUST return 403 (the role guard reads the freshly-loaded `SessionUser.role`)
