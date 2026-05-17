# organisations-base Specification

## Purpose
TBD - created by archiving change organisations-base. Update Purpose after archive.
## Requirements
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

The backend SHALL expose `GET /organisations` returning a flat list of all non-soft-deleted `organisations` rows in the caller's tenant, each carrying `parent_organisation_id` so the client can materialise the tree. The endpoint SHALL require an authenticated `admin` or `caregiver` user. Admin-only write endpoints (`POST /organisations`, `PATCH /organisations/{id}`, `DELETE /organisations/{id}`) MAY be added by downstream capabilities (specifically `organisations-admin-ui`); they are scoped to `Role.ADMIN` and carry their own `# AUTH-HARDEN` markers.

#### Scenario: List returns full tenant tree

- **WHEN** a caregiver in tenant T calls `GET /organisations`
- **THEN** the response MUST contain every non-soft-deleted organisation row whose `tenant_id == T` and MUST NOT contain any row whose `tenant_id != T`

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated request hits `GET /organisations`
- **THEN** the API MUST respond `401 Unauthorized`

#### Scenario: Caregivers cannot reach write endpoints

- **WHEN** a caregiver attempts `POST /organisations`, `PATCH /organisations/{id}`, or `DELETE /organisations/{id}`
- **THEN** the API MUST respond `403 Forbidden` with `ErrorResponse{ code: "forbidden.auth.role" }`

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

### Requirement: Practitioner root-organisation predicate consumes open PractitionerRole rows

The backend SHALL provide a helper `practitioner_root_orgs_for(user) -> set[UUID]` returning, for a given caregiver `User`, the set of organisation-tree root UUIDs reachable via **any** open `PractitionerRole` rows belonging to that user's `Practitioner`. The helper SHALL be implemented under `app/services/practitioner_role/predicates.py` (or re-exported from `app/services/organisation/predicates.py`) and SHALL resolve each role's `organisation_id` to its root through the existing `OrganisationRepository.get_root_ancestor` recursive CTE. The pure `is_external_for_root(user_root_org_id, patient_root_org_id)` helper (introduced by `organisations-base`) is unchanged in signature and semantics; what changes is **how callers obtain `user_root_org_id`**: pre-split they read `user.organisation_id`; post-split they enumerate the set returned by `practitioner_root_orgs_for(user)` and OR across it.

If a caregiver has no open `PractitionerRole`, the helper SHALL return the empty set; callers SHALL treat that as "no external-tree access" without raising.

#### Scenario: Single open role returns single root

- **WHEN** `practitioner_root_orgs_for(user)` is called for a caregiver with one open `PractitionerRole` at organisation `O` whose root is `R`
- **THEN** the result MUST equal `{R}`

#### Scenario: Multiple open roles return the union of roots

- **WHEN** `practitioner_root_orgs_for(user)` is called for a caregiver with two open `PractitionerRole` rows at organisations under different roots `R1` and `R2`
- **THEN** the result MUST equal `{R1, R2}`

#### Scenario: Caregiver with no open role returns empty set

- **WHEN** `practitioner_root_orgs_for(user)` is called for a caregiver whose Practitioner has zero rows in `practitioner_roles` with `period_end IS NULL`
- **THEN** the result MUST equal `set()` and the call MUST NOT raise

#### Scenario: Closed roles are excluded

- **WHEN** `practitioner_root_orgs_for(user)` is called for a caregiver whose only `PractitionerRole` row has `period_end < now()`
- **THEN** the result MUST equal `set()`

### Requirement: Organisations carry a stable sibling sort index

The `organisations` table SHALL persist an `INTEGER NOT NULL DEFAULT 0`
column `sort_index` representing each row's position among its siblings
(rows sharing the same `parent_organisation_id`, or all root rows for
`parent_organisation_id IS NULL`). A composite index
`(parent_organisation_id, sort_index)` SHALL exist to make sibling
enumeration cheap. Existing rows SHALL be backfilled deterministically by
name on migration so the post-migration ordering is identical to the
prior alphabetical render.

The `OrganisationRead` schema SHALL include `sort_index: int`, and
`GET /organisations` SHALL return rows ordered by
`(parent_organisation_id NULLS FIRST, sort_index, name)` so that clients
materialising the tree get a stable order without re-sorting.

#### Scenario: Migration adds column with backfilled order

- **WHEN** the migration is applied to a database containing existing
  organisations
- **THEN** every `organisations` row MUST carry a `sort_index` value such
  that siblings (rows with equal `parent_organisation_id`) are numbered
  contiguously starting at `0` in ascending order of `name`

#### Scenario: Composite index exists after migration

- **WHEN** the database schema is inspected post-migration
- **THEN** an index on `(parent_organisation_id, sort_index)` MUST exist
  on the `organisations` table

#### Scenario: List endpoint returns rows ordered for stable rendering

- **WHEN** an admin calls `GET /organisations` in a tenant containing
  multiple siblings
- **THEN** the response array MUST be ordered such that siblings appear
  in ascending `sort_index`, and ties (if any) MUST be resolved by
  ascending `name`

### Requirement: Admin can batch-reparent and reorder organisations atomically

The backend SHALL expose `PATCH /admin/organisations/tree` (admin-only,
`# AUTH-HARDEN`-marked) accepting `OrganisationTreeUpdate { moves:
list[OrganisationTreeMove] }` where each move carries `id`,
`parent_organisation_id` (nullable, NULL = make root) and `sort_index`.
The endpoint SHALL apply all moves inside a single database transaction;
if any validation fails, no row SHALL be persisted.

The endpoint SHALL validate, for each move:

- the target organisation exists in the actor's tenant (else `404`),
- the proposed `parent_organisation_id` (if non-null) is an organisation
  in the same tenant (else `403` with
  `ErrorResponse{ code: "forbidden.organisation.cross_tenant" }`),
- the proposed graph contains no cycle — i.e. no moved node ends up as
  an ancestor of itself (else `409` with
  `ErrorResponse{ code: "organisation_tree_cycle" }`).

The endpoint SHALL stamp `updated_by` (actor) and `updated_at` (`now()`)
on every row it writes. The response SHALL be `200 OK` with the refreshed
tenant tree (same shape as `GET /organisations`).

The body SHALL enforce `1 ≤ len(moves) ≤ 500` at the schema level (else
`422`).

#### Scenario: Single reparent succeeds atomically

- **WHEN** an admin PATCHes `/admin/organisations/tree` with one move
  setting an org's `parent_organisation_id` to another existing in-tenant
  org and a new `sort_index`
- **THEN** the response is `200 OK`, the response body contains the moved
  org with the updated parent + sort_index, and a follow-up
  `GET /organisations` MUST reflect the same parent + ordering

#### Scenario: Cycle move rejected without partial write

- **WHEN** an admin PATCHes `/admin/organisations/tree` with moves that
  would make node `A` a descendant of itself (e.g. set the current parent
  of `A`'s child as `A`'s parent in the same call)
- **THEN** the response is `409 Conflict` with
  `ErrorResponse{ code: "organisation_tree_cycle" }`, and no row from the
  request body MUST have been modified

#### Scenario: Cross-tenant parent rejected without partial write

- **WHEN** an admin PATCHes `/admin/organisations/tree` with a move whose
  `parent_organisation_id` references an organisation in a different
  tenant
- **THEN** the response is `403 Forbidden` with
  `ErrorResponse{ code: "forbidden.organisation.cross_tenant" }`, and no
  row from the request body MUST have been modified

#### Scenario: Sibling reorder updates only sort_index

- **WHEN** an admin PATCHes `/admin/organisations/tree` with moves that
  keep `parent_organisation_id` unchanged and only renumber `sort_index`
  on three siblings
- **THEN** the response is `200 OK`, the three rows return with the new
  `sort_index` values, and their `parent_organisation_id` MUST be
  unchanged

#### Scenario: Empty moves array rejected

- **WHEN** an admin PATCHes `/admin/organisations/tree` with
  `moves: []`
- **THEN** the response is `422 Unprocessable Entity`

#### Scenario: Caregiver session forbidden

- **WHEN** a caregiver PATCHes `/admin/organisations/tree` with a valid
  body
- **THEN** the response is `403 Forbidden` and no row MUST be modified

