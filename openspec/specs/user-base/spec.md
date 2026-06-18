# user-base Specification

## Purpose
TBD - created by archiving change backend-user-auth-base. Update Purpose after archive.
## Requirements
### Requirement: Users table persists tenant-scoped identities

The backend SHALL persist a `users` table where each row represents an authenticatable identity belonging to exactly one tenant. `User` SHALL inherit `TenantOwnedEntity`, so each row carries the inherited columns (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `tenant_id`) plus user-specific columns (`email`, `password_hash`, `display_name`, `role_id`, `is_active`, `external_idp`, `external_subject`). The `role` enum column is REPLACED by `role_id` — a NOT NULL foreign key to `roles.id` (`rbac-roles`) — so a user's role is a row in the tenant-scoped `roles` table, not an enum value; the one-row-per-role model is preserved. `password_hash` MUST be nullable so OIDC-only identities can persist without a credential; `external_idp` (varchar 64) and `external_subject` (varchar 255) MUST both be nullable so password-only identities (PoC) can persist without an IdP subject. A CHECK constraint `(password_hash IS NOT NULL) OR (external_subject IS NOT NULL)` MUST guarantee every row has at least one authentication path. A partial unique index on `(tenant_id, external_idp, external_subject) WHERE external_subject IS NOT NULL` MUST guarantee one external identity per (tenant, IdP) pair. `created_by` / `updated_by` (NOT NULL) and `deleted_by` (nullable) all reference `users.id` with `ON DELETE RESTRICT`; the bootstrap admin row breaks the self-FK cycle by self-referencing.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** a `users` table exists with `role_id` (UUID, not null, references `roles.id`, on delete RESTRICT) in place of the former `role` enum column, alongside the other identity, audit, and credential columns and the `(password_hash IS NOT NULL) OR (external_subject IS NOT NULL)` CHECK constraint

#### Scenario: Bootstrap admin bound to the admin role

- **WHEN** the bootstrap admin row is inserted
- **THEN** its `role_id` references the seeded `admin` role for its tenant

#### Scenario: Uniqueness admits staff rows plus a patient row

- **WHEN** a human maps to multiple user rows (staff rows plus an optional patient row)
- **THEN** uniqueness is enforced by partial indexes — `UNIQUE (tenant_id, email, role_id) WHERE patient_id IS NULL` (one staff row per role) and `UNIQUE (tenant_id, email) WHERE patient_id IS NOT NULL` (one patient row) — so a patient row and staff rows can share an email (`multi-role-login`)

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

- `GET /users` — operation id `list_tenant_users`. Returns `list[UserRow]` (id, email, display_name, role, is_active, created_at). Tenant-scoped to `current_user.tenant_id`. Admin-only. Accepts optional `?active=true|false`, `?role=<Role>`, `?q=<text>`, and `?has_practitioner=true|false` query filters.
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
- **THEN** the response is 200 with the updated `UserRow` showing `role = "caregiver"`

#### Scenario: has_practitioner filter scopes the list

- **WHEN** an admin calls `GET /users?has_practitioner=true`
- **THEN** the response MUST include only users whose `Practitioner` row exists (joined on `practitioners.user_id`), excluding any admin or caregiver with no Practitioner materialised

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

### Requirement: Users are projections of Kratos identities
Every active `users` row SHALL carry `external_idp = 'kratos'` and `external_subject = <Kratos identity id>` after the identity import. New users created through admin flows SHALL be created in Kratos first (or atomically alongside) so the projection columns are never null for an active login-capable user. The `password_hash` column SHALL no longer be consulted by any login path; it is retained for rollback until a later cleanup change removes it.

#### Scenario: Active user has a Kratos mapping
- **WHEN** any active user row is inspected after the import
- **THEN** `external_idp = 'kratos'` and `external_subject` holds a valid Kratos identity id

#### Scenario: Login never reads password_hash
- **WHEN** a user logs in via `/auth/login/password`
- **THEN** the local `password_hash` value is not read on that code path

### Requirement: User lifecycle propagates to Kratos
Deactivating a user SHALL revoke all their Kratos sessions; reactivating SHALL NOT restore old sessions. Hard-deleting (not in PoC surface) or soft-deleting a user SHALL disable the corresponding Kratos identity so it cannot start new login flows.

#### Scenario: Deactivation disables login
- **WHEN** an admin sets `is_active = False` on a user
- **THEN** the user's existing sessions stop working and a fresh login attempt with valid credentials fails

