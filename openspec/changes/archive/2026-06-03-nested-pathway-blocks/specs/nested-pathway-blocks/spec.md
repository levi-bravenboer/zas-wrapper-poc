## ADDED Requirements

### Requirement: Version-pin config on pathway_link blocks

A `pathway_link` block SHALL carry a `version_pin` field in its config, with values `'latest_published'` (default) or `'specific'`. When `version_pin='specific'`, the block SHALL also carry a non-null `pinned_version_id` matching an existing `pathway_version.id` of the target pathway.

#### Scenario: Default version_pin is latest_published

- **WHEN** a client submits a `pathway_link` block without `version_pin`
- **THEN** the persisted block has `version_pin='latest_published'` and `pinned_version_id=null`

#### Scenario: Specific version_pin requires pinned_version_id

- **WHEN** a client submits a `pathway_link` block with `version_pin='specific'` and null `pinned_version_id`
- **THEN** the server responds with HTTP 422
- **AND** the error payload identifies the missing `pinned_version_id`

#### Scenario: pinned_version_id must belong to the target pathway

- **WHEN** a client submits a `pathway_link` block with `version_pin='specific'`, `target_pathway_id=A`, and a `pinned_version_id` whose row belongs to pathway `B`
- **THEN** the server responds with HTTP 422
- **AND** the error indicates the version does not belong to the target pathway

### Requirement: Cycle guard on nested pathway links

The system SHALL reject a `pathway_link` whose `target_pathway_id` equals the parent pathway's id (direct self-reference) or appears in the parent's ancestor chain resolved by recursively walking `pathway_link` blocks from the parent up to a bounded depth of 8. The error code SHALL be `NestedPathwayCycleError`.

#### Scenario: Direct self-link rejected

- **GIVEN** a pathway with id `P`
- **WHEN** a client submits a `pathway_link` block within pathway `P` whose `target_pathway_id=P`
- **THEN** the server responds with HTTP 422 and error code `NestedPathwayCycleError`

#### Scenario: Indirect cycle through ancestor rejected

- **GIVEN** pathway `A` already contains a `pathway_link` to pathway `B`
- **WHEN** a client submits a `pathway_link` block within pathway `B` whose `target_pathway_id=A`
- **THEN** the server responds with HTTP 422 and error code `NestedPathwayCycleError`

#### Scenario: Distinct chain within depth bound is accepted

- **GIVEN** four distinct pathways `A → B → C → D` linked via `pathway_link` blocks
- **WHEN** a client submits a `pathway_link` block within pathway `D` whose `target_pathway_id=E` (a fifth distinct pathway)
- **THEN** the server responds with HTTP 200

### Requirement: Snapshot persists resolved child reference

When a parent pathway version is published, every `pathway_link` block in that version SHALL resolve and persist `snapshot_json` with the shape `{ "target_pathway_id": <uuid>, "resolved_version_id": <uuid>, "tracking": "specific" | "latest_published" }`. For `version_pin='specific'`, `resolved_version_id` equals the configured `pinned_version_id` and `tracking='specific'`. For `version_pin='latest_published'`, `resolved_version_id` equals the latest published version of the target pathway at snapshot time and `tracking='latest_published'`.

#### Scenario: Specific pin snapshots configured version

- **GIVEN** a `pathway_link` block with `version_pin='specific'`, `target_pathway_id=A`, `pinned_version_id=V1`
- **WHEN** the parent pathway version is published
- **THEN** the block's `snapshot_json.resolved_version_id` equals `V1` and `tracking='specific'`

#### Scenario: Latest_published pin snapshots latest at publish time

- **GIVEN** a `pathway_link` block with `version_pin='latest_published'`, `target_pathway_id=A`
- **AND** pathway `A` has `V2` as its latest published version at the moment of publish
- **WHEN** the parent pathway version is published
- **THEN** the block's `snapshot_json.resolved_version_id` equals `V2` and `tracking='latest_published'`

#### Scenario: Latest_published pin fails publish when target has no published version

- **GIVEN** a `pathway_link` block with `version_pin='latest_published'`, `target_pathway_id=A`
- **AND** pathway `A` has no published version
- **WHEN** the parent pathway publish is attempted
- **THEN** the server responds with HTTP 422
- **AND** the error identifies the unresolvable `pathway_link` block

### Requirement: Catalogue surfaces internal source on pathway_link

The pathway block-type catalogue entry for `pathway_link` SHALL include `source='internal'`, `provider='pathway'`, `kind='link'`, and a `nested_render` UI hint (`'inline_preview'` or `'collapsed_card'`). The `source` enum SHALL be the same field defined by `external-block-integrations` (extended to include `'internal'` alongside `'native'` and `'external'`).

#### Scenario: Catalogue entry tags pathway_link as internal

- **WHEN** a client calls `GET /pathway-block-types`
- **THEN** the entry with `type='pathway_link'` has `source='internal'`, `provider='pathway'`, `kind='link'`, and a `nested_render` value of either `'inline_preview'` or `'collapsed_card'`

### Requirement: Child summary endpoint for inspector

The API SHALL expose `GET /pathways/{id}/summary` returning `{ "id": uuid, "name": string, "lane_count": int, "block_count": int, "latest_published_version_id": uuid | null }`. The nested-pathway inspector SHALL call this endpoint to render a read-only summary of the linked child pathway.

#### Scenario: Summary returns counts and latest published id

- **GIVEN** a pathway `A` with 3 lanes, 12 blocks across versions, and published version `V2`
- **WHEN** a client calls `GET /pathways/A/summary`
- **THEN** the response is `{ "id": "A", "name": <string>, "lane_count": 3, "block_count": 12, "latest_published_version_id": "V2" }`

#### Scenario: Summary returns null published id when pathway has no published version

- **GIVEN** a pathway `B` with only draft versions
- **WHEN** a client calls `GET /pathways/B/summary`
- **THEN** the response has `latest_published_version_id=null`
