# practitioner-role-split Specification

## Purpose
TBD - created by archiving change practitioner-role-split. Update Purpose after archive.
## Requirements
### Requirement: Practitioner table separates clinical identity from authentication identity

The backend SHALL persist a `practitioners` table where each row represents the FHIR `Practitioner` resource for exactly one caregiver `User`. `Practitioner` SHALL inherit `TenantOwnedEntity` and carry inherited audit columns plus `user_id` (UUID, NOT NULL, FK `users.id` ON DELETE RESTRICT, UNIQUE), `family_name` (varchar 255, NOT NULL), `given_name` (varchar 255, NOT NULL), `qualification` (text, NULLABLE). Admin users SHALL NOT have a Practitioner row; only `User.role = caregiver` rows MAY have one. The 1:1 split exists so that authentication, session, and IdP code paths stay independent of clinical-identity fields, and so that future Practitioners without a login (e.g. HiX-referenced external clinicians) can be represented without forging User rows.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** a `practitioners` table exists with the inherited audit columns plus `user_id` (UUID NOT NULL, FK `users.id` ON DELETE RESTRICT, unique), `family_name` (varchar 255 NOT NULL), `given_name` (varchar 255 NOT NULL), `qualification` (text NULLABLE)

#### Scenario: Caregiver Practitioner is unique per user

- **WHEN** an attempt is made to insert a second `practitioners` row for the same `user_id`
- **THEN** the unique constraint MUST reject the insert

#### Scenario: Admin user has no Practitioner row

- **WHEN** the service creates a Practitioner for a `User` whose `role` is `admin`
- **THEN** the service layer MUST raise a domain error and the row MUST NOT persist

### Requirement: PractitionerRole table models M:N affiliations period-bounded

The backend SHALL persist a `practitioner_roles` table representing the FHIR `PractitionerRole` resource: an M:N join between a Practitioner and an Organisation, period-bounded, carrying a role code and optional specialty. `PractitionerRole` SHALL inherit `TenantOwnedEntity` and carry inherited audit columns plus `practitioner_id` (UUID NOT NULL, FK `practitioners.id` ON DELETE RESTRICT), `organisation_id` (UUID NOT NULL, FK `organisations.id` ON DELETE RESTRICT), `code` (Postgres enum `practitioner_role_code`, NOT NULL), `specialty` (varchar 255 NULLABLE), `is_primary` (boolean NOT NULL DEFAULT FALSE), `period_start` (timestamptz NOT NULL DEFAULT `now()`), `period_end` (timestamptz NULLABLE). Both the Practitioner and the Organisation referenced by a role SHALL share the row's `tenant_id` (enforced at service layer). A NULL `period_end` means the role is currently open; once closed (`period_end IS NOT NULL`), rows are append-only and SHALL NOT be re-opened.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** a `practitioner_roles` table exists with the inherited audit columns plus `practitioner_id` (UUID NOT NULL, FK `practitioners.id` ON DELETE RESTRICT), `organisation_id` (UUID NOT NULL, FK `organisations.id` ON DELETE RESTRICT), `code` (enum `practitioner_role_code` NOT NULL), `specialty` (varchar 255 NULLABLE), `is_primary` (boolean NOT NULL DEFAULT FALSE), `period_start` (timestamptz NOT NULL DEFAULT `now()`), `period_end` (timestamptz NULLABLE)

#### Scenario: Cross-tenant Practitioner/Organisation pairing rejected

- **WHEN** a write attempts to create a `PractitionerRole` whose `practitioner.tenant_id` differs from `organisation.tenant_id`
- **THEN** the service layer MUST raise a domain error and the row MUST NOT persist

#### Scenario: Closed roles are append-only

- **WHEN** a `PractitionerRole` row has `period_end IS NOT NULL` and a PATCH/PUT attempts to clear `period_end` back to NULL
- **THEN** the service layer MUST reject the operation; closing is one-way

### Requirement: PractitionerRole carries a canonical role-code enum

The backend SHALL define `PractitionerRoleCode` at `app/core/enums/practitioner_role.py` as a `StrEnum` with exactly the values `gp`, `physiotherapist`, `psychologist`, `nurse`, `physician`, `other` in that order, re-exported from `app/core/enums/__init__.py`. The enum SHALL be the source of truth for the `code` column type (`sa.Enum(PractitionerRoleCode, name="practitioner_role_code", native_enum=True, create_constraint=True)`) and for every Pydantic `code` field on `PractitionerRole` schemas. Widening to an open `CodeableConcept` is explicitly out of scope; future MVP work is tracked under BL-062.

#### Scenario: Postgres enum type created by migration

- **WHEN** the migration runs on a fresh database
- **THEN** a Postgres enum type `practitioner_role_code` exists with exactly the values `('gp', 'physiotherapist', 'psychologist', 'nurse', 'physician', 'other')` in that order

#### Scenario: Out-of-set value rejected

- **WHEN** an insert or update attempts to set `code` to a value outside the enum
- **THEN** the database enum check MUST reject the write

### Requirement: At most one open PractitionerRole per practitioner+org and at most one primary

The backend SHALL enforce two partial unique constraints on `practitioner_roles`:

- `practitioner_role_one_open_per_org`: UNIQUE `(practitioner_id, organisation_id)` WHERE `period_end IS NULL` — a practitioner SHALL NOT have two concurrent open roles at the same organisation.
- `practitioner_role_one_primary`: UNIQUE `(practitioner_id)` WHERE `is_primary = TRUE AND period_end IS NULL` — a practitioner SHALL have at most one currently primary affiliation.

The service layer SHALL transactionally demote any existing open `is_primary` role belonging to the same practitioner before inserting or promoting a new `is_primary = TRUE` open role, so the partial-unique invariant is never violated mid-transaction.

#### Scenario: Duplicate open role at same org rejected

- **WHEN** two open `PractitionerRole` rows are inserted with identical `(practitioner_id, organisation_id)` and both `period_end IS NULL`
- **THEN** the second insert MUST be rejected by the partial unique index

#### Scenario: Closed periods may overlap with new open period

- **WHEN** a closed `PractitionerRole` exists for `(practitioner=P, organisation=O)` with `period_end < now()`, and a new open role is inserted for the same `(P, O)` with `period_end IS NULL`
- **THEN** the insert MUST succeed (uniqueness applies only to currently open rows)

#### Scenario: Promoting a new primary demotes the previous one

- **WHEN** practitioner `P` has open primary role `R1` and the service opens or updates a different open role `R2` for `P` with `is_primary = TRUE`
- **THEN** within the same transaction, `R1.is_primary` MUST be set to FALSE before `R2` is persisted, and the partial unique index `practitioner_role_one_primary` MUST not be violated at commit

### Requirement: Practitioner and PractitionerRole API expose tenant-scoped admin CRUD plus caregiver self-read

The backend SHALL expose under `/practitioners` and `/practitioner-roles` the following routes, all guarded by `require_role(...)` and carrying `# AUTH-HARDEN` source comments:

- `GET /practitioners/{user_id}` — Practitioner + embedded open and historical roles (ordered `is_primary DESC, period_start DESC`); allowed roles: `ADMIN`, `CAREGIVER` (caregiver MAY read only its own).
- `POST /practitioners` — admin-only; creates a Practitioner for an existing caregiver `User`.
- `PATCH /practitioners/{user_id}` — admin-only; edits `family_name`, `given_name`, `qualification`.
- `GET /practitioner-roles` — admin-only list with filters `practitioner_id`, `organisation_id`, `is_open` (boolean).
- `POST /practitioner-roles` — admin-only; opens a new role (enforces invariants from previous requirement).
- `PATCH /practitioner-roles/{id}` — admin-only; edits `code`, `specialty`, `is_primary`, or sets `period_end`.
- `DELETE /practitioner-roles/{id}` — admin-only; soft-close (sets `period_end = now()`).

All routes SHALL be tenant-scoped via the session actor's `tenant_id`; cross-tenant reads SHALL return `404`, never `403`.

#### Scenario: Caregiver can read its own Practitioner only

- **WHEN** a caregiver `C` calls `GET /practitioners/{user_id}` with `user_id != C.id`
- **THEN** the API MUST respond `403 Forbidden`

#### Scenario: Non-admin write rejected

- **WHEN** a caregiver calls `POST /practitioners` or any write on `/practitioner-roles/*`
- **THEN** the API MUST respond `403 Forbidden`

#### Scenario: Promoting a new primary demotes via the API in one request

- **WHEN** an admin issues `PATCH /practitioner-roles/{id}` setting `is_primary = TRUE` against an open role for practitioner `P` and an existing open primary `R1` already exists for `P`
- **THEN** the request MUST succeed, `R1.is_primary` MUST be FALSE in the next read, and the request body MUST NOT need to mention `R1`

#### Scenario: AUTH-HARDEN marker present on every guarded route

- **WHEN** any source-level scan of `app/api/routers/practitioner/*` and `app/api/routers/practitioner_role/*` runs
- **THEN** every route handler that applies a role or session guard MUST carry an `# AUTH-HARDEN` comment within its function body or as a leading guard-line comment

### Requirement: Practitioner seed materialises one primary affiliation per caregiver

The backend SHALL provide `scripts/seed_practitioners.py` that, after `scripts/seed_users.py`, materialises one `Practitioner` row per seeded caregiver `User` (deriving `family_name` / `given_name` from `User.display_name`) and one open `PractitionerRole` with the user's pre-existing `organisation_id`, `is_primary = TRUE`, `code = 'other'`, `period_start = User.created_at`, `period_end = NULL`. The script SHALL be idempotent — re-running MUST NOT create duplicate rows.

#### Scenario: Re-running seed is idempotent

- **WHEN** `seed_practitioners.py` is run twice against the same database
- **THEN** the second run MUST NOT create duplicate Practitioner or open PractitionerRole rows

#### Scenario: Seeded caregiver has exactly one open primary role

- **WHEN** the seed script completes
- **THEN** every caregiver `User` has exactly one `Practitioner` row, and that Practitioner has exactly one open (`period_end IS NULL`) `PractitionerRole` row with `is_primary = TRUE`

### Requirement: Visibility predicate routes through PractitionerRole

The backend SHALL provide a helper `practitioner_root_orgs_for(user) -> set[UUID]` (in `app/services/practitioner_role/predicates.py` or equivalent) returning, for a caregiver `User`, the set of organisation-tree root UUIDs reachable through any **open** `PractitionerRole` belonging to that user's `Practitioner`. Patient visibility SHALL OR caregiver care-team membership with the predicate `root(patient.primary_organisation_id) ∈ practitioner_root_orgs_for(user)`. Single-role caregivers SHALL see exactly the same patient set as before the split; multi-role caregivers SHALL see the union across their roles' root subtrees.

#### Scenario: Single-role caregiver sees identical patient set as pre-split

- **WHEN** caregiver `C` has exactly one open `PractitionerRole` at organisation `O`, and the same `O` had previously been recorded as `User.organisation_id` pre-migration
- **THEN** `GET /patients` for `C` MUST return the same set of patients as it did against the pre-split predicate

#### Scenario: Multi-role caregiver sees union of root subtrees

- **WHEN** caregiver `C` has two open `PractitionerRole` rows at organisations under different roots `R1` and `R2`, and patients exist under both roots
- **THEN** `GET /patients` for `C` MUST include patients under `R1` and under `R2`, scoped by `C.tenant_id`

