# user-base Specification

## Purpose
TBD - created by archiving change backend-user-auth-base. Update Purpose after archive.
## Requirements
### Requirement: Users table persists tenant-scoped identities

The backend SHALL persist a `users` table where each row represents an authenticatable identity belonging to exactly one tenant. `User` SHALL inherit `TenantOwnedEntity` (introduced in `backend-tenant-base`), so each row carries the inherited columns (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `tenant_id`) plus user-specific columns (`email`, `password_hash`, `display_name`, `role`, `is_active`, `external_idp`, `external_subject`). `password_hash` MUST be nullable so OIDC-only identities can persist without a credential; `external_idp` (varchar 64) and `external_subject` (varchar 255) MUST both be nullable so password-only identities (PoC) can persist without an IdP subject. A CHECK constraint `(password_hash IS NOT NULL) OR (external_subject IS NOT NULL)` MUST guarantee every row has at least one authentication path. A partial unique index on `(tenant_id, external_idp, external_subject) WHERE external_subject IS NOT NULL` MUST guarantee one external identity per (tenant, IdP) pair. `created_by` / `updated_by` (NOT NULL) and `deleted_by` (nullable) all reference `users.id` with `ON DELETE RESTRICT` — the FK is self-referential, and the bootstrap admin row breaks the cycle by self-referencing (`id = created_by = updated_by = ADMIN_USER_ID`).

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `backend-tenant-base` and this change)
- **THEN** a `users` table exists with columns `id` (UUID, primary key, not null), `tenant_id` (UUID, not null, references `tenants.id`, on delete RESTRICT), `created_by` (UUID, not null, references `users.id`, on delete RESTRICT), `updated_by` (UUID, not null, references `users.id`, on delete RESTRICT), `deleted_by` (UUID, nullable, references `users.id`, on delete RESTRICT), `email` (varchar 255, not null), `password_hash` (varchar 255, **nullable**), `display_name` (varchar 255, not null), `role` (enum `role`, not null), `is_active` (boolean, not null, default `true`), `external_idp` (varchar 64, nullable), `external_subject` (varchar 255, nullable), `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`), `deleted_at` (timestamptz, nullable). The table MUST carry a CHECK constraint enforcing `(password_hash IS NOT NULL) OR (external_subject IS NOT NULL)`.

#### Scenario: Bootstrap admin self-references audit columns

- **WHEN** the bootstrap admin row is inserted by `scripts/seed_users.py`
- **THEN** the row's `id`, `created_by`, and `updated_by` MUST all equal `ADMIN_USER_ID`, and the insert MUST succeed despite the self-FK cycle

#### Scenario: Caregiver audit fields auto-filled by hook

- **WHEN** `seed_users` inserts the demo caregiver after the admin exists and `session.info[SESSION_ACTOR_KEY]` is set to the admin's `SessionUser`
- **THEN** the caregiver row's `tenant_id`, `created_by`, and `updated_by` MUST be stamped by the audit hook to the admin's `tenant_id` / `id` — the caregiver insert MUST NOT set those fields explicitly

#### Scenario: Email is case-insensitive unique per tenant

- **WHEN** an insert attempts to create a second row in the same tenant whose `lower(email)` matches an existing row's `lower(email)`
- **THEN** the database MUST reject the insert with a unique-violation error

#### Scenario: Same email reusable across tenants

- **WHEN** two rows have identical `email` values but different `tenant_id` values
- **THEN** both inserts MUST succeed

#### Scenario: External subject unique per tenant and IdP

- **WHEN** an insert attempts to create a second row in the same tenant whose `(external_idp, external_subject)` matches an existing non-null pair
- **THEN** the database MUST reject the insert with a unique-violation error

#### Scenario: External subject null does not collide

- **WHEN** two rows in the same tenant both have `external_idp IS NULL` and `external_subject IS NULL` (the PoC default)
- **THEN** both inserts MUST succeed (the partial unique index excludes null subjects)

#### Scenario: Row with no credential rejected

- **WHEN** an insert attempts to create a row with `password_hash IS NULL` and `external_subject IS NULL`
- **THEN** the database MUST reject the insert with a CHECK-constraint violation

#### Scenario: External-only row accepted

- **WHEN** an insert sets `password_hash = NULL`, `external_idp = 'itsme'`, `external_subject = '<sub>'`
- **THEN** the insert MUST succeed (the CHECK is satisfied by the non-null `external_subject`)

#### Scenario: Password-only row accepted (PoC default)

- **WHEN** an insert sets `password_hash = '<argon2>'`, `external_idp = NULL`, `external_subject = NULL`
- **THEN** the insert MUST succeed (the CHECK is satisfied by the non-null `password_hash`)

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

### Requirement: Bootstrap users seeded via script

The backend SHALL provide a `scripts/seed_users.py` module that inserts two rows under the `zas` tenant: a bootstrap admin (`email = "admin@zas.local"`, `role = admin`, `display_name = "ZAS Admin"`) and a demo caregiver (`email = "caregiver@zas.local"`, `role = caregiver`, `display_name = "Demo Caregiver"`). Each row's `password_hash` MUST be derived via argon2 from the corresponding env var (`BACKEND_BOOTSTRAP_ADMIN_PASSWORD`, `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD`), falling back to `"changeme"` if unset. The script module (`scripts/seed_users.py`) MUST carry a `# POC ONLY` banner explaining the fallback. Alembic revisions in this change SHALL NOT insert any rows.

The script MUST be idempotent: it looks each user up via `UserRepository.get_by_email(zas_tenant_id, email)` and inserts only if missing. Existing rows are not updated by this command.

#### Scenario: Seed inserts when missing

- **WHEN** `python -m scripts.seed_users` runs against a database that has the `zas` tenant but no users
- **THEN** the command exits 0 and `users` contains exactly two rows under the `zas` tenant matching the bootstrap admin + demo caregiver specs above

#### Scenario: Seed is idempotent

- **WHEN** `python -m scripts.seed_users` runs a second time against a database that already contains both seeded rows
- **THEN** the command exits 0 and `users` still contains exactly the same two rows — no duplicates, no password updates

#### Scenario: Seed depends on tenant being present

- **WHEN** `python -m scripts.seed_users` runs against a database where the `zas` tenant row is missing
- **THEN** the command exits non-zero and logs `ERROR cannot seed users: zas tenant missing — run seed_tenant first`

#### Scenario: Seed password matches env var when set

- **WHEN** `BACKEND_BOOTSTRAP_ADMIN_PASSWORD = "s3cret"` is exported and `scripts.seed_users` runs against a fresh DB
- **THEN** `PasswordHasher.verify(<admin password_hash>, "s3cret")` MUST return `True`

#### Scenario: Seed password falls back to literal when env unset

- **WHEN** `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` is unset and `scripts.seed_users` runs against a fresh DB
- **THEN** `PasswordHasher.verify(<admin password_hash>, "changeme")` MUST return `True` and a `WARNING` log line MUST record that the fallback was used

#### Scenario: `seed_all` chains tenant then users

- **WHEN** `python -m scripts.seed_all` runs after this change is applied
- **THEN** `seed_zas_tenant` MUST run first, then `seed_users`; if `seed_zas_tenant` fails, `seed_users` MUST NOT run

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

### Requirement: User repository supports external-identity lookup

The `UserRepository` SHALL expose `async def get_by_external_identity(tenant_id: UUID, external_idp: str, external_subject: str) -> User | None` returning the row matching the `(tenant_id, external_idp, external_subject)` tuple, or `None`. This method is the lookup the future `oidc-login-providers` change will consume; PoC does not call it from any provider, but the method MUST be implemented and tested now so the seam is real, not aspirational.

#### Scenario: Lookup by external identity returns row

- **WHEN** a test inserts a user with `external_idp='itsme'`, `external_subject='abc123'` and calls `get_by_external_identity(tenant_id, 'itsme', 'abc123')`
- **THEN** the call MUST return that user row

#### Scenario: Lookup returns None when missing

- **WHEN** `get_by_external_identity(tenant_id, 'itsme', 'does-not-exist')` is awaited
- **THEN** the call MUST return `None`

#### Scenario: Lookup is tenant-scoped

- **WHEN** two tenants each have a user with the same `(external_idp, external_subject)` and the call is made with one tenant's id
- **THEN** the result MUST be only that tenant's row

