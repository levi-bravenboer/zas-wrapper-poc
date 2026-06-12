## ADDED Requirements

### Requirement: Appointment is a tenant-scoped clinical event linked to one patient

The backend SHALL persist an `appointments` table where each row represents one scheduled clinical event for exactly one patient within one tenant. `Appointment` SHALL inherit `TenantOwnedEntity` and `DeletableEntity`, so each row carries inherited columns (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `tenant_id`) plus appointment-specific columns: `patient_id` (UUID, NOT NULL, FK to `patients.id`, ON DELETE RESTRICT), `pathway_block_instance_id` (UUID, NULL, NO FOREIGN KEY in v1 — column reserved for the future pathway runtime), `title` (varchar 255, NOT NULL), `description` (text, NULL), `kind` (enum `appointment_kind`, NOT NULL), `starts_at` (timestamptz, NOT NULL), `ends_at` (timestamptz, NOT NULL), `modality` (enum `appointment_modality`, NOT NULL), `location_text` (varchar 255, NULL), `status` (enum `appointment_status`, NOT NULL, default `'booked'`).

The referenced patient MUST belong to the same tenant as the appointment row (enforced at validator + ORM layer).

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `patients-base`)
- **THEN** an `appointments` table exists with the columns specified above, plus inherited columns

#### Scenario: pathway_block_instance_id is nullable in v1

- **WHEN** the appointments table is inspected after migration
- **THEN** the `pathway_block_instance_id` column MUST exist as `UUID NULL` with NO FOREIGN KEY constraint in v1

### Requirement: Appointment kind enum

The backend SHALL define a `AppointmentKind` enum at `app/core/enums/appointment.py` with values `consultation`, `lab`, `imaging`, `procedure`, `other` (string-valued via `StrEnum`), persisted as Postgres enum type `appointment_kind`.

#### Scenario: Postgres enum type created by migration

- **WHEN** the migration runs on a fresh database
- **THEN** a Postgres enum type `appointment_kind` exists with exactly the values `('consultation', 'lab', 'imaging', 'procedure', 'other')` in that order

### Requirement: Appointment status conforms to FHIR R4 AppointmentStatus

The backend SHALL define an `AppointmentStatus` enum at `app/core/enums/appointment.py` with the full FHIR R4 value set: `proposed`, `pending`, `booked`, `arrived`, `fulfilled`, `cancelled`, `noshow`, `entered_in_error`, `checked_in`, `waitlist` (string-valued via `StrEnum`; the FHIR `entered-in-error` code is stored AND serialised as `entered_in_error` inside this system — translation to the hyphenated FHIR literal happens only at the HiX adapter boundary, MVP scope). Persisted as Postgres enum type `appointment_status`. Default at the ORM column level is `booked`. v1 imposes NO state-machine constraints on transitions.

#### Scenario: Default status on insert is booked

- **WHEN** a row is inserted via the ORM without an explicit `status`
- **THEN** the persisted `status` MUST be `'booked'`

#### Scenario: Wire serialisation uses the underscore form

- **WHEN** an appointment with `status='entered_in_error'` is serialised through the `tasks-base` payload projection
- **THEN** the field value in the response body MUST be the string `"entered_in_error"` (hyphen translation is an adapter-boundary concern, not a wire concern)

### Requirement: Appointment modality enum captures online vs on-site

The backend SHALL define an `AppointmentModality` enum at `app/core/enums/appointment.py` with values `online`, `on_site` (string-valued via `StrEnum`), persisted as Postgres enum type `appointment_modality`. Required column. When `modality = 'on_site'`, `location_text` MUST be present (non-empty). This is enforced by the `AppointmentValidator` module at insert/update time, NOT a DB check (allows future test fixtures or seed scripts to express the rule once at the validator boundary).

#### Scenario: Validator accepts online appointment without location

- **WHEN** the validator runs against a payload with `modality='online'` and `location_text=null`
- **THEN** the validator MUST return success

#### Scenario: Validator rejects on-site appointment without location

- **WHEN** the validator runs against a payload with `modality='on_site'` and `location_text=null` (or empty string)
- **THEN** the validator MUST raise a domain error indicating `location_text` is required for on-site modality

### Requirement: Appointment temporal columns enforce end-after-start

The `starts_at` and `ends_at` columns SHALL both be `timestamptz` and both NOT NULL. The `AppointmentValidator` SHALL enforce `ends_at > starts_at` strictly at insert and update; equality is rejected. Past `starts_at` values are permitted. The DB SHALL add a `CHECK (ends_at > starts_at)` constraint for defence-in-depth.

#### Scenario: Validator rejects end equal to start

- **WHEN** the validator runs against a payload with `starts_at == ends_at`
- **THEN** the validator MUST raise a domain error

#### Scenario: Validator rejects end before start

- **WHEN** the validator runs against a payload with `ends_at < starts_at`
- **THEN** the validator MUST raise a domain error

#### Scenario: DB CHECK constraint rejects end ≤ start

- **WHEN** an INSERT bypassing the validator attempts `ends_at <= starts_at`
- **THEN** Postgres MUST reject with a CHECK constraint violation

#### Scenario: Past appointments accepted

- **WHEN** the validator runs against a payload with `starts_at` in the past and `ends_at > starts_at`
- **THEN** the validator MUST return success

### Requirement: Participants persist in a dedicated child table with exactly one lead

The backend SHALL persist an `appointment_participants` table where each row links one user to one appointment with a role. Columns: `id` (UUID, PK), `appointment_id` (UUID, NOT NULL, FK to `appointments.id`, ON DELETE CASCADE), `user_id` (UUID, NOT NULL, FK to `users.id`, ON DELETE RESTRICT), `role` (enum `appointment_participant_role`, NOT NULL), inherited audit + soft-delete columns. `AppointmentParticipantRole` enum values: `lead`, `support`, `observer`.

A partial unique index `(appointment_id) WHERE role = 'lead' AND deleted_at IS NULL` SHALL enforce exactly one active `lead` per appointment. A partial unique index `(appointment_id, user_id) WHERE deleted_at IS NULL` SHALL prevent the same user appearing twice on the same appointment.

The `AppointmentValidator` SHALL enforce at write time: ≥1 participant, exactly one `lead`, no duplicate `user_id`, all participants same-tenant as the appointment. v1 freezes the participant set after create — there is NO mutation path in v1.

User referenced by `user_id` MUST belong to the same tenant as the appointment (validator-layer enforcement).

#### Scenario: Validator requires exactly one lead

- **WHEN** the validator runs against a payload with zero `lead` entries
- **THEN** the validator MUST raise a domain error

#### Scenario: Validator rejects multiple leads

- **WHEN** the validator runs against a payload with two or more `lead` entries
- **THEN** the validator MUST raise a domain error

#### Scenario: Validator rejects duplicate user

- **WHEN** the validator runs against a payload with the same `user_id` appearing twice
- **THEN** the validator MUST raise a domain error

#### Scenario: Validator rejects cross-tenant participant

- **WHEN** the validator runs against a payload referencing a `user_id` whose `tenant_id` differs from the appointment's `tenant_id`
- **THEN** the validator MUST raise a domain error

#### Scenario: Partial unique index rejects second active lead

- **WHEN** an INSERT bypassing the validator attempts to add a second `role='lead'` row for the same `appointment_id` with `deleted_at IS NULL`
- **THEN** Postgres MUST reject with a unique constraint violation on the partial index

#### Scenario: Partial unique index rejects duplicate user

- **WHEN** an INSERT bypassing the validator attempts to add the same `user_id` twice for the same `appointment_id` with `deleted_at IS NULL`
- **THEN** Postgres MUST reject with a unique constraint violation on the partial index

#### Scenario: Hard delete cascades participants

- **WHEN** an `appointments` row is hard-deleted (test-only path)
- **THEN** all matching `appointment_participants` rows MUST be deleted by the FK CASCADE

### Requirement: Appointment domain ships as data layer only (no HTTP API in v1)

The backend SHALL NOT expose any HTTP route under `/appointments` in v1. The appointment domain ships exactly:

- Postgres tables (`appointments`, `appointment_participants`) + four Postgres enums (`appointment_kind`, `appointment_status`, `appointment_modality`, `appointment_participant_role`).
- SQLAlchemy ORM models (`Appointment`, `AppointmentParticipant`).
- Alembic migration creating the tables, enums, partial unique indexes, CHECK constraint, and supporting indexes for the aggregator hot path.
- Minimal Pydantic schemas used internally by the `tasks-base` aggregator to project rows into the `TaskItem` envelope: `AppointmentParticipantInlineSummary` (`{ user_id, role, user_display_name }`). NO `AppointmentCreate`, `AppointmentPatch`, `AppointmentRead`, or `AppointmentParticipantRead` schema ships v1.
- An `AppointmentValidator` module (functions or a thin class) enforcing the rules above (`ends_at > starts_at`, modality+location, participants invariants, same-tenant). Reusable by future writers (pathway runtime, HiX adapter, future POST/PATCH routes, test fixtures).
- NO `AppointmentRepository`, NO `AppointmentService` with CRUD methods, NO `HixAppointmentAdapter`.

Rows enter the table via test fixtures only in this change. Future changes wire HTTP routes, pathway runtime, and HiX adapter.

#### Scenario: No /appointments HTTP routes exist

- **WHEN** the OpenAPI document for this change is inspected
- **THEN** there MUST NOT exist any operation under the `/appointments` path (no GET, no POST, no PATCH, no DELETE)

#### Scenario: No AppointmentService class with CRUD methods is registered

- **WHEN** the backend is imported
- **THEN** there MUST NOT exist a class `AppointmentService` exposing `create()`, `patch()`, or `soft_delete()` methods

#### Scenario: No HiX appointment adapter ships

- **WHEN** the codebase under `app/adapters/hix/` is inspected
- **THEN** there MUST NOT exist a file `appointments.py` or a class `HixAppointmentAdapter`

#### Scenario: No AppointmentRead / AppointmentCreate / AppointmentPatch schemas ship

- **WHEN** the codebase under `app/schemas/appointment/` is inspected
- **THEN** there MUST NOT exist classes `AppointmentRead`, `AppointmentCreate`, `AppointmentPatch`, or `AppointmentParticipantRead`; only `AppointmentParticipantInlineSummary` (used by `tasks-base` projection) MAY exist

#### Scenario: ORM models register

- **WHEN** the backend metadata is inspected after migration
- **THEN** SQLAlchemy models `Appointment` and `AppointmentParticipant` MUST be registered with the expected columns; the alembic migration MUST create the corresponding tables, partial unique indexes, CHECK constraint, and supporting indexes
