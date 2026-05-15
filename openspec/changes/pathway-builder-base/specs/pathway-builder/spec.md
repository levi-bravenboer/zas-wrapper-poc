## ADDED Requirements

### Requirement: Pathways sidebar entry

The orchestrator SHALL render a `Pathways` entry in the primary sidebar nav, using the i18n key `nav.pathways`. The entry SHALL link to `/pathways` and follow existing `app-shell` sidebar conventions for icon, ordering, and collapsed/expanded states.

#### Scenario: Sidebar shows Pathways entry

- **WHEN** a logged-in caregiver opens any orchestrator page
- **THEN** the sidebar shows a `Pathways` entry resolved from `nav.pathways`
- **AND** clicking it navigates to `/pathways`

### Requirement: Pathway overview page

The orchestrator SHALL expose a `/pathways` route that lists existing pathway definitions. The list SHALL show at minimum `name`, `last edited`, and block count, sourced from `GET /pathways`. An empty state SHALL render when no pathways exist. A row click SHALL navigate to that pathway's builder route.

#### Scenario: Overview renders pathway summaries

- **WHEN** the backend returns two pathway summaries from `GET /pathways`
- **THEN** the overview page renders two rows with name, last edited, and block count

#### Scenario: Empty state when no pathways

- **WHEN** `GET /pathways` returns an empty list
- **THEN** the overview page renders an empty state guiding the user to create their first pathway

#### Scenario: Row click opens builder

- **WHEN** the caregiver clicks a pathway row
- **THEN** the orchestrator navigates to `/pathways/{id}`

### Requirement: Pathway create flow

The orchestrator SHALL expose a create flow that captures a pathway name, calls `POST /pathways`, and redirects to the new pathway's builder route on success. The exact surface (full route `/pathways/new` versus modal-from-overview) is decided during Phase 2 prototyping and recorded in `design.md`.

#### Scenario: Successful create redirects to builder

- **WHEN** the caregiver submits the create form with a valid name
- **THEN** the orchestrator calls `POST /pathways`
- **AND** redirects to `/pathways/{id}` for the newly created pathway

#### Scenario: Create surfaces backend validation errors

- **WHEN** `POST /pathways` returns a validation error
- **THEN** the create form surfaces the error via the orchestrator's standard error-toast pipeline
- **AND** does not navigate away

### Requirement: Pathway builder canvas

The orchestrator SHALL render a builder canvas at `/pathways/{id}` that displays the pathway's nodes as a node graph with connectors between them and a visible entry-point marker. The canvas SHALL be backed by a third-party graph-canvas package selected via Phase 3 library audit (default expectation: React Flow / xyflow). The orchestrator SHALL NOT implement a homegrown graph renderer.

#### Scenario: Canvas renders pathway nodes and edges

- **WHEN** the caregiver opens a saved pathway with three nodes and two edges
- **THEN** the canvas renders three nodes connected by two edges
- **AND** the entry node is visually marked as the entry point

### Requirement: Block palette and node insertion

The orchestrator SHALL render a block palette derived from `GET /pathway-blocks`. The caregiver SHALL be able to add a new node of any catalogue type to the canvas. The orchestrator SHALL NOT hardcode the block-type list; it is sourced from the backend per session.

#### Scenario: Palette lists catalogue block types

- **WHEN** the backend returns block types `appointment`, `decision`, `milestone`, `luscii-clinical-path`
- **THEN** the palette lists those four entries with their labels from the catalogue

#### Scenario: Adding a block creates a node

- **WHEN** the caregiver adds an `appointment` block to the canvas
- **THEN** a new node of type `appointment` appears on the canvas
- **AND** the pathway is marked dirty pending save

### Requirement: Phase picker driven by template catalogue

The orchestrator SHALL render an `+ Add phase` picker on the builder canvas sourced from `GET /pathway-phase-templates`. Picking a template SHALL seed `pathway_phase.label`, `ord`, and `template_id` (soft pointer); a `Custom phase` option SHALL allow authors to add a phase with a free-form label and `template_id = null`. The orchestrator SHALL NOT hardcode the phase-template list.

#### Scenario: Picker lists phase templates from the catalogue

- **WHEN** the backend returns templates `pre-op`, `surgery`, `recovery`, `follow-up`
- **THEN** the picker lists those four entries with their labels
- **AND** also offers a `Custom phase` entry

#### Scenario: Custom phase persists with no template_id

- **WHEN** the caregiver picks `Custom phase`, names it `Pre-admission`, and saves
- **THEN** the orchestrator includes a phase with the chosen label and `template_id = null` in the `PUT /pathways/{id}` payload

### Requirement: Per-block configuration editor

The orchestrator SHALL render a per-block configuration editor in a side panel when a node is selected. The editor SHALL render fields driven by the block type's `config_schema` from `GET /pathway-blocks`. The orchestrator SHALL NOT ship hand-coded forms per block type for the PoC catalogue.

#### Scenario: Schema-driven editor renders fields

- **WHEN** a block type's `config_schema` declares a `title` string field and a `duration_minutes` integer field
- **THEN** selecting a node of that type renders a side panel with a text input for `title` and a number input for `duration_minutes`

### Requirement: Save action persists the pathway

The orchestrator SHALL expose a `Save` action on the builder that calls `PUT /pathways/{id}` with the full current definition. A dirty indicator SHALL be visible whenever there are unsaved changes. After a successful save, the dirty indicator SHALL clear.

#### Scenario: Save persists the current canvas state

- **WHEN** the caregiver adds a node, configures it, and clicks `Save`
- **THEN** the orchestrator sends a `PUT /pathways/{id}` with the updated definition
- **AND** the dirty indicator clears after the request succeeds

#### Scenario: Save error keeps dirty state

- **WHEN** `PUT /pathways/{id}` returns an error
- **THEN** the dirty indicator remains visible
- **AND** the orchestrator surfaces the error via the standard error-toast pipeline

### Requirement: Module + query-key conventions

The pathway surface SHALL live under `apps/orchestrator/src/modules/pathway/`. Query keys SHALL be namespaced as `pathwayKeys.list()`, `pathwayKeys.detail(id)`, and `pathwayKeys.blocks()`, following the `api-client` capability's query-key convention.

#### Scenario: Query keys namespaced under `pathway`

- **WHEN** the orchestrator caches a pathway list or detail or the block catalogue
- **THEN** the query keys begin with `"pathway"` followed by the operation discriminator and any id
