# pathway-builder Specification

## Purpose
TBD - created by archiving change pathway-builder-base. Update Purpose after archive.
## Requirements
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

The orchestrator SHALL render a builder canvas at `/pathways/{id}` that displays the pathway's nodes as a node graph with connectors between them. The canvas SHALL be backed by a third-party graph-canvas package selected via Phase 3 library audit (default expectation: React Flow / xyflow). The orchestrator SHALL NOT implement a homegrown graph renderer. The canvas SHALL NOT render a design-time entry-point marker — per D16 the start block is picked at enrollment, not at design time.

#### Scenario: Canvas renders pathway nodes and edges

- **WHEN** the caregiver opens a saved pathway with three nodes and two edges
- **THEN** the canvas renders three nodes connected by two edges
- **AND** no node is visually flagged as a design-time entry point

### Requirement: Block palette and node insertion

The orchestrator SHALL render a block palette derived from `GET /pathways/blocks`. The caregiver SHALL be able to add a new node of any catalogue type to the canvas. The orchestrator SHALL NOT hardcode the block-type list; it is sourced from the backend per session.

#### Scenario: Palette lists catalogue block types

- **WHEN** the backend returns block types `appointment`, `decision`, `milestone`, `timer`, `task`, `email`
- **THEN** the palette lists those six entries with their labels from the catalogue

#### Scenario: Adding a block creates a node

- **WHEN** the caregiver adds an `appointment` block to the canvas
- **THEN** a new node of type `appointment` appears on the canvas
- **AND** the pathway is marked dirty pending save

### Requirement: Phase picker driven by template catalogue

The orchestrator SHALL render an `+ Add phase` picker on the builder canvas sourced from `GET /pathways/phase-templates`. Picking a template SHALL seed `pathway_phase.label`, `ord`, and `template_id` (soft pointer); a `Custom phase` option SHALL allow authors to add a phase with a free-form label and `template_id = null`. The orchestrator SHALL NOT hardcode the phase-template list.

#### Scenario: Picker lists phase templates from the catalogue

- **WHEN** the backend returns templates `pre-op`, `surgery`, `recovery`, `follow-up`
- **THEN** the picker lists those four entries with their labels
- **AND** also offers a `Custom phase` entry

#### Scenario: Custom phase persists with no template_id

- **WHEN** the caregiver picks `Custom phase`, names it `Pre-admission`, and saves
- **THEN** the orchestrator includes a phase with the chosen label and `template_id = null` in the `PUT /pathways/{id}` payload

### Requirement: Block card rendering width

The orchestrator SHALL render every block card at a fixed canvas width (~175px) independent of the block's `duration_value`. Duration SHALL be surfaced as a textual chip on the card (e.g. `3d`, `0–7d`) rather than by scaling the card horizontally. A horizontal "smart time tape" visualization SHALL NOT ship in the PoC (deferred per D13); the underlying data model already supports a future tape without migration.

#### Scenario: Block widths uniform regardless of duration

- **WHEN** the canvas renders one block with `fixed_days = 3` and another with `fixed_days = 90`
- **THEN** both cards have the same width on the canvas
- **AND** each shows its duration as a chip on the card

### Requirement: Per-block configuration editor

The orchestrator SHALL render a per-block configuration editor in a side panel when a node is selected. The editor SHALL render fields driven by the block type's `config_schema` from `GET /pathways/blocks`. The orchestrator SHALL NOT ship hand-coded forms per block type for the PoC catalogue.

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

### Requirement: Builder shell layout

The `/pathways/{id}` route SHALL render a three-row grid layout: a 64px topbar, a 44px subbar, and a `1fr` canvas frame. The canvas SHALL be the only scrollable region inside the frame; the topbar and subbar SHALL stay pinned. The primary app sidebar SHALL default to its collapsed state on the builder route so the canvas receives maximum horizontal space.

#### Scenario: Builder shell row heights

- **WHEN** the caregiver opens the builder route
- **THEN** the topbar measures 64px tall and the subbar measures 44px tall
- **AND** the canvas frame fills the remaining vertical space

#### Scenario: Sidebar starts collapsed on the builder

- **WHEN** the caregiver navigates from `/pathways` to `/pathways/{id}`
- **THEN** the orchestrator app sidebar collapses to its icon-only state by default

### Requirement: Phase columns on the canvas

The canvas SHALL render every `pathway_phase` as a full-height vertical column with a tinted background and a sticky `[index] Label … [block count]` header chip at the top. Phase tint SHALL cascade to the numbered header badge via custom properties, so the same phase color is used in the subbar anchor and the canvas header.

#### Scenario: Each phase renders as a column

- **WHEN** the pathway has three phases ordered `Pre-op`, `Operatie`, `Herstel`
- **THEN** the canvas renders three adjacent vertical columns in that order
- **AND** each column header shows its 1-based index, label, and block count

#### Scenario: Phase tint matches across surfaces

- **WHEN** a phase's tint token resolves to color X
- **THEN** the subbar anchor badge for that phase, the canvas column background, and the canvas header badge all render color X

### Requirement: Lane rows with sticky labels

The canvas SHALL render every `pathway_lane` as a horizontal row band that spans the full canvas width. Each lane SHALL display a sticky label chip at the left edge of the viewport containing the lane icon, the lane name, and the block count for that lane. The lane label SHALL remain visible during horizontal scroll. The builder SHALL NOT render a separate left-rail lane menu.

#### Scenario: Lane label sticks during scroll

- **WHEN** the caregiver scrolls the canvas horizontally
- **THEN** each lane's label chip stays visible at the left edge of the viewport

#### Scenario: Block inherits its lane accent

- **WHEN** a block sits in the `caregiver` lane row
- **THEN** the block's rail-bar, ico-tile background, and port border render with the `--lane-caregiver` accent color

### Requirement: Edge routing and styling

Edges between blocks SHALL render as orthogonal smoothstep paths with quarter-circle corners of ~8–10px radius. Edges SHALL NOT render arrowheads at either end; direction SHALL be implied by port placement and node order. Cross-phase edges and branch-positive edges SHALL render in the primary color at 2px stroke. All other edges SHALL render in a neutral color at 1.75px stroke. Branch-negative edges SHALL render dashed.

#### Scenario: No arrowheads on edges

- **WHEN** the canvas renders any edge
- **THEN** the rendered SVG path has no `marker-start` or `marker-end` attribute

#### Scenario: Cross-phase edge is primary-colored

- **WHEN** an edge connects a source block in phase 2 to a target block in phase 3
- **THEN** the edge renders with stroke color matching the primary token at 2px

#### Scenario: Branch-negative edge is dashed

- **WHEN** an edge carries `source_branch_id` resolving to a "no" branch
- **THEN** the edge renders with a dashed stroke

### Requirement: Connection ports on blocks

Every non-branching block SHALL expose exactly one input port (mid-left) and one output port (mid-right). Branching blocks SHALL replace the single output port with two ports: `out-yes` at approximately 28% from the top of the right edge, and `out-no` at approximately 72%. Ports SHALL render as 11px circles bordered with the block's lane accent. Ports SHALL scale to ~1.25× on block hover. Edges SHALL only attach at port positions.

#### Scenario: Default block has two ports

- **WHEN** a non-branching block renders on the canvas
- **THEN** it exposes one input port at its mid-left and one output port at its mid-right

#### Scenario: Branching block has split outputs

- **WHEN** a `decision` block renders on the canvas
- **THEN** it exposes one input port at its mid-left and two output ports at the right edge labeled `yes` and `no`

### Requirement: Block group represents one time-locked moment

The canvas SHALL render a `block-group` as a dashed lane-tinted container that holds two or more ordered child blocks sharing a single trigger moment. The group SHALL expose exactly one input port and exactly one output port at the container boundary. Children SHALL NOT be individually addressable as edge endpoints; child rows SHALL render as a numbered sequence `[idx] [icon] [name] [type]`. The group header SHALL show an uppercase label, a step count, and a day-chip indicating the shared moment.

#### Scenario: Group exposes a single in/out port

- **WHEN** the canvas renders a group containing four child blocks
- **THEN** the group container exposes one input port and one output port
- **AND** none of the four child rows expose ports of their own

#### Scenario: Children are ordered and indexed

- **WHEN** a group declares four ordered children
- **THEN** the group renders them top-to-bottom with indices `1`, `2`, `3`, `4`

### Requirement: Block card anatomy and entry marker

Every block card SHALL render at fixed dimensions ~220×68 pixels using a three-column grid `4px 36px 1fr` for `rail-bar | ico-tile | name + meta`. The meta row SHALL show the block type and its duration chip. A block flagged as a runtime entry point SHALL render a `START` corner-tab inside the card top-left corner; the tab SHALL NOT be positioned outside the card's bounding box.

#### Scenario: Entry tab stays inside card bounds

- **WHEN** a block is rendered with the entry flag
- **THEN** the `START` corner-tab sits flush with the card's top-left corner inside the card outline
- **AND** the tab is not clipped by phase headers or other overlays

### Requirement: Topbar identity, status, and actions

The builder topbar SHALL render, in reading order: a pathway identity tile, a vertical stack of an eyebrow crumb (`Zorgpaden / {name}`) above a title row (editable title + meta with block count, phase count, last-edited timestamp), a slim status pill, a presence avatar stack, a vertical divider, undo and redo icon buttons, a `Geschiedenis` ghost button, and a primary `Opslaan` button styled with the active gradient token.

#### Scenario: Dirty status pulses

- **WHEN** the pathway has unsaved local changes
- **THEN** the status pill shows the dirty state with a pulsing dot animation

#### Scenario: Title is inline-editable

- **WHEN** the caregiver clicks the pencil-icon next to the title
- **THEN** the title turns into an inline input
- **AND** committing the input issues a `PUT /pathways/{id}` updating the `name` field

### Requirement: Save action signals state across topbar

The Save action SHALL transition the status pill through `dirty → saving → clean` on success, and `dirty → saving → error` on failure. While `saving`, the status pill dot SHALL be replaced with a spinner; the Save button SHALL be disabled.

#### Scenario: Successful save clears dirty state

- **WHEN** the caregiver clicks Save and `PUT /pathways/{id}` succeeds
- **THEN** the status pill renders the `clean` state
- **AND** the Save button is enabled again

#### Scenario: Failed save preserves dirty state

- **WHEN** the caregiver clicks Save and `PUT /pathways/{id}` returns an error
- **THEN** the status pill renders the `error` state
- **AND** subsequent edits return the pill to `dirty`

### Requirement: Combined minimap and zoom panel

The builder SHALL render a single floating panel in the bottom-right corner of the canvas frame containing both a minimap and a zoom control bar. The minimap SHALL render scaled-down dot markers per block colored by lane accent and an overlay rectangle showing the current viewport. The zoom bar SHALL contain decrement, percentage readout, increment, and fit-to-screen controls. The builder SHALL NOT render the zoom controls as a separate floating element.

#### Scenario: One panel, two controls

- **WHEN** the caregiver opens the builder route
- **THEN** there is exactly one floating panel in the canvas frame's bottom-right corner
- **AND** that panel contains both the minimap and the zoom controls

#### Scenario: Clicking the minimap recenters the viewport

- **WHEN** the caregiver clicks a position on the minimap
- **THEN** the canvas viewport recenters so that minimap position is centered in view

### Requirement: Create-pathway dialog anatomy

The orchestrator SHALL render the create-pathway dialog as a modal that captures, at minimum: name, clinical goal, patient goal, phase preset, and owner. The dialog header SHALL include a 40px gradient pathway identity tile (same component used in the builder topbar) above an eyebrow `NIEUW ZORGPAD` and a title. The submit button SHALL read `Aanmaken & openen`, render with the active gradient token, and replace its icon with a spinner while the create mutation is in flight.

#### Scenario: Dialog renders identity tile and required fields

- **WHEN** the caregiver opens the create-pathway dialog
- **THEN** the dialog header shows a 40px gradient identity tile, an uppercase eyebrow, and a title
- **AND** the body contains inputs for name, clinical goal, patient goal, phase preset, and owner

#### Scenario: Submit button reflects pending state

- **WHEN** the caregiver submits the dialog with valid fields
- **THEN** the submit button is disabled and renders a spinner in place of its icon until the create mutation settles

### Requirement: Create-pathway dialog phase preset seeds default scaffold

The dialog SHALL offer a phase-preset choice with at least two options: `Standaard (4 fasen)` and `Leeg canvas`. Picking `Standaard (4 fasen)` SHALL seed four phases and a default lane scaffold so the builder opens with a non-empty structural canvas. Picking `Leeg canvas` SHALL create the pathway with zero phases and zero lanes so the builder opens in a state that prompts the user to add a phase first.

#### Scenario: Standaard preset seeds four phases

- **WHEN** the caregiver picks `Standaard (4 fasen)` and submits
- **THEN** the created pathway has four phases ordered by their default `ord`
- **AND** the builder canvas renders four phase columns immediately on open

#### Scenario: Leeg canvas preset seeds nothing structural

- **WHEN** the caregiver picks `Leeg canvas` and submits
- **THEN** the created pathway has zero phases and zero lanes
- **AND** the builder canvas opens in a state guiding the user to add a phase before adding blocks

### Requirement: Create-pathway dialog owner field

The dialog SHALL require an owner selected from caregivers in the active tenant. The owner field SHALL default to the currently logged-in caregiver. Submission SHALL include the chosen owner identifier on the `POST /pathways` payload.

#### Scenario: Owner defaults to current user

- **WHEN** the caregiver opens the create-pathway dialog
- **THEN** the owner field is pre-populated with the currently logged-in caregiver

#### Scenario: Submit includes owner id

- **WHEN** the caregiver submits the dialog
- **THEN** the `POST /pathways` payload contains the selected owner's identifier

### Requirement: Create flow pre-seeds builder cache and routes without skeleton flash

On successful creation, the orchestrator SHALL pre-seed the builder's pathway-detail query cache from the create-mutation response before navigating to `/pathways/{id}`. The builder route SHALL mount without an intermediate loading skeleton in this flow.

#### Scenario: Builder mounts directly from cache after create

- **WHEN** the create mutation resolves successfully
- **THEN** the orchestrator writes the response into `pathwayKeys.detail(id)` before navigation
- **AND** the builder route reads the cached pathway on mount without showing the loading skeleton

### Requirement: Builder shell state matrix

The builder route SHALL render exactly one of five mutually-exclusive shell states: `loading`, `not-found`, `error`, `ready-empty`, `ready-populated`. The `not-found` state SHALL render a card with a back-to-overview action. The `error` state SHALL render a card with both a retry action and a back-to-overview action. The `ready-empty` state SHALL render the full topbar, subbar, and any scaffold (phase columns + lane rows) defined by the pathway, plus the empty-canvas first-block CTA.

#### Scenario: 404 renders not-found shell

- **WHEN** the caregiver opens `/pathways/{id}` for a pathway that does not exist
- **THEN** the builder renders a card titled `Zorgpad niet gevonden`
- **AND** the card exposes a `Terug naar overzicht` action

#### Scenario: Error renders retry + back actions

- **WHEN** `GET /pathways/{id}` fails with a non-404 error
- **THEN** the builder renders an error card with both `Opnieuw proberen` and `Terug naar overzicht` actions

#### Scenario: Ready-empty renders scaffold plus CTA

- **WHEN** a pathway loads successfully with zero blocks and a non-empty phase scaffold
- **THEN** the canvas renders phase columns and lane rows from the scaffold
- **AND** a dashed first-block CTA appears inside the earliest lane of the earliest phase

### Requirement: Empty canvas first-block CTA

When the builder is in `ready-empty` and the pathway has at least one phase and one lane, the canvas SHALL render a dashed placeholder card at a position inside the earliest lane of the earliest phase, paired with an instruction `Sleep een blok hier vanuit het palet hieronder`. Dropping a palette item onto the placeholder SHALL create the block at the placeholder's position using the placeholder's lane and phase, overriding the block type's `default_lane_kind_code`. When the pathway has zero phases or zero lanes, the canvas SHALL render a centered prompt directing the caregiver to add a phase via the subbar `+ Fase` action before adding blocks.

#### Scenario: Placeholder anchors the first block

- **WHEN** the caregiver drops an `appointment` palette item onto the empty-canvas placeholder
- **THEN** an `appointment` block is created at the placeholder's coordinates
- **AND** the block's lane matches the placeholder's lane regardless of the type's default lane

#### Scenario: No-scaffold prompt redirects to phase action

- **WHEN** the builder loads a pathway with zero phases
- **THEN** the canvas renders a centered prompt pointing at the subbar `+ Fase` action
- **AND** the placeholder card does not render

### Requirement: Pathway lifecycle status

Each pathway SHALL carry a `status` field with values `concept`, `published`, or `archived`. Newly created pathways SHALL default to `concept`. Only `published` pathways SHALL be eligible for patient enrollment. The orchestrator SHALL expose a publish action that transitions a `concept` pathway to `published` via `POST /pathways/{id}/publish`. The status SHALL render as a badge in both the overview row and the builder topbar.

#### Scenario: Newly created pathway is concept

- **WHEN** a pathway is created via the create-pathway dialog
- **THEN** the response status is `concept`
- **AND** the overview row and builder topbar display a `Concept` status badge

#### Scenario: Publish transitions concept to published

- **WHEN** the caregiver confirms the publish action on a concept pathway
- **THEN** the orchestrator calls `POST /pathways/{id}/publish`
- **AND** on success the status badge changes to `Gepubliceerd`

#### Scenario: Publish action only visible for concept

- **WHEN** the builder topbar renders for a `published` pathway
- **THEN** the publish action is not visible
- **AND** the topbar primary action is the manual `Opslaan` button

### Requirement: Concept-mode autosave

When the builder operates on a `concept` pathway, the orchestrator SHALL autosave edits via `PUT /pathways/{id}` debounced 800ms after the last edit settles. The status pill SHALL render `Concept · automatisch opgeslagen` when clean, `Concept · niet opgeslagen` while the debounce window is open, `Concept · wijzigingen opslaan…` while the save is in flight, and `Concept · opslaan mislukt` on failure. `⌘S` SHALL force-flush the debounce immediately. Autosave SHALL NOT run for `published` pathways — the existing manual save state machine applies instead.

#### Scenario: Edit triggers autosave after debounce

- **WHEN** the caregiver edits any field on a concept pathway and waits 800ms without further edits
- **THEN** the orchestrator issues `PUT /pathways/{id}` with the updated definition
- **AND** the status pill transitions through `Concept · niet opgeslagen → Concept · wijzigingen opslaan… → Concept · automatisch opgeslagen`

#### Scenario: Cmd+S force-flushes the debounce

- **WHEN** the caregiver presses `⌘S` during the autosave debounce window on a concept pathway
- **THEN** the pending autosave fires immediately without waiting for the debounce to elapse

#### Scenario: Published pathway uses manual save

- **WHEN** the caregiver edits a `published` pathway
- **THEN** the orchestrator does not autosave
- **AND** the topbar Save button transitions per the existing manual save state machine

### Requirement: Publish modal captures version label, note, and clinical-approval acknowledgement

The publish confirmation modal SHALL collect, in addition to the existing publish confirmation copy:

1. An optional single-line `label` text input (max 120 characters) with placeholder `bijv. Post-MDR-update`.
2. An optional multi-line `note` textarea (max 2000 characters) with placeholder `Wat is er veranderd t.o.v. de vorige versie?`.
3. A required checkbox with label `Ik bevestig dat deze versie klinisch is goedgekeurd en geschikt voor patiëntinschrijving`.

The confirm button SHALL be disabled until the checkbox is ticked. The `label` and `note` SHALL remain optional regardless of the checkbox state. On confirm, the orchestrator SHALL submit `{ label?, note? }` to the publish endpoint; the server SHALL persist these fields onto the same `pathway_version` row that transitions from `concept` to `published`, alongside `published_at` and `published_by`. Concept versions and `restore-from-version` / `fork-from-publish` rows SHALL keep server-assigned auto-labels (`Werkversie`, `Hersteld van v.{n}`, `Nieuw concept op v.{n}`); these auto-labels MUST NOT be user-editable in the PoC.

#### Scenario: Confirm disabled until acknowledgement ticked

- **GIVEN** the publish modal is open with empty label, empty note, and unchecked acknowledgement
- **THEN** the confirm button is disabled
- **WHEN** the user ticks the acknowledgement checkbox
- **THEN** the confirm button becomes enabled

#### Scenario: Label and note are optional

- **GIVEN** the publish modal is open and the acknowledgement checkbox is ticked
- **AND** the label input is empty and the note textarea is empty
- **WHEN** the user clicks confirm
- **THEN** the orchestrator submits the publish request without `label` or `note`
- **AND** the server flips the concept to `published` and assigns no label

#### Scenario: Label and note persist on the published row

- **WHEN** the user submits the publish modal with `label = "Post-MDR-update"` and `note = "MDR class IIa adjustments to monitoring frequency."`
- **THEN** the orchestrator submits `{ label, note }` to the publish endpoint
- **AND** the resulting `pathway_version` row has `status = published`, the same `label`, the same `note`, and `published_at` / `published_by` set

#### Scenario: Auto-labels on non-publish version rows are not user-editable

- **GIVEN** a version row with `kind = restore-from-version` and the server-assigned label `Hersteld van v.2`
- **WHEN** the user opens the Geschiedenis drawer
- **THEN** the row label renders as read-only text
- **AND** no inline edit affordance is exposed for non-publish version rows in the PoC

### Requirement: Publish guards against unsaved autosave

The publish confirmation SHALL only open after the autosave queue is flushed and clean. If the caregiver clicks `Publiceren` while the autosave debounce window is open or while a save is in flight, the orchestrator SHALL force-flush, await success, and only then open the confirmation. If the flush fails, the publish flow SHALL abort and surface the autosave error.

#### Scenario: Publish waits for pending autosave

- **WHEN** the caregiver clicks `Publiceren` 200ms after an edit (within the debounce window)
- **THEN** the orchestrator flushes the autosave first
- **AND** the publish confirmation modal opens only after the flush succeeds

#### Scenario: Publish aborts if flush fails

- **WHEN** the caregiver clicks `Publiceren` and the forced autosave flush returns an error
- **THEN** the publish confirmation does not open
- **AND** the orchestrator surfaces the autosave error via the standard error-toast pipeline

### Requirement: Restore is blocked when a concept already exists

When the user triggers restore (from the read-only banner CTA `Herstel als nieuw concept`, a Geschiedenis drawer row action, or the blocked-mutation modal on a published version) AND the pathway already has a `concept` version, the orchestrator SHALL swap the confirmation modal's copy and actions to surface the existing concept rather than send the restore request. The modal body SHALL read `Er bestaat al een concept-versie (v.{n}). Wil je dat openen?` and SHALL present two buttons: `Annuleren` (ghost) and `Open bestaande concept` (primary). Picking `Open bestaande concept` SHALL navigate to bare `/pathways/{id}` without calling the restore endpoint. The server SHALL enforce the same invariant as a backstop by rejecting `POST /pathways/{id}/versions/{versionId}/restore` and `POST /pathways/{id}/versions/fork-from/{versionId}` with HTTP 409 and machine-readable error code `concept_already_exists` whenever a concept version exists for the pathway.

#### Scenario: Restore swaps to open-existing-concept modal when concept exists

- **GIVEN** a pathway with an in-flight `concept` version `v.5` and a historical `published` version `v.2`
- **WHEN** the user clicks `Herstel als nieuw concept` while viewing `/pathways/{id}/v/{v2Id}`
- **THEN** the confirmation modal renders body `Er bestaat al een concept-versie (v.5). Wil je dat openen?`
- **AND** the modal exposes buttons `Annuleren` and `Open bestaande concept`
- **AND** no restore request is sent

#### Scenario: Open bestaande concept navigates to bare URL

- **GIVEN** the open-existing-concept modal is showing
- **WHEN** the user clicks `Open bestaande concept`
- **THEN** the router navigates to bare `/pathways/{id}`
- **AND** no restore request is sent

#### Scenario: Server rejects restore when concept exists

- **GIVEN** a pathway with an in-flight `concept` version
- **WHEN** the orchestrator sends `POST /pathways/{id}/versions/{versionId}/restore` directly (e.g. UI race condition bypasses the pre-flight check)
- **THEN** the server responds with HTTP 409
- **AND** the response body contains machine-readable error code `concept_already_exists`
- **AND** no new version row is created

### Requirement: Overview row owner display

Each overview row SHALL display the pathway owner as a 26px avatar with initials in the trailing actions cluster, and the meta line SHALL include `door {owner.name}`. Hovering the avatar SHALL show a tooltip with the owner's full name and role.

#### Scenario: Row meta includes owner name

- **WHEN** the overview renders a pathway with an assigned owner
- **THEN** the row meta line contains `door {owner.name}`
- **AND** the trailing cluster renders an avatar whose tooltip shows the owner's full name and role

### Requirement: Hybrid version route resolution

The pathway builder SHALL be reachable via two URL shapes that share a single shell component:

1. `/pathways/{pathwayId}` — the loader SHALL resolve to the latest `concept` version if one exists, otherwise the latest `published` version.
2. `/pathways/{pathwayId}/v/{versionId}` — the loader SHALL resolve to the specified version and SHALL return 404 if `versionId` does not belong to `pathwayId`.

The shell SHALL enter read-only chrome when EITHER the URL matches the `/v/{versionId}` shape OR the resolved version's `status` is not `concept`. After a successful restore or fork-on-edit, the router SHALL navigate to the bare `/pathways/{pathwayId}` URL — concept URLs SHALL NEVER include a `versionId`.

#### Scenario: Bare URL resolves to latest concept

- **GIVEN** a pathway with both a `concept` and a `published` version
- **WHEN** the user navigates to `/pathways/{id}`
- **THEN** the loader returns the `concept` version
- **AND** the shell is editable
- **AND** the read-only banner is not rendered

#### Scenario: Bare URL falls back to latest published when no concept exists

- **GIVEN** a pathway with no `concept` version and at least one `published` version
- **WHEN** the user navigates to `/pathways/{id}`
- **THEN** the loader returns the latest `published` version
- **AND** the shell enters read-only chrome
- **AND** the read-only banner uses the published-fallback variant with CTA `Maak nieuwe versie`

#### Scenario: Explicit version URL is always read-only

- **WHEN** the user navigates to `/pathways/{id}/v/{versionId}` for any version including the latest published or current concept
- **THEN** the shell enters read-only chrome
- **AND** the read-only banner uses the historical variant with CTA `Herstel als nieuw concept`

#### Scenario: 404 on cross-pathway version id

- **WHEN** the user navigates to `/pathways/{pathwayA}/v/{versionId}` where `versionId` belongs to `pathwayB`
- **THEN** the loader returns 404
- **AND** the shell renders `<BuilderNotFound>`

#### Scenario: Overview row click on published-only pathway lands on read-only fallback

- **GIVEN** a pathway with zero `concept` versions and at least one `published` version
- **WHEN** the user clicks the pathway's row in the overview
- **THEN** the router navigates to bare `/pathways/{id}`
- **AND** the loader resolves to the latest `published` version
- **AND** the shell enters read-only chrome with the published-fallback banner
- **AND** no modal is shown before navigation
- **AND** the Geschiedenis drawer is not auto-opened

#### Scenario: Fork navigates back to bare URL

- **GIVEN** the user is on `/pathways/{id}/v/{versionId}` viewing a historical version
- **WHEN** the user confirms `Herstel als nieuw concept`
- **THEN** the orchestrator calls `POST /pathways/{id}/versions/{versionId}/restore`
- **AND** on success the router navigates to bare `/pathways/{id}`
- **AND** the URL contains no `versionId` segment

### Requirement: Topbar version-switch chip replaces standalone history button

The topbar SHALL render a compact dropdown trigger (colored status dot · `v.{n}` · chevron) inside the right action cluster, immediately to the left of `Opslaan`. The standalone `Geschiedenis` ghost button MUST NOT be rendered separately in the topbar; the full version drawer SHALL be reachable only via the menu footer link `Alle versies in geschiedenis`. The trigger SHALL remain interactive while the shell is read-only.

#### Scenario: Trigger displays current version and status

- **WHEN** the shell resolves to a `concept` version `v.5`
- **THEN** the trigger renders the warn-colored dot, label `v.5`, and chevron
- **AND** the trigger's `aria-label` is `Wissel versie, huidig v.5 concept`

#### Scenario: Menu lists versions grouped by lifecycle

- **WHEN** the user opens the version-switch menu
- **THEN** the menu shows a `Werkversie` group containing the single concept row if present
- **AND** the menu shows a `Gepubliceerd` group with the latest published version followed by historical published versions in reverse-chronological order
- **AND** the row matching the currently-resolved version carries `aria-current="true"` and a visible checkmark

#### Scenario: Picking a non-current version navigates correctly

- **GIVEN** the menu is open
- **WHEN** the user picks the concept row
- **THEN** the router navigates to bare `/pathways/{id}`
- **WHEN** the user picks a historical row
- **THEN** the router navigates to `/pathways/{id}/v/{versionId}`

#### Scenario: Footer link opens the Geschiedenis drawer

- **WHEN** the user clicks `Alle versies in geschiedenis` in the menu footer
- **THEN** the version-switch menu closes
- **AND** the Geschiedenis drawer opens
- **AND** any open block-config drawer closes (mutex)

#### Scenario: Trigger stays interactive in read-only mode

- **GIVEN** the shell is in read-only chrome
- **WHEN** the user clicks the version-switch trigger
- **THEN** the menu opens
- **AND** the trigger is not dimmed by the `.is-readonly` class

### Requirement: Read-only banner overlay

When the shell is read-only, a 36px tinted strip SHALL render between the topbar `<header>` and the phase subbar. The variant SHALL be derived from the resolved version's `status` (success-tinted for published-fallback; info-tinted for historical), NOT from the URL shape. The banner SHALL expose a primary CTA appropriate to the variant and, when viewing a historical version with a current resolution available, a secondary `Terug naar huidige` ghost button. The banner element SHALL carry `role="status"`. While the banner is visible, the shell SHALL apply the `.is-readonly` class to dim the palette dock, save button, undo/redo buttons, status pill, and presence stack while keeping the version-switch chip and crumbs row fully interactive.

#### Scenario: Published-fallback variant offers Maak nieuwe versie

- **GIVEN** the user is on bare `/pathways/{id}` that resolved to a `published` version because no concept exists
- **THEN** the banner renders with the success-tinted variant
- **AND** the primary CTA reads `Maak nieuwe versie`
- **AND** the `Terug naar huidige` button is not rendered

#### Scenario: Historical variant offers restore plus back-to-current

- **GIVEN** the user is on `/pathways/{id}/v/{versionId}` viewing a historical version
- **AND** a concept or latest-published resolution exists at bare `/pathways/{id}`
- **THEN** the banner renders with the info-tinted variant
- **AND** the primary CTA reads `Herstel als nieuw concept`
- **AND** the `Terug naar huidige` ghost button is rendered

#### Scenario: Read-only chrome dims editing controls

- **WHEN** the banner is visible
- **THEN** the shell carries the `.is-readonly` class
- **AND** the palette dock, save button, undo/redo buttons, status pill, and presence stack are not interactive
- **AND** the version-switch chip and crumbs row remain interactive

### Requirement: Crumb version marker

The topbar crumbs row SHALL include a passive inline marker placed after the breadcrumb leaf containing three children: a 6px colored dot, the version number (`v.{n}`) in weight 600 tabular-nums, and the lowercase state word at 0.75 opacity. The marker SHALL NOT have a background, border, or padding. The marker SHALL NOT be interactive. The marker SHALL carry `aria-hidden="true"` to avoid duplicate screen-reader announcements (the version-switch chip already exposes the same information). The marker's color SHALL match the status palette used by the version-switch dot and the read-only banner tint.

#### Scenario: Marker reflects current resolved version

- **WHEN** the shell resolves to `v.5` in `concept` status
- **THEN** the crumbs row contains a span with a warn-colored 6px dot, the text `v.5`, and the lowercase state word `concept`
- **AND** the span has `aria-hidden="true"`

#### Scenario: Marker color follows lifecycle palette

- **WHEN** the resolved version status changes from `concept` to `published`
- **THEN** the marker re-renders with the success-color dot and state word `gepubliceerd`
- **AND** the version-switch trigger dot and read-only banner tint use the same color family

