## ADDED Requirements

### Requirement: Block inspector authors a care-role reference

The per-block configuration editor SHALL let the author pick a **care-role code** for each materializing block (`appointment`/`treatment`/`mdo`/`task`) from the shared FHIR-aligned value set (`role_in_care` / `PractitionerRole`). This role is what enrollment binds to actual caregiver(s).

#### Scenario: Author picks a role on an MDO block

- **WHEN** the author opens the `mdo` block inspector
- **THEN** they can select a care-role code; the saved block carries that role reference for enrollment to resolve

### Requirement: Builder authors named clinical dates and timing constraints

The builder SHALL let the author declare **named clinical dates** on a pathway (e.g. `operation_date`) and, per block, a **min-lead-time** to a named date (`≥ N days before <date>`) and/or a `timing_policy` keyed off a named date with forward offsets (`<date> − N days`).

#### Scenario: Author sets a pre-op lead time

- **WHEN** the author configures a pre-op block
- **THEN** they can set "≥ N days before operation_date", which the enroll-time earliest-feasible suggestion consumes

## REMOVED Requirements

### Requirement: Milestone and wait block inspectors

**Reason**: the `milestone` and `wait` block kinds are removed (milestone redundant with phases; wait replaced by per-block `timing_policy`).

**Migration**: delete `MilestoneInspector` and `WaitInspector` and their palette entries; existing pathways are re-authored without these kinds.
