## ADDED Requirements

### Requirement: Block class hierarchy replaces the generic block row

The pathway domain SHALL model each block kind as a concrete `BaseBlock` subclass rather than a single generic `PathwayBlock` row whose kind lives in `type: str` and whose shape lives in `config: JSONB`. `BaseBlock` SHALL carry the fields common to every kind (`name`, `description`, `lane_kind`, `icon`, `input_logic`, `timing_policy`, `deferred_fields`); each concrete subclass (`AppointmentBlock`, `TaskBlock`, `DecisionBlock`, `SubpathBlock`, `BridgeBlock`, `MDOBlock`, `TreatmentBlock`, `ExternalProgramBlock`, `MessageBlock`, `EndPathwayBlock`) SHALL add its own typed kind-specific fields and own its per-kind metadata (label, icon, allowed lanes, branch support) as class-level attributes. The standalone `BlockTypeEntry` data registry SHALL retire.

#### Scenario: Each block kind resolves to a typed subclass

- **WHEN** a stored block of a given kind is loaded into the domain
- **THEN** it materialises as the concrete `BaseBlock` subclass for that kind
- **AND** its kind-specific fields are typed attributes, not keys read out of a JSON blob

#### Scenario: Block metadata sources from the subclass

- **WHEN** the block-kind catalogue is projected
- **THEN** each row's label, icon, and allowed lanes are sourced from the subclass
- **AND** no entry is read from a separate `BlockTypeEntry` registry

### Requirement: Connectivity is authored as per-block input_logic, edges are derived

Each block SHALL carry an `input_logic` list naming the prior blocks it depends on, each with a typed predicate drawn from a closed vocabulary, combined by an `aggregator` (`all_of`, `any_of`, `n_of_m`) defaulting to `all_of`. The builder SHALL NOT author edge rows as the source of truth; any `pathway_edge_view` exposed for canvas or topology queries SHALL be a derived projection of the blocks' `input_logic`. Decision-style branching SHALL be modelled by the producer block exposing typed `outputs` and downstream blocks referencing a specific output in their `input_logic`.

#### Scenario: Edges fall out of input_logic

- **GIVEN** a block whose `input_logic` references two prior blocks
- **WHEN** the edge view is materialised
- **THEN** it contains exactly the edges derived from those `input_logic` entries
- **AND** no edge exists that was authored independently of an `input_logic` entry

#### Scenario: Branching references a typed output

- **GIVEN** a `DecisionBlock` exposing typed `outputs`
- **WHEN** a downstream block depends on one branch
- **THEN** its `input_logic` entry references that specific output rather than the block as a whole

### Requirement: Timing splits into template policy and runtime instance

Template timing SHALL live in a typed `TimingPolicy` attached to each block (e.g. `fixed_duration`, `wait_after`, `due_within`, `at_enrollment_picked_date`) and SHALL be builder-authored only. Concrete instance timing (`scheduled_at`, `started_at`, `completed_at`, `due_at`, `state`) SHALL live on a per-(block × enrollment) `BlockExecution` row and SHALL be runtime-authored only. A template SHALL NOT hold instance timestamps and a `BlockExecution` SHALL NOT hold timing policy; the two SHALL join by `block_template_id`.

#### Scenario: Template carries policy, not timestamps

- **WHEN** a block template is inspected
- **THEN** it exposes a `TimingPolicy` and carries no `started_at` / `completed_at` / `due_at`

#### Scenario: Runtime carries timestamps, not policy

- **WHEN** a `BlockExecution` is inspected
- **THEN** it exposes concrete `scheduled_at` / `started_at` / `completed_at` / `due_at` / `state` and no `TimingPolicy`

### Requirement: Deferred fields are first-class and validated at enrollment

Each block subclass SHALL declare which of its fields are deferred (runtime-supplied). The template SHALL store the deferred slot definition (label, type, validation, default, required/optional); the actual value SHALL be stored per patient instance as a `DeferredFieldValue` on the enrollment aggregate. Enrollment SHALL validate that every required deferred field is supplied before the enrollment is accepted.

#### Scenario: Builder marks a field deferred

- **GIVEN** an `AppointmentBlock` whose `location` is flipped to deferred
- **WHEN** the enrollment-form descriptor is produced
- **THEN** it lists `location` as a runtime-supplied field with its label, type, and required flag

#### Scenario: Missing required deferred value rejects enrollment

- **GIVEN** a block with a required deferred field
- **WHEN** a patient is enrolled without supplying that field
- **THEN** enrollment is rejected and no `DeferredFieldValue` is recorded for that field

### Requirement: Enrollment is a separate aggregate from the pathway template

`Pathway` SHALL remain the template aggregate owning versions, lanes, phases, and the new block hierarchy. A `PathwayEnrollment` aggregate SHALL spawn per enrolled patient and own the `BlockExecution` rows, the `DeferredFieldValue` rows, the patient identifier, and the enrolled care team. Template aggregates SHALL NOT own runtime state and enrollment aggregates SHALL NOT own template authoring.

#### Scenario: Enrolling spawns a runtime aggregate

- **GIVEN** a published pathway template
- **WHEN** a patient is enrolled
- **THEN** a `PathwayEnrollment` is created owning one `BlockExecution` per template block
- **AND** the template aggregate gains no per-patient runtime rows
