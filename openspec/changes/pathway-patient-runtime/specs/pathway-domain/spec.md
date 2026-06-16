## MODIFIED Requirements

### Requirement: Block-type catalogue

The backend SHALL expose `GET /pathways/blocks` returning the registry of available block types. Each entry SHALL include a stable `type` identifier (kebab-case), a human-readable `label`, a `default_lane_kind_code` (one of the seeded `pathway_lane_kind.code` values), and a JSON schema (`config_schema`) describing the block's configuration fields. The catalogue inlines the lane-kind `code` rather than a UUID FK so the orchestrator does not need a second round-trip. The registry SHALL include `start`, `end_pathway`, `appointment`, `treatment`, `mdo`, `task`, `decision`, `form`, `message`, `informed_consent`, `external_program`, and `pathway_link`. It SHALL NOT include `milestone` or `wait` (removed — see REMOVED Requirements). `task` SHALL be caregiver-lane only. The catalogue is owned by the backend; the orchestrator SHALL NOT hardcode block names or config shapes.

#### Scenario: Catalogue lists the current block types

- **WHEN** a client calls `GET /pathways/blocks`
- **THEN** the response includes entries for `task`, `appointment`, `treatment`, `mdo`, `decision`, `form`, `message`, `informed_consent`, `external_program`, and `pathway_link`
- **AND** it does NOT include `milestone` or `wait`
- **AND** each entry carries a `type`, `label`, `default_lane_kind_code`, and `config_schema`

#### Scenario: task is caregiver-lane only

- **WHEN** the `task` catalogue entry is inspected
- **THEN** its allowed lane kinds are caregiver only (no patient lane)

#### Scenario: Pathway blocks validated against catalogue

- **WHEN** a client submits a pathway containing a block whose `type` is not present in the catalogue
- **THEN** the backend rejects the request with a 422 validation error citing the unknown block type

#### Scenario: Block config validated against per-type schema

- **WHEN** a client submits a block whose `config` does not conform to the block type's `config_schema`
- **THEN** the backend rejects the request with a 422 validation error citing the offending field path

## ADDED Requirements

### Requirement: Each block field has a supply phase (build / enroll / runtime)

Every block field SHALL be classified by the phase at which its value is supplied: **build** (authored on the template in the builder), **enroll** (a deferred field supplied per patient at enrollment), or **runtime** (produced while the execution runs, stored on `BlockExecution.result_json`). The block model SHALL expose this classification so the builder authors build fields, the enroll form prompts for enroll fields, and the runtime captures runtime fields. A field marked deferred at build time becomes an enroll field; `decision.outputs` authored at build enumerate the runtime branch choices.

#### Scenario: Appointment fields split across phases

- **WHEN** the `appointment` block contract is inspected
- **THEN** `mode`/`duration`/`title` are build fields, `location` is an optional enroll field, and `scheduled_at`/`performed_at` are runtime fields

#### Scenario: Enroll form is derived from enroll-phase fields

- **WHEN** a pathway version's enroll descriptor is requested
- **THEN** it lists exactly the enroll-phase (deferred) fields across the version's blocks

### Requirement: Each block declares a runtime contract

Every non-system block SHALL declare a runtime contract: its **actor** (system / caregiver / patient / external), the **work primitive** it materializes (`Appointment` for `appointment`/`treatment`/`mdo`; a `pathway`-source to-do for `task`; a Luscii program enrollment for `external_program`; a mock logged send for `message`), the typed **result** it exposes (if any), and how it **completes**. `start` and `end_pathway` are system blocks that materialize no primitive.

#### Scenario: Appointment-backed contract

- **WHEN** the `treatment` block contract is inspected
- **THEN** actor is caregiver, the primitive is an `Appointment` (kind `procedure`), and the result is `{performed_at, notes, complications}` on the execution

#### Scenario: Mock message contract

- **WHEN** the `message` block contract is inspected
- **THEN** actor is patient, the primitive is a mock logged send (audit/event only, no delivery), and it auto-completes on its timing with no typed result

### Requirement: Materializing blocks reference a care-team role-type

A block that materializes a work primitive (`appointment`/`treatment`/`mdo`/`task`) SHALL reference a **care-role code** from the shared FHIR-aligned value set (`role_in_care` / `PractitionerRole`) that `CareTeam.participant` already uses — no new role-type entity. The role reference is a **build-phase** declaration; choosing the actual caregiver(s) is **enroll-phase** (one or several per block — `mdo` takes multiple); the resulting participant(s)/assignee is **runtime**. The same role-type MAY be referenced by many blocks.

#### Scenario: Block references a care-team role-type

- **WHEN** an `mdo` block is authored
- **THEN** it references a care-team role-type, for which the caregiver chooses participant(s) at enrollment

#### Scenario: Role-types are derivable for the enroll form

- **WHEN** a pathway version's enroll descriptor is requested
- **THEN** it lists, per block, the care-team role-type(s) needing caregiver choice — over the fully-flattened (subpath-inlined) block set

### Requirement: Blocks may declare clinical-date timing constraints

The domain SHALL support a pathway declaring **named clinical dates** (e.g. `operation_date`). A block MAY carry a **min-lead-time** to a named date (`≥ N days before <date>`) and/or a `timing_policy` keyed off a named date including forward offsets (`<date> − N days`); these constraints SHALL be build-phase, while the date value is enroll-phase (suggested earliest-feasible, editable).

#### Scenario: Block declares a min-lead-time

- **WHEN** a pre-op block is authored with "≥ 7 days before operation_date"
- **THEN** the earliest-feasible `operation_date` suggestion at enroll accounts for that lead time

### Requirement: Trigger predicates are validated against upstream runtime contracts

`input_logic` predicates connect blocks based on upstream runtime output. At publish time the system SHALL reject (422) any predicate whose referenced block + output/result-field is not exposed by that block's runtime contract: `DECISION_OUTPUT` MUST reference an existing output of a `decision` block; `HAS_DATA` / `VALUE_EQUALS` / `VALUE_GT` MUST reference a result field that the upstream block produces (real-result blocks only — never a fake-log block); `IF_DONE` / `WAIT_AFTER` / `IF_NOT_DONE_WITHIN` may reference any block. The supported aggregators are `all_of` and `any_of` (with optional `n_of_m`).

#### Scenario: Data predicate on a fake-log block is rejected

- **WHEN** a pathway is published with a `VALUE_EQUALS` predicate referencing a `form` block's answer
- **THEN** publish is rejected with a 422 — a fake-log block exposes no runtime result to gate on

#### Scenario: Decision-output predicate must reference a real output

- **WHEN** a `DECISION_OUTPUT` predicate references an output key not declared on the target `decision` block
- **THEN** publish is rejected with a 422 citing the unknown output

#### Scenario: Completion/timing predicates accept any block

- **WHEN** an `IF_DONE` or `WAIT_AFTER` predicate references any upstream block
- **THEN** publish accepts it regardless of whether that block exposes a typed result

## REMOVED Requirements

### Requirement: Milestone and wait block kinds

**Reason**: `milestone` is redundant with phases; `wait` is replaced by per-block relative `timing_policy` (delays are authored on the dependent block, not as a standalone block).

**Migration**: Re-author PoC pathways without `milestone`/`wait`; express former `wait` delays as `timing_policy` (`wait_after`/offset) on the following block. A migration drops the `milestone` and `wait` block kinds. No live enrollments exist to migrate.
