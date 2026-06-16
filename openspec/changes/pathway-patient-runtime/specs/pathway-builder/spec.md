## ADDED Requirements

### Requirement: Block inspector authors a FHIR participant (role + specialty)

The per-block configuration editor SHALL let the author declare the FHIR `action.participant` for each materializing block (`appointment`/`treatment`/`mdo`/`task`): a **role code** (`CareTeam.participant.role` / `PractitionerRole.code`) and an **optional specialty** (`PractitionerRole.specialty` / `Specialism`). This is what enrollment resolves to an actual `Practitioner`.

#### Scenario: Author sets role + specialty on an MDO block

- **WHEN** the author opens the `mdo` block inspector
- **THEN** they can select a role code and optional specialty; the saved block carries that participant spec for enrollment to resolve

### Requirement: Builder authors named clinical dates and timing constraints

The builder SHALL let the author declare **named clinical dates** on a pathway (e.g. `operation_date`) and, per block, a **min-lead-time** to a named date (`≥ N days before <date>`) and/or a `timing_policy` keyed off a named date with forward offsets (`<date> − N days`).

#### Scenario: Author sets a pre-op lead time

- **WHEN** the author configures a pre-op block
- **THEN** they can set "≥ N days before operation_date", which the enroll-time earliest-feasible suggestion consumes

### Requirement: Message block authors templates per channel + timing

The `message` block inspector SHALL let the author pick a **message template per channel** (email / sms / mobile) and set its timing relative to a connected block (e.g. `operation_date − N days`). At runtime the send is **mocked** — it emits an audit/event-log entry only (no real delivery) — but the authoring experience SHALL be complete.

#### Scenario: Author sets a pre-op message

- **WHEN** the author configures a `message` block connected to the operation
- **THEN** they pick a template per channel and a "N days before operation_date" timing
- **AND** at runtime the block logs the send as an audit event without delivering

### Requirement: MDO block authors preset outcome choices

The `mdo` block inspector SHALL let the author define **preset outcome choices** (like a `decision`'s outputs). At runtime the MDO is an Appointment (meeting) whose lead, on the MDO view, SHALL pick one outcome and MAY add **notes + files**; the chosen outcome SHALL drive downstream branching (referenced via `decision_output`-style predicates). Authoring SHALL validate that downstream branches reference existing outcomes (connection validation).

#### Scenario: Author defines MDO outcomes and branches

- **WHEN** the author configures an `mdo` block
- **THEN** they define preset outcome choices, and downstream blocks may gate on a chosen outcome
- **AND** at runtime the MDO lead picks one outcome (+ optional notes/files) to complete it

## REMOVED Requirements

### Requirement: Milestone and wait block inspectors

**Reason**: the `milestone` and `wait` block kinds are removed (milestone redundant with phases; wait replaced by per-block `timing_policy`).

**Migration**: delete `MilestoneInspector` and `WaitInspector` and their palette entries; existing pathways are re-authored without these kinds.
