## Context

`pathway-builder-base` ships a block catalogue, lane catalogue, and a free-placement canvas. Each block type carries `default_lane_kind_code` (nullable single hint) that the dock uses to pick a starting lane, but nothing constrains where a block can actually live. Drop targets are computed purely from cursor → flow coordinates. Authors regularly end up with blocks in semantically wrong rows (a patient-only email parked on the system lane), and runtime work has no signal to refuse them.

Current state per file:
- `apps/backend/app/db/models/pathway/block.py` — `PathwayBlock.pathway_lane_id` FK (no constraint vs block type).
- `apps/backend/app/schemas/pathway/catalogue.py` — `PathwayBlockTypeOut.default_lane_kind_code: str | None`.
- `apps/backend/app/services/pathway/catalogue.py` — hard-coded seed entries set one default.
- `apps/orchestrator/src/modules/pathway/components/PathwayBuilderShell.tsx#onAddBlock|onDropBlockType` — picks lane via `lanes.find(default_lane_kind_code)` then falls back to first lane.
- `apps/orchestrator/src/modules/pathway/components/canvas/BuilderCanvasFrame.tsx` + `LaneRow.tsx` — lane render is dumb (no drag-state input).

Stakeholders: pathway designers (humans), backend persistence (refuses garbage), runtime engine consumers (trust lane semantics for caregiver routing).

## Goals / Non-Goals

**Goals:**
- Every block type declares one or more allowed lane kinds.
- Drop UX shows allowed vs forbidden lanes at all times during drag (no surprises).
- Backend rejects payloads where a block sits on a disallowed lane.
- First allowed lane is the implicit default when context is ambiguous.

**Non-Goals:**
- Per-tenant override of allowed lanes (PoC seeds are global).
- Drag-time lane re-assignment via keyboard / accessibility shortcuts (separate change).
- Animated snap-back curve on rejected drop (toast + cancel is enough for PoC).
- Persistent lane lock on individual block instances (allowedness lives on the type, not the row).

## Decisions

### D1 — Multi-lane via `allowed_lane_kind_codes: list[str]` (not enum, not single)

A single allowed lane is too restrictive (Task fits both patient + caregiver). A `CodeableConcept`-style structure is overkill for PoC. List of codes from the existing `pathway_lane_kind` table is the smallest workable shape.

**Why over single field**: Multi was an explicit requirement (Task → patient | caregiver).

**Why list, not jsonb**: Codes are typed strings already; list keeps SQL/JSON ergonomics simple and lets backend validate against the lane-kind table cheaply.

**Default lane resolution**: `allowed_lane_kind_codes[0]`. Seed entries order with the most common placement first.

### D2 — Catalogue column shape (backend)

`PathwayBlockType` is a service-layer dataclass built from a hard-coded dict (no DB row). Replace `default_lane_kind_code: str | None` with `allowed_lane_kind_codes: tuple[str, ...]` on the dataclass and the matching `PathwayBlockTypeOut` schema field becomes `list[str]` (min_length=1). No alembic migration.

If we later persist the catalogue, the column lands as `text[]` with a CHECK constraint that every element exists in `pathway_lane_kind.code`. Out of scope for this change.

### D3 — Server validation point

Resolve lane → lane_kind_code inside `_ResolvedDefinition.from_payload`. For each block, look up `block_type.allowed_lane_kind_codes` and compare against the resolved lane's `lane_kind_code`. Raise a Pydantic-style 422 (`BlockLaneNotAllowedError` with the offending `(block_id, type, lane_kind_code, allowed)`) so the frontend can show a precise error if the client check ever fails.

This sits in the same place as existing lane-kind resolution, so we avoid a second pass over blocks.

### D4 — Client-side drag state model

Introduce `DragContext` (lightweight; lives in `BuilderCanvasFrame` local state, not zustand):
```ts
type DragContext =
  | { kind: 'idle' }
  | { kind: 'new'; typeCode: string; allowedLaneKindCodes: string[] }
  | { kind: 'move'; blockId: string; allowedLaneKindCodes: string[] }
```
- Dock drag-start (HTML5 DnD) → set `kind: 'new'` with the type's allowed lanes.
- ReactFlow node drag-start → set `kind: 'move'` with same.
- Drag-end / drop / leave → set `kind: 'idle'`.

`LaneRow` receives `dropState: 'valid' | 'invalid' | 'idle'` derived from `DragContext`:
- `idle` — current visuals (untouched).
- `valid` — accent border + 6 % accent fill + cursor `copy`/`grab`.
- `invalid` — 30 % opacity + diagonal-stripe overlay (`background-image: repeating-linear-gradient(…)`) + `cursor: not-allowed`.

This keeps all the visual work in `LaneRow` and the state coordination in `BuilderCanvasFrame`. No new top-level context.

**Why not zustand / context**: Drag lifetime is sub-second; no other component cares. Local state survives.

### D5 — Drop-outside-allowed-lane = cancel

Both the dock drop handler (`onDrop` in `BuilderCanvasFrame`) and the ReactFlow `onNodesChange` move handler check whether the target lane is in `allowedLaneKindCodes`. If not:
- Dock-originated drop: skip the `add-block` dispatch entirely, fire `toast.error(t('canvas.invalidLaneDrop'))`. The HTML5 DnD "ghost" disappears naturally once `dragend` fires.
- In-canvas move: don't dispatch `move-block` (the block stays where it was — React Flow re-renders against state and the visual snaps back without animation).

No silent re-routing to the nearest allowed lane. Per user direction: "destroy" the in-flight block on invalid drop.

### D6 — i18n key location

Add `canvas.invalidLaneDrop` next to `canvas.needPhaseFirst` in `nl/pathway.json`. Copy: `"Dit blok past niet in deze rij."` Short, no toast title needed (sonner default is error variant).

### D7 — Seed defaults (initial allowed-lane mapping)

| Block type | Allowed lanes |
|---|---|
| `appointment` | `caregiver` |
| `task` | `patient`, `caregiver` |
| `email` | `patient` |
| `decision` | `system` |
| `milestone` | `system` |
| `timer` | `system` |

Order matters: first entry is the default. Confirmed against `blockTypeDescription` copy and PoC pathway intent (clinical reasoning lives in Luscii sub-flows; our blocks are operational).

## Risks / Trade-offs

- **Seed re-run risk** → existing local databases may have blocks on lanes that are no longer allowed. **Mitigation**: PoC pre-launch; `moon run backend:reset` + `moon run backend:seed` regenerates clean state. No production data.
- **Drag-leave on hidden lanes** → if a phase column is wider than the viewport, dragging beyond visible lanes could land in an unmarked area. **Mitigation**: ReactFlow already clamps drop coords to the pane; LaneRow visuals apply across the full canvas width.
- **HTML5 DnD vs ReactFlow drag** → two different drag systems (dock uses native HTML5, in-canvas uses ReactFlow). **Mitigation**: Centralise `DragContext` and have both systems update it via the same setter; the visual layer doesn't care which source.
- **List ordering as "default" is implicit knowledge** → reviewers may not realise the first entry is the default. **Mitigation**: Add a short note in the catalogue file and a comment on `PathwayBlockTypeOut.allowed_lane_kind_codes`.
- **Future per-tenant overrides** → list-on-type doesn't compose with tenant overrides if those land later. **Mitigation**: When MVP introduces tenant overrides, swap to a resolver function on the service layer; `PathwayBlockType` shape stays as the per-tenant view.

## Migration Plan

1. Land backend shape change + seed update; regenerate `openapi.json`.
2. Land frontend type + UX changes (gated by openapi-typescript regen).
3. `moon run backend:reset && moon run backend:seed` once per dev environment.

No production migration. Rollback = revert PR.

## Open Questions

- Should the toast message name the allowed lanes ("dit blok past in Patient / Zorgteam") instead of a generic "doesn't fit here"? Default to short message; revisit after user testing.
- Do we need a keyboard fallback for accessibility now or after PoC? Defer — `BL-` entry if PoC review flags it.
