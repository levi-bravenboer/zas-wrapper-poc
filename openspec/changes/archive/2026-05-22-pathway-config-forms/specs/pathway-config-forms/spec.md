# pathway-config-forms Specification

## ADDED Requirements

### Requirement: Block inspector renders bespoke form per semantics

The pathway builder drawer SHALL render a bespoke inspector component per `BlockSemantics`. Authors SHALL be able to configure every block type from the eight-semantics roster (`appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`) without leaving the builder. The drawer SHALL NOT render the "Geen inspector beschikbaar" placeholder branch.

#### Scenario: Form block inspector edits the questions list

- **GIVEN** an open builder with a block of `semantics === 'form'` selected
- **WHEN** the user clicks "Add question" inside the inspector
- **THEN** a new question with a generated `id`, default `type='text'`, empty `label`, and `required=false` is appended to `block.config.questions`
- **AND** the builder state's autosave-dirty flag flips on

#### Scenario: Wait block inspector requires a valid event_type

- **GIVEN** an open builder with a block of `semantics === 'wait'` selected
- **THEN** the inspector renders an `event_type` select limited to `pathology_report`, `scan_report`, `lab_result`, `external_data`
- **AND** selecting one dispatches a `patch-block` with `config.event_type` set to the chosen value

#### Scenario: Pathway-link inspector picks a target pathway

- **GIVEN** an open builder with a block of `semantics === 'pathway_link'` selected
- **AND** at least one other pathway exists in the tenant
- **THEN** the inspector renders a select listing other pathways by `name`
- **AND** picking one dispatches a `patch-block` with `config.target_pathway_id` set to that pathway's UUID

### Requirement: Block inspector consumes parsed config

Inspector components SHALL receive their config as a typed, Zod-parsed object — never as `Record<string, unknown>`. The parser SHALL key on `block_type.semantics`, not on a discriminator field inside `config`. When the parse fails, the inspector SHALL render an error banner with the Zod error message and a "Reset to default" control that dispatches a `patch-block` with the schema's default value.

#### Scenario: Inspector for valid config renders form fields, not error banner

- **GIVEN** a block whose `config` parses cleanly under the schema for its semantics
- **THEN** the inspector renders its field controls
- **AND** no `role="alert"` element appears in the drawer

#### Scenario: Inspector for invalid config renders error banner with reset

- **GIVEN** a block whose `config` does NOT parse under the schema for its semantics
- **THEN** the inspector renders a `role="alert"` element containing the Zod error message
- **AND** the alert contains a button that, when clicked, dispatches a `patch-block` setting `config` to the schema's default value

### Requirement: Edge inspector lets authors pick a timing kind and its fields

When the builder selection is `{ kind: 'edge', edgeId }`, the drawer slot SHALL render an `EdgeInspector` instead of the block drawer. The inspector SHALL expose a kind picker over the four edge timing kinds (`completion`, `marker`, `immediate`, `branch`) and a per-kind sub-form.

#### Scenario: Edge inspector reflects current edge timing kind

- **GIVEN** a selected edge with `delay_value_id` set and `time_marker_id` / `source_branch_id` null
- **THEN** the inspector's kind picker shows `completion` as active
- **AND** the sub-form is the completion delay-value select

#### Scenario: Switching kind nulls the previous kind's columns

- **GIVEN** a selected edge with `delay_value_id` set
- **WHEN** the user picks `immediate` in the kind picker
- **THEN** the dispatched `patch-edge` action sets `delay_value_id`, `time_marker_id`, `offset_value_id`, `offset_direction_code`, and `source_branch_id` all to `null`

#### Scenario: Marker kind requires the complete triple

- **GIVEN** a selected edge currently in `immediate` kind
- **WHEN** the user picks `marker` and only the marker dropdown has been chosen
- **THEN** the `patch-edge` action MUST NOT be dispatched until the user also chooses an offset value and a direction
- **AND** when all three are chosen, the dispatched patch sets `time_marker_id`, `offset_value_id`, and `offset_direction_code` together while leaving `delay_value_id` and `source_branch_id` null

#### Scenario: Branch kind disabled when source block has no branches

- **GIVEN** a selected edge whose source block has zero `branches`
- **WHEN** the user picks `branch` in the kind picker
- **THEN** the sub-form renders a muted-disabled state with copy "Geen branches op bronblok"
- **AND** no `patch-edge` action is dispatched until branches exist

### Requirement: Builder reducer supports patching an edge

The builder state reducer SHALL accept a `{ type: 'patch-edge'; edgeId: string; patch: Partial<PathwayEdge> }` action that merges the patch into the matching edge and pushes a history snapshot. The undo action SHALL restore the prior edge state.

#### Scenario: patch-edge updates a single edge and pushes history

- **GIVEN** a builder state with edges `[E1, E2]` and an empty undo stack
- **WHEN** a `patch-edge` action is dispatched with `edgeId === E1.id` and a non-empty patch
- **THEN** the resulting state's `version.edges` contains the patched `E1` and an unchanged `E2`
- **AND** `history.past.length` increased by one

#### Scenario: Undo after patch-edge restores prior edge

- **GIVEN** the post-patch state from the previous scenario
- **WHEN** an `undo` action is dispatched
- **THEN** the resulting state's `version.edges` contains the original (pre-patch) `E1` and the unchanged `E2`

### Requirement: Per-semantic Zod schemas govern config shape on the client

The frontend SHALL define one Zod schema per `BlockSemantics`. The lookup function `parseBlockConfig(block, semantics)` SHALL parse `block.config ?? {}` against the schema for the given semantics and return either a typed object or throw a `ZodError`. The `asString` / `asArray` runtime-narrowing shims in `blockCatalogue.utils.ts` SHALL be removed.

#### Scenario: Form schema parses a valid config

- **GIVEN** a block with `semantics === 'form'` and a `config.questions` array of well-formed questions
- **WHEN** `parseBlockConfig(block, 'form')` is called
- **THEN** the result is a typed object whose `questions` is a same-length array of typed questions

#### Scenario: Wait schema rejects an unknown event_type

- **GIVEN** a block with `semantics === 'wait'` and `config.event_type === 'mystery_event'`
- **WHEN** `parseBlockConfig(block, 'wait')` is called
- **THEN** it throws a `ZodError` identifying `event_type` as the offending path
