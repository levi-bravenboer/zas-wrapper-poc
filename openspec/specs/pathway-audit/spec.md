# pathway-audit Specification

## Purpose
TBD - created by archiving change pathway-audit. Update Purpose after archive.
## Requirements
### Requirement: Pathway authoring lifecycle is audited via semantic domain events

The pathway service SHALL emit an append-only `AuditEvent` for each meaningful care pathway authoring action through explicit service-layer calls, NOT through the `before_flush` auto-diff hook. Pathway ORM models SHALL remain non-`__audited__` so no row-level diff events are produced. Every emitted event SHALL record the acting user as actor (`actor_type = user`, with `actor_id`, `actor_label`, and `tenant_id` taken from the session user) and SHALL carry a `context.operation` discriminator. The action verb and operation per authoring method:

| Service method | `action` | `context.operation` |
| --- | --- | --- |
| `PathwayService.create_empty` | `created` | `create` |
| `PathwayService.replace_definition` | `updated` | `edit` (coalesced — see session requirement) |
| `PathwayVersionService.publish` | `published` | _(none)_ |
| `PathwayService.duplicate` | `created` | `duplicate` |
| `PathwayVersionService.restore` | `created` | `restore` |
| `PathwayVersionService.fork_from_publish` | `created` | `fork` |
| `PathwayService.soft_delete` | `deleted` | `delete` |

These events SHALL be headline-only: the `changes` column SHALL remain empty (no field-level diff); human-readable context lives in `version_no`, `label`, and `operation`.

#### Scenario: Creating a pathway emits a created event

- **WHEN** a user creates a new pathway via `create_empty`
- **THEN** one `AuditEvent` is recorded with `action = created`, `context.operation = "create"`, `context.version_no = 1`, the acting user as actor, and an empty `changes` column

#### Scenario: Publishing a version emits a published event

- **WHEN** a user publishes a concept version
- **THEN** one `AuditEvent` is recorded with `action = published`, no `context.operation`, and `context.version_no` / `context.version_id` / `context.label` / `context.note` from the publish

#### Scenario: Duplicating a pathway emits a created event on the new pathway

- **WHEN** a user duplicates pathway A into a new pathway B
- **THEN** one `AuditEvent` is recorded with `action = created`, `context.operation = "duplicate"`, anchored to pathway **B**, carrying `context.source_pathway_id = A` and `context.source_version_id`

#### Scenario: Restoring or forking a version emits a created event

- **WHEN** a user restores any version, or forks a published version, into a new concept
- **THEN** one `AuditEvent` is recorded with `action = created` and `context.operation = "restore"` (restore) or `"fork"` (fork-from-publish), carrying the new `context.version_no` and the `context.source_version_id`

#### Scenario: Deleting a pathway emits a deleted event

- **WHEN** a user soft-deletes a pathway
- **THEN** one `AuditEvent` is recorded with `action = deleted` and `context.operation = "delete"`

### Requirement: Pathway access changes are audited with an added/removed diff

The scoping service SHALL emit an append-only `AuditEvent` when a pathway's access configuration changes through the bulk replace-set endpoints. Both events use `action = updated`, anchor to the Pathway (`resource_type = "Pathway"`, `resource_id = pathway_id`), and carry a `context.operation` discriminator plus the change diff:

| Service method | `context.operation` | `context` diff |
| --- | --- | --- |
| `ScopingService.set_pathway_specialisms` | `scope_specialisms` | `added` / `removed` specialism ids |
| `ScopingService.set_pathway_practitioners` | `assign_practitioners` | `added` / `removed` user ids |

These two events are the deliberate exception to the headline-only rule: because *who gained or lost access* is the substance of a permission change — and the diff is small, bounded, and already computed by the replace-set logic — the `added` and `removed` id lists SHALL be recorded in `context`. A save that changes nothing (empty `added` and `removed`) SHALL NOT emit an event. These events SHALL NOT be coalesced (each deliberate admin save is its own event).

#### Scenario: Granting access emits an updated event with the diff

- **WHEN** an admin sets a pathway's practitioners to a set that adds two users and removes one
- **THEN** one `AuditEvent` is recorded with `action = updated`, `context.operation = "assign_practitioners"`, anchored to the pathway, with the two added user ids in `context.added` and the removed user id in `context.removed`

#### Scenario: Scoping specialisms emits an updated event with the diff

- **WHEN** an admin changes a pathway's scoped specialisms
- **THEN** one `AuditEvent` is recorded with `action = updated`, `context.operation = "scope_specialisms"`, anchored to the pathway, carrying the `added` / `removed` specialism ids

#### Scenario: A no-op access save records nothing

- **WHEN** an admin re-saves a pathway's access set with no net change (the desired set equals the current set)
- **THEN** no `AuditEvent` is recorded

#### Scenario: Access changes appear in the pathway's timeline

- **WHEN** an admin queries `resource_type = "Pathway"` and `resource_id = <pathway id>`
- **THEN** the access-change events appear interleaved with the authoring events (create / edit / publish) in `created_at` order

### Requirement: Pathway authoring events anchor to the Pathway

Every pathway authoring event SHALL set `resource_type = "Pathway"` and `resource_id` to the pathway's id, with version and source identifiers carried in `context` (never as the anchor). For a duplicate, the anchor SHALL be the newly created pathway. This guarantees a care path's entire authoring history is retrievable as a single `resource_type = Pathway` + `resource_id` query ordered by `created_at`.

#### Scenario: A pathway's full history is one query

- **WHEN** an admin queries `resource_type = "Pathway"` and `resource_id = <pathway id>`
- **THEN** the result contains that pathway's created, edited, published, forked, and deleted events in `created_at` order, with version details available in each event's `context`

#### Scenario: Publish anchors to the Pathway, not the version

- **WHEN** a version is published
- **THEN** the event's `resource_type` is `"Pathway"` and `resource_id` is the pathway id, while `version_id` and `version_no` appear only in `context`

### Requirement: Draft edits coalesce to one event per editing session

Because the builder's save endpoint (`replace_definition`) fires repeatedly via debounced autosave, `replace_definition` SHALL emit at most one `edited` event (`action = updated`, `context.operation = "edit"`) per editing session. Before emitting, it SHALL look up the most recent audit event for the pathway and SHALL suppress a new `edited` event when that latest event is itself an `edited` event by the **same actor** within a quiet window (a named constant, default 15 minutes). It SHALL emit a fresh `edited` event when the window has elapsed, when a **different actor** edits, or when an intervening lifecycle event (e.g. publish, fork) has occurred since the last edit.

#### Scenario: Rapid autosaves collapse to one event

- **WHEN** the same user triggers several autosaves of the same draft within the quiet window with no intervening lifecycle event
- **THEN** exactly one `edited` event is recorded for that session

#### Scenario: Editing after the quiet window starts a new session

- **WHEN** the same user edits the draft again after the quiet window has elapsed since the last `edited` event
- **THEN** a new `edited` event is recorded

#### Scenario: A different editor starts a new session

- **WHEN** a different user edits the draft while the previous user's `edited` event is still within the quiet window
- **THEN** a new `edited` event is recorded for the new actor (surfacing the handoff)

#### Scenario: An intervening lifecycle event resets the session

- **WHEN** the draft is published (or forked) and then edited again within the quiet window
- **THEN** a new `edited` event is recorded rather than being suppressed

### Requirement: Authoring events are atomic with the change

Pathway authoring events SHALL be emitted in-band — the `AuditEvent` is added to the same request session/transaction as the mutation, so the event commits if and only if the mutation commits. A rolled-back authoring operation SHALL leave no audit event. (This is the opposite guarantee from authentication events, which use a separate committed session to survive request rollback.)

#### Scenario: Rolled-back publish leaves no event

- **WHEN** a publish operation raises and the request transaction rolls back
- **THEN** no `published` audit event exists for that attempt

#### Scenario: Committed authoring action persists its event

- **WHEN** an authoring operation commits successfully
- **THEN** its audit event is present in the same committed transaction

### Requirement: Pathway authoring trail is queryable through the existing audit read API

The pathway authoring trail SHALL be served by the existing admin-only `GET /audit-events` API with no new endpoint and no new filter capability in v1. The new `published` verb SHALL be a valid `action` filter value. `context.operation` SHALL be display-only and SHALL NOT be server-side filterable in v1; distinguishing the create-flavoured operations (`create` / `duplicate` / `restore` / `fork`) requires client-side inspection of the returned `context`.

#### Scenario: Admin filters all publishes

- **WHEN** an admin filters `GET /audit-events` by `action = published`
- **THEN** all publish events (across pathways) are returned, paginated and ordered

#### Scenario: Operation is not a server-side filter

- **WHEN** a client wants only `duplicate` events
- **THEN** the API offers no `context.operation` filter; the client filters `action = created` results by `context.operation` itself (documented v1 limitation)

