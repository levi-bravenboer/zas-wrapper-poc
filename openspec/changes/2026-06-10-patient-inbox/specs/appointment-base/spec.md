## ADDED Requirements

### Requirement: Appointment is a tenant-scoped clinical event linked to one patient

The backend SHALL persist an `appointments` table where each row represents one scheduled clinical event for exactly one patient within one tenant. `Appointment` SHALL inherit `TenantOwnedEntity` and `DeletableEntity`, so each row carries inherited columns (`id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `tenant_id`) plus appointment-specific columns: `patient_id` (UUID, NOT NULL, FK to `patients.id`, ON DELETE RESTRICT), `pathway_block_instance_id` (UUID, NULL, NO FOREIGN KEY in v1 — column reserved for the future pathway runtime; a follow-up migration adds the `ON DELETE SET NULL` FK against `pathway_block_instances` when that table lands), `title` (varchar 255, NOT NULL), `description` (text, NULL), `kind` (enum `appointment_kind`, NOT NULL), `starts_at` (timestamptz, NOT NULL), `ends_at` (timestamptz, NOT NULL), `modality` (enum `appointment_modality`, NOT NULL), `location_text` (varchar 255, NULL), `status` (enum `appointment_status`, NOT NULL, default `'booked'`).

The referenced patient MUST belong to the same tenant as the appointment row (enforced at service layer). All non-id appointment queries SHALL be tenant-scoped through the inherited `tenant_id` filter.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `patients-base`)
- **THEN** an `appointments` table exists with the columns specified above, plus inherited columns

#### Scenario: Patient must be same-tenant

- **WHEN** a write attempts to set `patient_id` to a patient row whose `tenant_id` differs from the appointment's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: Cross-tenant rows return 404

- **WHEN** a caregiver in tenant A issues `GET /appointments/{id}` for an appointment whose `tenant_id` is tenant B
- **THEN** the API MUST respond `404 Not Found` (not `403`) to avoid existence disclosure

#### Scenario: pathway_block_instance_id is nullable and unused in v1

- **WHEN** any v1 write creates or updates an appointment via the public API
- **THEN** the request MUST NOT accept `pathway_block_instance_id` from the client (column populated only by future pathway runtime); the column MUST default to `null` on every v1-created row

### Requirement: Appointment kind enum is FHIR-aligned

The backend SHALL define a `AppointmentKind` enum at `app/core/enums/appointment.py` with values `consultation`, `lab`, `imaging`, `procedure`, `other` (string-valued via `StrEnum`), persisted as Postgres enum type `appointment_kind`. These values are domain-internal — they MAY map onto FHIR `Appointment.serviceType` or `Appointment.specialty` codings via a future translation table at MVP; the v1 enum is the source of truth in PoC.

#### Scenario: Postgres enum type created by migration

- **WHEN** the migration runs on a fresh database
- **THEN** a Postgres enum type `appointment_kind` exists with exactly the values `('consultation', 'lab', 'imaging', 'procedure', 'other')` in that order

#### Scenario: Pydantic schemas import AppointmentKind from core

- **WHEN** a Pydantic schema types a `kind` field
- **THEN** it MUST import `AppointmentKind` from `app.core.enums.appointment`

### Requirement: Appointment status conforms to FHIR R4 AppointmentStatus

The backend SHALL define an `AppointmentStatus` enum at `app/core/enums/appointment.py` with the full FHIR R4 value set: `proposed`, `pending`, `booked`, `arrived`, `fulfilled`, `cancelled`, `noshow`, `entered_in_error`, `checked_in`, `waitlist` (string-valued via `StrEnum`, the FHIR `entered-in-error` code is stored as `entered_in_error` in the enum and serialised as `entered-in-error` on the wire to keep Python-symbol legality). Persisted as Postgres enum type `appointment_status`. Default on create is `booked`. v1 imposes NO state-machine constraints on transitions — any status may transition to any other status via `PATCH`.

#### Scenario: Default status on create is booked

- **WHEN** `POST /appointments` is called without an explicit `status` value
- **THEN** the row's `status` MUST be persisted as `'booked'`

#### Scenario: Free transitions accepted

- **WHEN** `PATCH /appointments/{id}` sets `status` to any FHIR-valid value
- **THEN** the API MUST accept the transition (subject to permissions) without state-machine validation

#### Scenario: Wire serialisation preserves FHIR hyphen

- **WHEN** an appointment with `status='entered_in_error'` is serialised to JSON
- **THEN** the field value in the response body MUST be the string `"entered-in-error"`

### Requirement: Appointment modality enum captures online vs on-site

The backend SHALL define an `AppointmentModality` enum at `app/core/enums/appointment.py` with values `online`, `on_site` (string-valued via `StrEnum`), persisted as Postgres enum type `appointment_modality`. Required column. When `modality = 'on_site'`, `location_text` MUST be present (non-empty) — service-layer validation, not a DB check (allows seed scripts to leave `location_text` empty for online entries without bypassing DB constraints).

#### Scenario: Online appointment without location accepted

- **WHEN** `POST /appointments` is called with `modality='online'` and `location_text=null`
- **THEN** the row MUST persist with `location_text=null`

#### Scenario: On-site appointment without location rejected

- **WHEN** `POST /appointments` is called with `modality='on_site'` and `location_text=null` or `location_text=''`
- **THEN** the API MUST respond `422 Unprocessable Entity` with a clear error message

#### Scenario: On-site appointment with location accepted

- **WHEN** `POST /appointments` is called with `modality='on_site'` and `location_text='Polikliniek 3, kamer 12'`
- **THEN** the row MUST persist with the supplied `location_text`

### Requirement: Appointment temporal columns enforce end-after-start

The `starts_at` and `ends_at` columns SHALL both be `timestamptz` and both NOT NULL. The service layer SHALL enforce `ends_at > starts_at` strictly at create and update; equality is rejected. Past `starts_at` values are permitted (back-filling historical appointments is a valid clinical action). The DB MAY add a `CHECK (ends_at > starts_at)` constraint for defence-in-depth.

#### Scenario: end equal to start rejected

- **WHEN** `POST /appointments` is called with `starts_at == ends_at`
- **THEN** the API MUST respond `422 Unprocessable Entity`

#### Scenario: end before start rejected

- **WHEN** `POST /appointments` is called with `ends_at < starts_at`
- **THEN** the API MUST respond `422 Unprocessable Entity`

#### Scenario: Past appointments accepted

- **WHEN** `POST /appointments` is called with `starts_at` in the past and `ends_at > starts_at`
- **THEN** the row MUST persist successfully (status defaults to `booked` unless the client supplies another value)

### Requirement: Participants persist in a dedicated child table with exactly one lead

The backend SHALL persist an `appointment_participants` table where each row links one user (caregiver or admin) to one appointment with a role. Columns: `id` (UUID, PK), `appointment_id` (UUID, NOT NULL, FK to `appointments.id`, ON DELETE CASCADE), `user_id` (UUID, NOT NULL, FK to `users.id`, ON DELETE RESTRICT), `role` (enum `appointment_participant_role`, NOT NULL), inherited audit + soft-delete columns. `AppointmentParticipantRole` enum values: `lead`, `support`, `observer`.

A partial unique index `(appointment_id) WHERE role = 'lead' AND deleted_at IS NULL` SHALL enforce exactly one active `lead` per appointment. A partial unique index `(appointment_id, user_id) WHERE deleted_at IS NULL` SHALL prevent the same user appearing twice on the same appointment.

Participants MUST exist at appointment creation (one `lead` required); v1 freezes the participant set after create — there is NO API to add, remove, or change participants on an existing appointment. Changing participants requires deleting the appointment and recreating it.

User referenced by `user_id` MUST belong to the same tenant as the appointment (service-layer enforcement).

#### Scenario: Create requires exactly one lead

- **WHEN** `POST /appointments` is called with a `participants` array containing zero `lead` entries
- **THEN** the API MUST respond `422 Unprocessable Entity`

#### Scenario: Create rejects multiple leads

- **WHEN** `POST /appointments` is called with a `participants` array containing two or more `lead` entries
- **THEN** the API MUST respond `422 Unprocessable Entity`

#### Scenario: Create rejects duplicate user

- **WHEN** `POST /appointments` is called with the same `user_id` appearing twice in `participants`
- **THEN** the API MUST respond `422 Unprocessable Entity`

#### Scenario: PATCH cannot mutate participants in v1

- **WHEN** `PATCH /appointments/{id}` is called with a `participants` field in the body
- **THEN** the API MUST respond `422 Unprocessable Entity` with a message indicating participants are frozen after create in v1

#### Scenario: Cross-tenant participant rejected

- **WHEN** `POST /appointments` references a `user_id` whose `tenant_id` differs from the appointment's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: Hard delete cascades participants

- **WHEN** an `appointments` row is hard-deleted (test-only path)
- **THEN** all matching `appointment_participants` rows MUST be deleted by the FK CASCADE

### Requirement: Appointments API exposes tenant-scoped CRUD for caregivers and admins

The backend SHALL expose under `/appointments` exactly these routes: `GET /appointments` (list), `GET /appointments/{id}` (read), `POST /appointments` (create), `PATCH /appointments/{id}` (update — excludes participants), `DELETE /appointments/{id}` (soft delete). All routes SHALL require an authenticated user matching `require_role(Role.ADMIN, Role.CAREGIVER)`. The `Role.PATIENT` user (mobile app) SHALL NOT have access to any `/appointments` route in v1 (patient-facing read lands later, separately).

All routes SHALL be tenant-scoped via the session actor's `tenant_id`. Cross-tenant reads SHALL return `404`, never `403`.

**Visibility within a tenant**:

- `admin` users SHALL see all non-soft-deleted appointments in their tenant.
- `caregiver` users SHALL see an appointment ONLY when they have access to its `patient_id` per `require_patient_access` (the existing care-team OR PractitionerRole-tree predicate from `patients-base`). The caregiver's participation in the appointment (being or not being a participant row) does NOT factor into visibility — patient access alone gates it.

Every route handler that applies an auth guard SHALL carry an `# AUTH-HARDEN` source comment.

`PATCH` SHALL accept any subset of: `title`, `description`, `kind`, `starts_at`, `ends_at`, `modality`, `location_text`, `status`. It MUST reject `participants`, `patient_id`, `pathway_block_instance_id`, `tenant_id`, and audit columns.

`DELETE` SHALL soft-delete (stamp `deleted_at` and `deleted_by`); subsequent `GET /appointments/{id}` MUST return `404`. The associated `appointment_participants` rows SHALL also be soft-deleted in the same transaction.

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated request calls any `/appointments` route
- **THEN** the API MUST respond `401 Unauthorized`

#### Scenario: Patient role rejected

- **WHEN** a `patient`-role user (mobile app session) calls any `/appointments` route
- **THEN** the API MUST respond `403 Forbidden`

#### Scenario: Caregiver sees only appointments for patients they can see

- **WHEN** caregiver `C` is on a care team for patient `P1` but not patient `P2`, and both patients have appointments
- **THEN** `GET /appointments` for `C` MUST include `P1`'s appointments and MUST NOT include `P2`'s appointments

#### Scenario: Caregiver participation does not grant access without patient access

- **WHEN** caregiver `C` is listed as `lead` participant on appointment `A` for patient `P`, but `C` has lost patient-access to `P` (no open care-team row, no PractitionerRole-root overlap)
- **THEN** `GET /appointments/{A.id}` for `C` MUST return `404`

#### Scenario: Admin sees all appointments in tenant

- **WHEN** an admin in tenant T calls `GET /appointments` with no filters
- **THEN** the response MUST contain every non-soft-deleted appointment row whose `tenant_id == T`

#### Scenario: PATCH cannot mutate patient_id

- **WHEN** `PATCH /appointments/{id}` is called with a `patient_id` field in the body
- **THEN** the API MUST respond `422 Unprocessable Entity`

#### Scenario: DELETE soft-deletes appointment and participants

- **WHEN** a caregiver issues `DELETE /appointments/{id}` on an appointment they can access
- **THEN** the appointment's `deleted_at` MUST be set, `deleted_by` MUST be set to the caregiver's `id`, and every linked `appointment_participants` row MUST also have `deleted_at` set in the same transaction

### Requirement: List endpoint supports FHIR-aligned filter / sort dimensions

The `GET /appointments` route SHALL ride on the shared `ListQuery` envelope and expose the following dimensions:

- Pagination via `page` (int, default 1) and `page_size` (int, default 25, max 100); response envelope is `Page[AppointmentRead]`.
- `filter[patient_id][eq]=<uuid>` — exact patient scoping. Maps to FHIR `Appointment.actor` (patient).
- `filter[status][eq|in]=<status>` — FHIR `Appointment.status`.
- `filter[kind][eq|in]=<kind>` — internal kind enum.
- `filter[modality][eq]=<modality>`.
- `filter[starts_at][gte]=<datetime>` and `filter[starts_at][lte]=<datetime>` — date-range. FHIR `date` search param equivalent.
- `q=<value>` — case-insensitive substring on `title` via `searchable_fields`.
- `order_by` accepts at minimum `starts_at` (default), `created_at`, `status`. Default `order` is `asc` (closest upcoming first).

All matches SHALL be tenant-scoped via `BaseListRepository._tenant_predicate` and additionally filtered by the caregiver patient-access predicate (admin bypasses).

#### Scenario: Filter by patient

- **WHEN** `GET /appointments?filter[patient_id][eq]=<id>` is called by a caregiver with access to that patient
- **THEN** the response MUST contain only that patient's appointments

#### Scenario: Date range filter

- **WHEN** `GET /appointments?filter[starts_at][gte]=2026-06-01T00:00:00Z&filter[starts_at][lte]=2026-06-30T23:59:59Z` is called
- **THEN** the response MUST contain only appointments whose `starts_at` falls in that range

#### Scenario: Default sort is starts_at ascending

- **WHEN** `GET /appointments` is called with no `order_by` and no `order`
- **THEN** the response items MUST be ordered by `starts_at` ascending

### Requirement: AppointmentRead embeds participants

`AppointmentRead` SHALL include a `participants: list[AppointmentParticipantRead]` field, eagerly loaded on `GET /appointments` and `GET /appointments/{id}`. Each `AppointmentParticipantRead` SHALL include `{ id, user_id, role, user_display_name }` where `user_display_name` is resolved from the existing `users` projection at serialisation time.

#### Scenario: Read response includes participants

- **WHEN** `GET /appointments/{id}` returns a successful response
- **THEN** the body MUST include `participants: [{ id, user_id, role, user_display_name }, ...]` with exactly one `lead` entry

### Requirement: HiX appointment adapter module reserves the MVP wiring point

The backend SHALL provide a module at `app/adapters/hix/appointments.py` exposing class `HixAppointmentAdapter` with methods `fetch(external_ref: str)` and `upsert_from_hix(payload)`. Both methods SHALL raise `NotImplementedError("HiX appointment adapter is MVP scope")` in PoC. The module SHALL be importable and covered by an import-test.

#### Scenario: Adapter module is importable

- **WHEN** `from app.adapters.hix.appointments import HixAppointmentAdapter` is executed
- **THEN** the import MUST succeed without side effects

#### Scenario: Adapter methods raise NotImplementedError in PoC

- **WHEN** `HixAppointmentAdapter().fetch("x")` or `HixAppointmentAdapter().upsert_from_hix({})` is called
- **THEN** the call MUST raise `NotImplementedError` with the message `"HiX appointment adapter is MVP scope"`
