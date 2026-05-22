# block-lane-snap Specification

## Purpose
TBD - created by archiving change block-lane-snap. Update Purpose after archive.
## Requirements
### Requirement: Block type declares allowed lane kinds

Every entry in the pathway block-type catalogue SHALL expose a non-empty list of allowed lane-kind codes (`allowed_lane_kind_codes`). The first entry in the list MUST be treated as the default placement when no other lane context is available.

#### Scenario: Catalogue response includes allowed lanes

- **WHEN** a client calls `GET /pathways/blocks`
- **THEN** every returned block type includes `allowed_lane_kind_codes` as a non-empty array of lane-kind code strings
- **AND** each code in the array exists in the `pathway_lane_kind` table

#### Scenario: Default lane resolution falls back to first allowed lane

- **WHEN** the builder needs to place a block of type `T` and no explicit target lane is provided
- **THEN** the placement lane SHALL be the lane in the current pathway whose `lane_kind_code` equals `T.allowed_lane_kind_codes[0]`
- **AND** if no such lane exists in the pathway, placement SHALL be rejected before the block is added to state

### Requirement: Backend rejects blocks placed on disallowed lanes

The pathway replace endpoint (`PUT /pathways/{id}`) SHALL reject payloads where any block's resolved lane does not map to a lane-kind code present in the block type's `allowed_lane_kind_codes`. The response MUST be HTTP 422 and identify the offending block.

#### Scenario: Email block on caregiver lane is rejected

- **GIVEN** the catalogue lists `email.allowed_lane_kind_codes = ["patient"]`
- **WHEN** a client submits a `PUT /pathways/{id}` payload containing an `email` block whose `lane_id` resolves to a lane with `lane_kind_code = "caregiver"`
- **THEN** the server responds with HTTP 422
- **AND** the error payload identifies the offending `block.id` and the allowed lane kinds

#### Scenario: Task block on either patient or caregiver lane is accepted

- **GIVEN** the catalogue lists `task.allowed_lane_kind_codes = ["patient", "caregiver"]`
- **WHEN** a client submits a `PUT /pathways/{id}` payload containing a `task` block placed on the patient lane
- **THEN** the server responds with HTTP 200
- **AND** the persisted block retains the patient lane assignment

### Requirement: Canvas highlights allowed lanes during drag

While a block is being dragged from the dock or moved within the canvas, every lane row SHALL render in one of three drop states: `valid`, `invalid`, or `idle`. The state MUST reflect whether dropping the in-flight block on that lane would satisfy the block type's `allowed_lane_kind_codes`.

#### Scenario: Dock drag highlights allowed lanes

- **WHEN** the user starts dragging a block-type chip from the dock
- **THEN** every lane whose `lane_kind_code` is in the type's `allowed_lane_kind_codes` SHALL render with the `valid` drop state (accent border + accent-tinted fill)
- **AND** every other lane SHALL render with the `invalid` drop state (reduced opacity + diagonal-stripe overlay)

#### Scenario: Drag end clears drop-state visuals

- **WHEN** the user releases the drag (drop, cancel, or escape)
- **THEN** all lane rows SHALL return to the `idle` drop state within the same frame

#### Scenario: In-canvas move shows the same affordance

- **WHEN** the user begins dragging an existing block within the canvas
- **THEN** lane rows highlight identically to the dock-drag case, using the dragged block's type's `allowed_lane_kind_codes`

### Requirement: Dropping on a disallowed lane cancels the placement

If the user releases a drag over a lane whose `lane_kind_code` is not in the in-flight block type's `allowed_lane_kind_codes`, the system SHALL cancel the placement and surface a non-blocking error to the user. No block SHALL be added to or moved in state on such a drop.

#### Scenario: New block dropped on disallowed lane is discarded

- **WHEN** the user drags a block-type chip from the dock and releases it over a lane whose `lane_kind_code` is not in `allowed_lane_kind_codes`
- **THEN** no `add-block` action is dispatched
- **AND** the user sees a toast error with the key `canvas.invalidLaneDrop`

#### Scenario: Existing block moved to disallowed lane snaps back

- **WHEN** the user drags an existing block and releases it over a lane whose `lane_kind_code` is not in the block type's `allowed_lane_kind_codes`
- **THEN** no `move-block` action is dispatched
- **AND** the block remains at its prior `(phase_id, lane_id, x, y)` placement
- **AND** the user sees a toast error with the key `canvas.invalidLaneDrop`

### Requirement: Cursor reflects drop validity

While a drag is in progress, the cursor over each lane SHALL communicate drop validity: `copy` or `grab` over a `valid` lane, `not-allowed` over an `invalid` lane.

#### Scenario: Cursor switches between valid and invalid lanes

- **WHEN** the user drags a block-type chip and the cursor moves from a valid lane to an invalid lane
- **THEN** the visible cursor changes to `not-allowed`
- **AND** moving back onto a valid lane restores the `copy`/`grab` cursor

