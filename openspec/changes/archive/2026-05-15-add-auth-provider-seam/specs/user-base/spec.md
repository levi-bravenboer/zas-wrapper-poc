## MODIFIED Requirements

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

## ADDED Requirements

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
