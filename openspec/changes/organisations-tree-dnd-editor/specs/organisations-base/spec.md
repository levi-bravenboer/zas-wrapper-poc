## ADDED Requirements

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
