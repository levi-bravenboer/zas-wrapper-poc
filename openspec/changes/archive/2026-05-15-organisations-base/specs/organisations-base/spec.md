## ADDED Requirements

### Requirement: Organisations table persists tenant-scoped FHIR Organization tree

The backend SHALL persist an `organisations` table where each row represents a clinical unit (hospital, division, department, ward, or program) belonging to exactly one tenant. The table SHALL be self-referencing via `parent_organisation_id` (nullable FK to `organisations.id`, on delete RESTRICT). The structural shape SHALL conform to FHIR R4 `Organization` with `partOf` semantics. Tree depth SHALL be unlimited at the schema level.

#### Scenario: Table created by migration

- **WHEN** a fresh database is migrated to head (after `tenant-base` + `user-base`)
- **THEN** an `organisations` table exists with columns `id` (UUID, primary key, not null), `tenant_id` (UUID, not null, references `tenants.id`, on delete RESTRICT), `parent_organisation_id` (UUID, nullable, references `organisations.id`, on delete RESTRICT), `name` (varchar 255, not null), `type_code` (varchar 64, not null), `type_system` (varchar 255, nullable, default `http://terminology.hl7.org/CodeSystem/organization-type`), `type_display` (varchar 255, nullable), `created_by` (UUID, not null, references `users.id`, on delete RESTRICT), `updated_by` (UUID, not null, references `users.id`, on delete RESTRICT), `deleted_by` (UUID, nullable, references `users.id`, on delete RESTRICT), `created_at` (timestamptz, not null, default `now()`), `updated_at` (timestamptz, not null, default `now()`), `deleted_at` (timestamptz, nullable)

#### Scenario: Self-parent rejected by check constraint

- **WHEN** an update or insert sets `parent_organisation_id = id`
- **THEN** the database MUST reject the operation via a check constraint

#### Scenario: Cross-tenant parent rejected by service layer

- **WHEN** a write attempts to set `parent_organisation_id` to an org row whose `tenant_id` differs from the inserted row's `tenant_id`
- **THEN** the service layer MUST raise a domain error and the database MUST NOT contain the inserted row

### Requirement: Organisation type matches FHIR CodeableConcept shape

The backend SHALL persist organisation type as three columns (`type_code`, `type_system`, `type_display`) matching the FHIR R4 `Organization.type` `CodeableConcept` (single `coding` element in PoC). `type_code` SHALL be NOT NULL; `type_system` SHALL default to `http://terminology.hl7.org/CodeSystem/organization-type`. The value set is `extensible`: any string code SHALL be accepted at the schema level.

The backend SHALL define a Python `OrganisationTypeCode` StrEnum at `app/core/enums/organisation.py` covering the standard FHIR `organization-type` codes (`prov | dept | team | govt | ins | pay | edu | reli | crs | cg | bus | other`). The enum SHALL be a **soft** typing aid (used in seed, schemas, FE typing) and SHALL NOT be enforced at the database layer; unknown codes pass through.

Multi-type (FHIR cardinality 0..*) is out of scope for this change and reserved as an additive future migration to a side table.

#### Scenario: ORM model uses string column for type_code

- **WHEN** the `Organisation` ORM model declares its `type_code` column
- **THEN** the column MUST be a varchar/`String` SQLAlchemy type, NOT a Postgres enum

#### Scenario: Unknown type_code accepted by database

- **WHEN** an insert sets `type_code` to a string not present in `OrganisationTypeCode`
- **THEN** the database MUST accept the row (no enum constraint violation)

#### Scenario: Seed uses FHIR standard codes

- **WHEN** the seed creates the demo tree
- **THEN** hospital nodes MUST carry `type_code='prov'`, department nodes MUST carry `type_code='dept'`, and program/team nodes MUST carry `type_code='team'`, each with `type_system='http://terminology.hl7.org/CodeSystem/organization-type'`

### Requirement: Organisations API exposes tenant-scoped read-only tree

The backend SHALL expose `GET /organisations` returning a flat list of all non-soft-deleted `organisations` rows in the caller's tenant, each carrying `parent_organisation_id` so the client can materialise the tree. The endpoint SHALL require an authenticated `admin` or `caregiver` user. No create / update / delete endpoints SHALL be exposed by this change.

#### Scenario: List returns full tenant tree

- **WHEN** a caregiver in tenant T calls `GET /organisations`
- **THEN** the response MUST contain every non-soft-deleted organisation row whose `tenant_id == T` and MUST NOT contain any row whose `tenant_id != T`

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated request hits `GET /organisations`
- **THEN** the API MUST respond `401 Unauthorized`

#### Scenario: No write endpoints exposed

- **WHEN** an `OPTIONS /organisations` request is inspected for allowed methods
- **THEN** only `GET` (and `HEAD`) MUST be returned for that path; `POST`, `PATCH`, `PUT`, `DELETE` MUST NOT be exposed by this change

### Requirement: Externality predicate is derived from organisation tree

The backend SHALL provide a pure helper at `app/services/organisation/predicates.py` named `is_external_for_root(user_root_org_id, patient_root_org_id)` returning `True` iff `user_root_org_id != patient_root_org_id`. Callers SHALL resolve the root ancestor for a given organisation via `OrganisationRepository.get_root_ancestor(org_id)` (recursive CTE on `parent_organisation_id`). The helper SHALL be the single source of truth for the "internal vs external caregiver" question across downstream features; `users.role` MUST NOT carry the concept. A higher-level wrapper that accepts full `User` / `Patient` objects MAY be added by a downstream capability (e.g. `patients-base`).

#### Scenario: Same-root caregiver is internal

- **WHEN** `is_external_for_root(R, R)` is called for any UUID `R`
- **THEN** the return value MUST be `False`

#### Scenario: Different-root caregiver is external

- **WHEN** `is_external_for_root(R1, R2)` is called with `R1 != R2`
- **THEN** the return value MUST be `True`

#### Scenario: Root resolution walks parent chain

- **WHEN** `OrganisationRepository.get_root_ancestor(leaf_org_id)` is called on a leaf organisation whose ancestry is leaf → dept → hospital → root-provider
- **THEN** the returned organisation MUST be the row whose `parent_organisation_id IS NULL` at the top of the chain

### Requirement: Seed creates a coherent demo tree and assigns seeded users to nodes

The seed pipeline SHALL produce, in the default demo tenant, at minimum:

- one root organisation with `type_code='prov'` (e.g. "ZAS Antwerpen")
- at least one organisation with `type_code='dept'` under it (e.g. "Orthopedie")
- at least one organisation with `type_code='team'` under that department (e.g. "Rugrevalidatie")

The seeded admin user SHALL be assigned to the root provider organisation. The seeded caregiver user SHALL be assigned to a leaf team node (e.g. the `Rugrevalidatie` team). Seed SHALL be idempotent: re-running MUST NOT duplicate rows.

#### Scenario: Demo tree present after seed

- **WHEN** the seed pipeline runs against a fresh database
- **THEN** the default demo tenant MUST contain at least one row each with `type_code='prov'`, `type_code='dept'`, and `type_code='team'`, linked into a connected tree rooted at the provider row

#### Scenario: Seeded caregiver attached to leaf team

- **WHEN** the seeded caregiver row is queried after seed
- **THEN** its `organisation_id` MUST reference an organisation row with `type_code='team'` reachable from the demo provider root

#### Scenario: Re-running seed is idempotent

- **WHEN** the seed pipeline runs twice against the same database
- **THEN** the count of `organisations` rows after run 2 MUST equal the count after run 1
