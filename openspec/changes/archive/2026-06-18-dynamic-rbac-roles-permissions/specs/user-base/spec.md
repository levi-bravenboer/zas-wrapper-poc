## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Role enum is a single canonical value

**Reason**: The fixed `Role` Postgres enum (`admin`, `caregiver`) is removed and replaced by the dynamic, tenant-scoped `roles` table defined in `rbac-roles`. A user's role is now `users.role_id` (FK), and app-function authorization derives from the role's assigned permission catalog rather than an enum literal. Only two seeded `is_system` roles exist (`admin`, `default`); patient / caregiver / external are derived from data (`patient_id` / Practitioner row / org-tree), not roles.

**Migration**: the migration backfills `role_id` from the prior enum value (`admin`→`admin` role; every other user→`default`) before dropping the `role` column and the `role` enum type.
