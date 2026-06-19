# pathway-input-logic-and-timing Specification

## Purpose
TBD - created by archiving change pathway-input-logic-and-timing. Update Purpose after archive.
## Requirements
### Requirement: Block connectivity carried by input_logic, edge table dropped

Every `BaseBlock` SHALL carry an `input_logic: list[InputLogicRule]` field that names the prior blocks it depends on. The `pathway_edge` table SHALL be dropped. The canvas and topology APIs SHALL compute the edge list on read from each block's `input_logic`.

#### Scenario: Canvas edge list derived from input_logic

- **GIVEN** a pathway with block `B` whose `input_logic` references block `A` with `predicate="if_done"`
- **WHEN** a client requests the canvas edge list
- **THEN** the response includes an edge `{from: "A", to: "B", predicate: "if_done"}`
- **AND** no row exists in any `pathway_edge` table

#### Scenario: input_logic.node must resolve in same pathway version

- **GIVEN** a block whose `input_logic` names a `node` slug that does not exist in the same `PathwayVersion`
- **WHEN** publish is attempted
- **THEN** publish is rejected with `InputLogicNodeUnknownError` naming the bad reference

### Requirement: input_logic predicate vocabulary is a closed enum

`InputLogicRule.predicate` SHALL be a value of the closed `PredicateKind` enum: `if_done`, `has_data`, `value_equals`, `value_gt`, `wait_after`, `decision_output`. Each predicate has a typed `args` shape; unknown predicates SHALL be rejected at the API boundary. No expression language and no escape-hatch predicate SHALL be added.

#### Scenario: Unknown predicate rejected at write

- **WHEN** a client writes `input_logic` with a `predicate` value not in the `PredicateKind` enum
- **THEN** the API responds with HTTP 422
- **AND** the error payload names the unsupported predicate

#### Scenario: Predicate args typed per kind

- **GIVEN** `predicate="value_equals"` requires `args = {field: str, value: literal}`
- **WHEN** a client writes a `value_equals` rule with `args = {}`
- **THEN** the API responds with HTTP 422 indicating the missing typed args

### Requirement: TimingPolicy is a tagged union on the block template

Every `BaseBlock` SHALL carry a `timing_policy: TimingPolicy` value, where `TimingPolicy` is a closed tagged union: `FixedDurationPolicy`, `WaitAfterPolicy`, `DueWithinPolicy`, `AtEnrollmentPickedDatePolicy`. The template SHALL NOT carry `started_at`, `completed_at`, or other runtime fields — those live on `BlockExecution` (chain slot #3).

#### Scenario: TimingPolicy persisted as per-variant columns

- **WHEN** a block is written with `timing_policy = WaitAfterPolicy(offset="P5D")`
- **THEN** the row has `timing_policy_kind="wait_after"`, `timing_offset_iso="P5D"`, and the other timing columns NULL

#### Scenario: Template carries no runtime timing fields

- **WHEN** the read API returns a block payload
- **THEN** the payload does NOT include `started_at`, `completed_at`, `scheduled_at`, or `due_at` (those belong to `BlockExecution`)

### Requirement: DecisionBlock declares typed outputs; downstream refs validated

`DecisionBlock` SHALL declare an `outputs: tuple[str, ...]` of branch labels and a `mode: Literal["xor", "and"]` (default `"and"`). Downstream blocks SHALL reference a specific branch via `predicate="decision_output"` with `args.output_key` matching one of the producer's declared `outputs`. The publish-time validator SHALL reject references whose `output_key` is unknown on the named producer.

#### Scenario: Unknown decision output rejected at publish

- **GIVEN** `DecisionBlock` `D` declares `outputs = ("yes", "no")`
- **AND** downstream block `B` has `input_logic = [{node: "D", predicate: "decision_output", args: {output_key: "maybe"}}]`
- **WHEN** publish is attempted
- **THEN** publish is rejected with `DecisionOutputUnknownError` naming `D` and `maybe`

#### Scenario: AND-mode DecisionBlock fans out to all outputs

- **GIVEN** `DecisionBlock` `D` with `mode="and"` and `outputs=("path_a", "path_b")`
- **WHEN** `D` completes at runtime
- **THEN** both downstream blocks referencing `path_a` and `path_b` become eligible

