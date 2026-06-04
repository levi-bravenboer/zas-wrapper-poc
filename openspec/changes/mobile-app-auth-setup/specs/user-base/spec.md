## ADDED Requirements

### Requirement: Role enum carries the `patient` value

The `role` Postgres enum SHALL include the value `patient` alongside the existing caregiver-oriented values. The enum value SHALL be added by the alembic migration shipping this change. New `users` rows MAY be inserted with `role = 'patient'`; existing rows are unaffected.

#### Scenario: Migration adds the patient enum value

- **WHEN** the database is migrated to head
- **THEN** `SELECT 'patient'::role` returns `'patient'` without error

### Requirement: `users.patient_id` links a user to a FHIR Patient row

The `users` table SHALL carry a `patient_id` column of type `UUID`, nullable, with a foreign key to `patients(id) ON DELETE RESTRICT`. A UNIQUE partial index `users_patient_id_unique ON users(patient_id) WHERE patient_id IS NOT NULL` SHALL enforce that each `patients` row is referenced by at most one `users` row. A CHECK constraint `users_role_patient_link` SHALL enforce `(role = 'patient' AND patient_id IS NOT NULL) OR (role <> 'patient' AND patient_id IS NULL)`.

#### Scenario: Schema carries column, partial unique index, and CHECK

- **WHEN** the database is migrated to head
- **THEN** `users.patient_id` exists as `UUID NULL` with `REFERENCES patients(id) ON DELETE RESTRICT`
- **AND** the partial unique index `users_patient_id_unique` exists
- **AND** the CHECK constraint `users_role_patient_link` exists

#### Scenario: Inserting two patient users for one patient is rejected

- **WHEN** a second `users` row is inserted with the same `patient_id` as an existing row
- **THEN** the database rejects the insert with a unique-violation error citing `users_patient_id_unique`

#### Scenario: Inserting a patient user without patient_id is rejected

- **WHEN** an insert sets `role = 'patient'` and `patient_id = NULL`
- **THEN** the database rejects the insert with a CHECK-violation error citing `users_role_patient_link`

#### Scenario: Inserting a caregiver with patient_id is rejected

- **WHEN** an insert sets `role <> 'patient'` and `patient_id` to a non-NULL UUID
- **THEN** the database rejects the insert with a CHECK-violation error citing `users_role_patient_link`

#### Scenario: Deleting a referenced patient row is restricted

- **WHEN** an attempt is made to `DELETE FROM patients WHERE id = <p>` while a `users` row has `patient_id = <p>`
- **THEN** the database rejects the delete with a foreign-key-violation error citing the ON DELETE RESTRICT clause

## MODIFIED Requirements

### Requirement: Users table persists tenant-scoped identities

The backend SHALL persist a `users` table where each row represents an authenticatable identity belonging to exactly one tenant. `User` SHALL inherit `TenantOwnedEntity` (introduced in `backend-tenant-base`), so each row carries the inherited columns (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `tenant_id`) plus user-specific columns (`email`, `password_hash`, `display_name`, `role`, `is_active`, `external_idp`, `external_subject`, **`patient_id`**). `password_hash` MUST be nullable so OIDC-only identities can persist without a credential; `external_idp` (varchar 64) and `external_subject` (varchar 255) MUST both be nullable so password-only identities (PoC) can persist without an IdP subject. `patient_id` (UUID) MUST be nullable so caregiver and admin rows can persist without referencing a patient. A CHECK constraint `(password_hash IS NOT NULL) OR (external_subject IS NOT NULL)` MUST guarantee every row has at least one authentication path. A partial unique index on `(tenant_id, external_idp, external_subject) WHERE external_subject IS NOT NULL` MUST guarantee one external identity per (tenant, IdP) pair. `created_by` / `updated_by` (NOT NULL) and `deleted_by` (nullable) all reference `users.id` with `ON DELETE RESTRICT` — the FK is self-referential, and the bootstrap admin row breaks the cycle by self-referencing (`id = created_by = updated_by = ADMIN_USER_ID`).

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `backend-tenant-base` and this change)
- **THEN** a `users` table exists with columns `id` (UUID, primary key, not null), `tenant_id` (UUID, not null, references `tenants.id`, on delete RESTRICT), `created_by` (UUID, not null, references `users.id`, on delete RESTRICT), `updated_by` (UUID, not null, references `users.id`, on delete RESTRICT), `deleted_by` (UUID, nullable, references `users.id`, on delete RESTRICT), `email` (varchar 255, not null), `password_hash` (varchar 255, **nullable**), `display_name` (varchar 255, not null), `role` (enum `role`, not null), `is_active` (boolean, not null, default `true`), `external_idp` (varchar 64, nullable), `external_subject` (varchar 255, nullable), **`patient_id` (UUID, nullable, references `patients.id`, on delete RESTRICT)**, `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`), `deleted_at` (timestamptz, nullable). The table MUST carry a CHECK constraint enforcing `(password_hash IS NOT NULL) OR (external_subject IS NOT NULL)`.

### Requirement: Email is case-insensitive unique per tenant and role

A composite partial unique index on `(tenant_id, lower(email), role)` SHALL replace the previous `(tenant_id, lower(email))` uniqueness rule. A caregiver and a patient in the same tenant MAY share an email; two caregivers (or two patients) in the same tenant MAY NOT.

#### Scenario: Caregiver and patient with the same email coexist

- **WHEN** a caregiver user is inserted with `email = 'jan@zas.be'` and a separate patient user (with a valid `patient_id`) is inserted with the same email in the same tenant
- **THEN** both inserts succeed

#### Scenario: Two caregivers with the same email are rejected

- **WHEN** a second caregiver user is inserted with `email = 'jan@zas.be'` and `role <> 'patient'` in the same tenant as an existing caregiver `jan@zas.be`
- **THEN** the database rejects the insert with a unique-violation error

#### Scenario: Two patient users sharing an email are rejected

- **WHEN** a second patient user is inserted with the same `(tenant_id, lower(email))` and `role = 'patient'` as an existing patient user
- **THEN** the database rejects the insert with a unique-violation error
