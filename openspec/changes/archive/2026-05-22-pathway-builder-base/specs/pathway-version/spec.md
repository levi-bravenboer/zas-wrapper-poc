## ADDED Requirements

### Requirement: Pathway-version table and lifecycle

The backend SHALL persist every editable revision of a pathway as a `pathway_version` row. Each row SHALL carry:

- `id` — UUID PK from `Entity`.
- `pathway_id` — FK to `pathway`, `ON DELETE CASCADE`.
- `version_no` — int, server-assigned, monotonically increasing per pathway starting at 1.
- `status` — enum `concept | published | archived`. Lifecycle transitions are exactly `concept → published` (one-way, see "Publish operation"); `archived` is reserved for future use and SHALL NOT be reachable in PoC.
- `kind` — enum `initial | fork-from-publish | restore-from-version`. Records how the row came into existence. The first version of every pathway is `initial`. There SHALL NOT be a `checkpoint` kind (per `design.md` D37 — concept is one continuous WIP, only publish snapshots).
- `derived_from_version_id` — nullable self-FK to `pathway_version`, `ON DELETE SET NULL`. Populated on `fork-from-publish` and `restore-from-version` rows; NULL on `initial` rows.
- `label` — nullable string, max 120 chars, captured at publish time only (see "Publish operation").
- `note` — nullable text, max 2000 chars, captured at publish time only.
- `published_at` — nullable timestamptz; non-null iff `status = published`.
- `published_by` — nullable FK to `user`; non-null iff `status = published`.
- Audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`) inherited from `TenantOwnedEntity`.

The table SHALL declare `UNIQUE (pathway_id, version_no)`.

#### Scenario: Initial version created with the pathway

- **WHEN** a client `POST`s `/pathways` with a name
- **THEN** the backend inserts one `pathway` row and one `pathway_version` row with `version_no = 1`, `status = 'concept'`, `kind = 'initial'`, `derived_from_version_id = NULL`

#### Scenario: Lifecycle transition is one-way

- **WHEN** the backend receives any request that would mutate a `pathway_version` row's `status` from `published` back to `concept`
- **THEN** the backend rejects the request with 409 and machine-readable error code `pathway_version_immutable`

### Requirement: One concept per pathway

The backend SHALL enforce at most one `pathway_version` row per pathway with `status = 'concept'` via a partial unique index `pathway_version (pathway_id) WHERE status = 'concept' AND deleted_at IS NULL`. Operations that would create a second concept (restore, fork-from-publish, manual insert) SHALL be rejected with 409 and machine-readable error code `concept_already_exists`.

#### Scenario: Restore rejected while concept exists

- **GIVEN** a pathway with one `concept` version (v.3) and one `published` version (v.2)
- **WHEN** a client `POST`s `/pathways/{id}/versions/{v2}/restore`
- **THEN** the backend rejects with 409 and JSON body `{ "code": "concept_already_exists", "concept_version_id": "<v.3.id>" }`

#### Scenario: Partial index prevents double-insert at the database

- **WHEN** two concurrent transactions each attempt to insert a `pathway_version` row with the same `pathway_id` and `status = 'concept'`
- **THEN** exactly one transaction commits and the other fails on the partial unique index

### Requirement: Concept autosave on PUT

The backend SHALL accept structural mutations of a pathway only against its current concept version. `PUT /pathways/{id}` SHALL resolve to the pathway's current `concept` version and apply the replacement to that version's child rows (phases, lanes, blocks, edges, branches, time markers). If no `concept` version exists for the pathway, the endpoint SHALL reject with 409 and machine-readable error code `no_concept_version` — the frontend is responsible for first calling restore or fork-from-publish to materialise a concept (see `pathway-builder` capability, fork-on-edit flow).

#### Scenario: PUT routes to the current concept

- **GIVEN** a pathway with `concept` v.3 and `published` v.2
- **WHEN** a client `PUT`s `/pathways/{id}` with an updated definition
- **THEN** child rows for `pathway_version_id = v.3.id` are replaced wholesale
- **AND** child rows for v.2 are untouched

#### Scenario: PUT against a pathway with no concept is rejected

- **GIVEN** a pathway whose only version is `published` v.2
- **WHEN** a client `PUT`s `/pathways/{id}`
- **THEN** the backend rejects with 409 and JSON body `{ "code": "no_concept_version" }`

### Requirement: Published versions are immutable

Once `pathway_version.status = 'published'`, the backend SHALL reject any mutation targeting that version's row OR any of its structural children (`pathway_phase`, `pathway_lane`, `pathway_block`, `pathway_edge`, `pathway_block_branch`, `pathway_time_marker`, `pathway_block_deferred_field`). Rejection SHALL be 409 with machine-readable error code `pathway_version_immutable`. `label`, `note`, `published_at`, `published_by` SHALL also be immutable post-publish.

#### Scenario: Direct child mutation on published version rejected

- **GIVEN** a `published` version v.2 with a block B
- **WHEN** a client attempts to update block B's `config` via any endpoint that resolves to v.2
- **THEN** the backend rejects with 409 and JSON body `{ "code": "pathway_version_immutable", "version_id": "<v.2.id>" }`

### Requirement: Publish operation

The backend SHALL expose `POST /pathways/{id}/publish` to promote the current `concept` version to `published`. The endpoint SHALL accept:

- `label` — optional string, max 120 chars.
- `note` — optional string, max 2000 chars.
- `clinically_approved` — required boolean. The endpoint SHALL reject with 422 when this field is missing or `false`.

On success the backend SHALL, in a single transaction: flip `status` from `concept` to `published`, set `published_at = now()`, set `published_by = current user id`, persist `label` and `note` as provided. No new `pathway_version` row is created — the same row's `status` flips. The endpoint SHALL reject with 409 and machine-readable code `no_concept_version` when no concept exists.

#### Scenario: Publish promotes the concept in place

- **GIVEN** a pathway with `concept` v.3
- **WHEN** a client `POST`s `/pathways/{id}/publish` with `{ label: "Post-MDR-update", note: "Updated dose guard", clinically_approved: true }`
- **THEN** v.3's row transitions to `status = 'published'`, `published_at`/`published_by`/`label`/`note` set
- **AND** no new `pathway_version` row exists
- **AND** the response returns the updated version summary

#### Scenario: Publish without acknowledgement is rejected

- **WHEN** a client `POST`s `/pathways/{id}/publish` with `{ clinically_approved: false }` (or the field omitted)
- **THEN** the backend rejects with 422 citing the `clinically_approved` field

#### Scenario: Label and note are optional

- **WHEN** a client `POST`s `/pathways/{id}/publish` with `{ clinically_approved: true }` and no `label`/`note`
- **THEN** the publish succeeds with `label = NULL` and `note = NULL` on the persisted row

### Requirement: Restore creates a new concept from any version

The backend SHALL expose `POST /pathways/{id}/versions/{versionId}/restore` to create a new `concept` version whose snapshot is a deep copy of `{versionId}`'s child rows. The new row SHALL have:

- `version_no = max(version_no) + 1` for the pathway.
- `status = 'concept'`.
- `kind = 'restore-from-version'`.
- `derived_from_version_id = {versionId}`.
- `label = NULL`, `note = NULL`, `published_at = NULL`, `published_by = NULL`.

The endpoint SHALL reject with 409 and machine-readable code `concept_already_exists` when a concept already exists for the pathway (see "One concept per pathway"). The original `{versionId}` row SHALL NOT be modified — restore is non-destructive.

#### Scenario: Restore copies structural children to a new concept

- **GIVEN** a pathway with only `published` versions v.1 and v.2 (v.2 has 5 blocks)
- **WHEN** a client `POST`s `/pathways/{id}/versions/{v2.id}/restore`
- **THEN** a new `pathway_version` row is created with `version_no = 3`, `status = 'concept'`, `kind = 'restore-from-version'`, `derived_from_version_id = v.2.id`
- **AND** 5 new `pathway_block` rows exist with `pathway_version_id = v.3.id` mirroring v.2's blocks
- **AND** v.2's block rows are unchanged

#### Scenario: Restore against any historical version is permitted

- **GIVEN** a pathway with `published` versions v.1, v.2, v.3 and no concept
- **WHEN** a client `POST`s `/pathways/{id}/versions/{v1.id}/restore`
- **THEN** the restore succeeds with the new concept derived from v.1, not v.3

### Requirement: Fork-from-publish endpoint

The backend SHALL expose `POST /pathways/{id}/versions/{versionId}/fork-from-publish` as a semantic alias of restore, used by the orchestrator's fork-on-edit flow (see `pathway-builder` capability). Behaviour is identical to restore EXCEPT the new concept row SHALL have `kind = 'fork-from-publish'` (drives the auto-label `Nieuw concept op v.{n}` in the Geschiedenis drawer). The `{versionId}` SHALL reference a `status = 'published'` version; the backend SHALL reject with 422 when it references a `concept` or `archived` version.

#### Scenario: Fork-from-publish requires a published source

- **WHEN** a client `POST`s `/pathways/{id}/versions/{conceptId}/fork-from-publish` where `{conceptId}` references a `concept` version
- **THEN** the backend rejects with 422 citing that the source must be `published`

#### Scenario: Fork-from-publish records kind correctly

- **WHEN** a client `POST`s `/pathways/{id}/versions/{v2.id}/fork-from-publish` (v.2 is `published`, no concept exists)
- **THEN** a new `pathway_version` row is created with `kind = 'fork-from-publish'`, `derived_from_version_id = v.2.id`

### Requirement: Version listing and detail endpoints

The backend SHALL expose:

- `GET /pathways/{id}/versions` — returns an array of `PathwayVersionSummary` reverse-chronological by `version_no`. Summary fields: `id`, `version_no`, `status`, `kind`, `label`, `note`, `derived_from_version_id`, `created_at`, `created_by` (id + name), `published_at`, `published_by` (id + name when present).
- `GET /pathways/{id}/versions/{versionId}` — returns the full pathway definition snapshot for `{versionId}` (phases, lanes, blocks, edges, branches, time markers, deferred fields). Returns 404 when `{versionId}` does not belong to `{pathwayId}`.

Both endpoints SHALL be tenant-scoped — versions of pathways outside the caller's tenant SHALL return 404, not 403.

#### Scenario: Version list ordering

- **GIVEN** a pathway with versions v.1, v.2, v.3
- **WHEN** a client calls `GET /pathways/{id}/versions`
- **THEN** the response array is `[v.3, v.2, v.1]`

#### Scenario: Version detail respects pathway scope

- **WHEN** a client calls `GET /pathways/{pathwayA}/versions/{versionB.id}` where `{versionB.id}` belongs to a different pathway
- **THEN** the backend returns 404

### Requirement: Hybrid version resolution on bare detail endpoint

The backend SHALL make `GET /pathways/{id}` return `{ pathway, version }` where `version` is the **resolved** version using this rule: the pathway's current `concept` version if one exists; otherwise the pathway's latest `published` version (by `published_at DESC`). The response SHALL embed `version.status` so the frontend can decide read-only chrome (per `pathway-builder` Hybrid version route resolution). When the pathway has no version of any kind, the endpoint SHALL return 404 (an impossible state — every pathway has at least the `initial` row — but specified as a backstop). The frontend MAY navigate `/pathways/{id}/v/{versionId}` to pin a specific historical version, served by the version detail endpoint above.

#### Scenario: Bare GET resolves to concept when one exists

- **GIVEN** a pathway with `concept` v.3 and `published` v.2
- **WHEN** a client calls `GET /pathways/{id}`
- **THEN** the response `version` is v.3 with `status = 'concept'`

#### Scenario: Bare GET falls back to latest published when no concept exists

- **GIVEN** a pathway with `published` versions v.1 and v.2 and no concept
- **WHEN** a client calls `GET /pathways/{id}`
- **THEN** the response `version` is v.2 with `status = 'published'`

### Requirement: Structural children belong to a version

The structural child tables (`pathway_phase`, `pathway_lane`, `pathway_block`, `pathway_edge`, `pathway_block_branch`, `pathway_time_marker`, `pathway_block_deferred_field`) SHALL FK to `pathway_version_id` (NOT `pathway_id`) with `ON DELETE CASCADE`. The `pathway_version` row owns the snapshot; deleting a version cascade-removes its children. The `pathway` row holds only identity and ownership fields: `id`, `tenant_id`, `name`, `clinical_goal`, `patient_goal`, `owner_id`, `archived_at`, plus inherited audit columns. Per-version uniqueness constraints SHALL be scoped to `pathway_version_id` (e.g. `UNIQUE (pathway_version_id, ord)` on `pathway_phase` and `pathway_lane`; `UNIQUE (source_block_id, target_block_id, source_branch_id) NULLS NOT DISTINCT` on `pathway_edge` is already scoped via the block FK chain).

#### Scenario: Two versions hold independent child sets

- **GIVEN** a pathway with `published` v.1 (3 blocks) and `concept` v.2 (5 blocks, derived from v.1)
- **WHEN** a client calls `GET /pathways/{id}/versions/{v1.id}` then `GET /pathways/{id}/versions/{v2.id}`
- **THEN** the first response contains 3 blocks and the second contains 5 blocks
- **AND** mutating a v.2 block does not affect v.1's blocks

#### Scenario: Cascading delete removes a version's children only

- **WHEN** version v.2 of a pathway is hard-deleted (administrative action)
- **THEN** all `pathway_block`, `pathway_edge`, `pathway_phase`, etc. rows with `pathway_version_id = v.2.id` are removed
- **AND** rows belonging to other versions of the same pathway are unaffected

### Requirement: Pathway-level rollups are derived

The backend SHALL compute pathway-level summary fields (`latest_published_version_id`, `latest_published_version_no`, `latest_published_at`, `has_concept`, `concept_version_id`, `block_count`, `last_edited_at`) from `pathway_version` and `pathway_block` at query time. The overview endpoint `GET /pathways` SHALL NOT read denormalised columns on `pathway` for these fields. To keep the derived query fast, the following indexes SHALL exist:

- `pathway_version (pathway_id, status, published_at DESC)` — drives the "latest published per pathway" LATERAL subquery.
- `pathway_version (pathway_id) WHERE status = 'concept' AND deleted_at IS NULL` — also serves the `has_concept` lookup (same partial unique index used by "One concept per pathway").
- `pathway_block (pathway_version_id)` — drives the `block_count` aggregate.
- `pathway (tenant_id, deleted_at, updated_at DESC)` — overview list filter + ordering.

Migration to a hybrid shape (denormalise `latest_published_version_id` + `has_concept` onto `pathway`, kept transactionally consistent by publish/restore/fork-from-publish handlers) is permitted ONLY when a single tenant's overview latency exceeds ~200ms p95 (see `design.md` D45). Even after migration, `block_count` and `last_edited_at` SHALL remain derived so the autosave hot path never writes the `pathway` parent row.

#### Scenario: Overview summary reflects current version data without denormalised columns

- **GIVEN** a tenant with three pathways, each with one `published` version
- **WHEN** a client adds a fourth block to one of the pathways via autosave (PUT against the concept)
- **AND** a client calls `GET /pathways`
- **THEN** the overview row for the edited pathway reports the new `block_count` and `last_edited_at`
- **AND** the underlying `pathway` row's columns are unchanged

#### Scenario: Required indexes exist after migration

- **WHEN** the deployed schema is inspected after `alembic upgrade head`
- **THEN** the four indexes listed above are present with the specified columns and predicates
