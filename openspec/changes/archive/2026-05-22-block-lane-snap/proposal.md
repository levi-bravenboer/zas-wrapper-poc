**Tier**: [poc]

## Why

The pathway builder currently lets any block type be dropped in any lane. The catalogue exposes a single `default_lane_kind_code` hint but nothing enforces it — a `Decision` block can land in the patient lane, a `Task` can land on the system row. Authors discover the right placement by trial and error, and bad data leaks through to runtime. We need block types to declare which lane(s) they belong in and the canvas to make that explicit during drag.

## What Changes

- **BREAKING (catalogue shape)**: Replace `default_lane_kind_code: string | null` on `PathwayBlockType` with `allowed_lane_kind_codes: list[str]` (one or more codes). The first entry is the default placement when context is ambiguous.
- Pathway-block-catalogue seed updates each block type to declare its allowed lanes (e.g. `appointment: [caregiver]`, `email: [patient]`, `task: [patient, caregiver]`, `decision: [system]`).
- Server-side validation on `PUT /pathways/{id}`: every block's resolved `lane_id` must map to a `lane_kind_code` in the block type's `allowed_lane_kind_codes`. Reject with 422 otherwise.
- Client-side enforcement in the builder canvas:
  - On drag-start from the dock or in-canvas: read the block type's allowed lanes. Highlight valid lane bands; dim invalid lanes; show a `not-allowed` cursor over invalid lanes.
  - Drop on an allowed lane → place at cursor (existing behaviour).
  - Drop outside any allowed lane → cancel the drop; the in-flight block (or moved block's original placement) is discarded / snapped back. No silent re-routing.
- Toast feedback when an invalid drop is cancelled (`canvas.invalidLaneDrop`).
- No data migration: PoC pathways are seeded; we re-seed with the new shape.

## Capabilities

### New Capabilities

- `block-lane-snap`: Per-block-type lane constraint model + canvas drag/drop affordance enforcing it.

### Modified Capabilities

<!-- None — pathway-builder and pathway-domain specs are still in flight (changes/pathway-builder-base). This change ships as a new capability that composes with them once they archive. -->

## Impact

- **Backend**
  - `app/schemas/pathway/catalogue.py` — replace single-lane field with list on `PathwayBlockTypeOut`.
  - `app/services/pathway/catalogue.py` (seed builder) — update each entry with its allowed lanes.
  - `app/services/pathway/pathway_service.py` — add lane-allowedness check inside `_ResolvedDefinition.from_payload` (or sibling validator); 422 envelope.
  - `app/schemas/pathway/pathway.py` — `PathwayBlockIn.lane_id` now validated against catalogue mapping at service layer (schema stays the same).
  - `openapi.json` regenerates after the shape change.
- **Frontend**
  - `apps/orchestrator/src/modules/pathway/types.ts` — `PathwayBlockType.allowed_lane_kind_codes: string[]` (typed via openapi-typescript).
  - `apps/orchestrator/src/modules/pathway/blockCatalogue.tsx` — drop `default_lane_kind_code` reads; resolve default = `allowed_lane_kind_codes[0]`.
  - `apps/orchestrator/src/modules/pathway/components/PathwayBuilderShell.tsx` (`onAddBlock`, `onDropBlockType`) — choose default lane from allowed list; reject if target lane is not allowed.
  - `apps/orchestrator/src/modules/pathway/components/canvas/BuilderCanvasFrame.tsx` + dock — track in-flight block type during drag, expose allowed-lane state to lane visuals.
  - `apps/orchestrator/src/modules/pathway/components/canvas/LaneRow.tsx` — accept `dropState: 'valid' | 'invalid' | 'idle'`; valid state = subtle highlight border + accent fill; invalid state = dim + striped overlay + `cursor: not-allowed`.
  - New i18n key: `canvas.invalidLaneDrop` (Dutch).
- **Tests**
  - Backend: catalogue seed test (shape), service test (reject block with disallowed lane).
  - Orchestrator: vitest for `BuilderCanvasFrame` lane-highlight state on drag; reducer test that drop outside allowed lanes does not mutate state.
- **No data migration** — PoC seed re-runs.
