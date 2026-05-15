## MODIFIED Requirements

### Requirement: Role enum is a single canonical value

The backend SHALL define exactly one Python `Role` enum at `app/core/enums/user.py` with values `admin`, `caregiver` (string-valued via `StrEnum`), re-exported from `app/core/enums/__init__.py`. The value `external` is REMOVED — the concept it conveyed (caregiver authority scoping) is now derived from organisation-tree comparison via `is_external_for(user, patient)` in `organisations-base`, not from the user's role. This enum MUST be the source of truth for the `role` column type (`sa.Enum(Role, name="role", native_enum=True, create_constraint=True)`) and for every Pydantic `role` field in `app/schemas/`.

#### Scenario: ORM model imports Role from core

- **WHEN** the `User` ORM model declares its `role` column
- **THEN** it MUST import `Role` from `app.core.enums.user` and pass it to `sa.Enum(...)`

#### Scenario: Pydantic schemas import Role from core

- **WHEN** a Pydantic schema (e.g. `SessionUser`, `AssignRoleRequest`) types a `role` field
- **THEN** it MUST import `Role` from `app.core.enums.user`

#### Scenario: Postgres enum type created by migration

- **WHEN** the migration runs against a fresh database (post-`organisations-base`)
- **THEN** a Postgres `enum` type named `role` MUST exist with exactly the values `'admin'`, `'caregiver'`

#### Scenario: Legacy `external` value is rejected

- **WHEN** any insert or update sets `users.role = 'external'`
- **THEN** the database MUST reject the operation (value not in enum)

## ADDED Requirements

### Requirement: Users carry a mandatory organisation affiliation

The `users` table SHALL carry an `organisation_id` column (UUID, NOT NULL, FK → `organisations.id`, on delete RESTRICT). Every user row SHALL reference an organisation in the SAME tenant as the user. The migration that introduces the column SHALL backfill existing rows to a seeded organisation in the same tenant before applying the NOT NULL constraint.

#### Scenario: Column exists and is NOT NULL after migration

- **WHEN** the database is migrated past `organisations-base` head
- **THEN** the `users.organisation_id` column MUST exist with `NOT NULL` and a FK to `organisations.id`

#### Scenario: Cross-tenant assignment rejected at the service layer

- **WHEN** a write attempts to set `users.organisation_id` to an organisation whose `tenant_id` differs from the user's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the write MUST NOT persist

#### Scenario: Seeded users get organisation assignment

- **WHEN** the seed pipeline runs after the `organisations-base` seed
- **THEN** the seeded admin row's `organisation_id` MUST reference the demo root hospital row, and the seeded caregiver row's `organisation_id` MUST reference a leaf program row in that hospital's subtree
