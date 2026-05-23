# pathway-config-forms — design

## Context

The pathway builder is a single-page canvas (`PathwayBuilderShell`) with three drawer slots wired to `BuilderState.selection`:

- `selection.kind === 'block'` → `BuilderDrawer` renders block config form
- `selection.kind === 'edge'` → nothing rendered today
- `selection.kind === 'none'` → no drawer

Selection is already mutually exclusive, so the drawer slot stays single — we route on `selection.kind` inside the shell.

`PathwayVersionDefinition` already carries `timing_values`, `time_markers`, `branches` (per source block). The catalogue endpoints `GET /pathway-edge-timing-kinds` and `GET /pathway-edge-offset-directions` shipped in `pathway-block-redesign`. So the inspector renders entirely from data already in the loader response.

## Goals

1. Author can configure any of the three new block types (form / wait / pathway_link) without leaving the builder.
2. Author can pick an edge timing kind and edit the fields of that kind. Switching kind clears the abandoned kind's fields atomically so the backend never sees a mixed-kind edge.
3. The frontend has a typed, parsed view of `block.config` per semantics — no more `asString` / `asArray` shims. Backend/frontend divergence becomes a Zod parse error at one site.

## Non-goals

- Generic schema-driven form renderer reading `ui_schema`. Bespoke forms ship faster, are more readable, and PoC has eight block types not eight hundred.
- Inline authoring of new timing values, markers, or pathways. Authors pick from pre-seeded rows.
- Per-question conditional logic inside the form-block builder (`form.questions[*].depends_on`). Out of PoC scope.

## Architecture

### Drawer routing

`PathwayBuilderShell` renders one of:

```tsx
selection.kind === 'block'
  ? <BuilderDrawer block=… />
  : selection.kind === 'edge'
  ? <EdgeInspector edge=… />
  : null
```

`BuilderDrawer` keeps its current chrome (header + footer with delete + close) and delegates the body to a per-semantic component. `EdgeInspector` is a parallel component with the same chrome shape so the drawer slot feels symmetrical.

### Block inspector dispatch

`BuilderDrawer` switches on `blockType.semantics`:

| Semantics | Component | Notes |
| --- | --- | --- |
| `appointment` | `<AppointmentInspector>` | kind picker + optional location |
| `task` | `<TaskInspector>` | assignee picker (caregiver role) + description |
| `message` | `<MessageInspector>` | channel + subject + body + CTA |
| `form` | `<FormInspector>` | questions list editor |
| `decision` | `<DecisionInspector>` | criterion text + branch labels |
| `milestone` | `<MilestoneInspector>` | note |
| `wait` | `<WaitInspector>` | event_type + timeout_days + on_timeout + source_block_id |
| `pathway_link` | `<PathwayLinkInspector>` | target_pathway_id + mode + context_mapping |

Each inspector signature:

```ts
type Props<S extends BlockSemantics> = {
  block: PathwayBlock
  config: ConfigForSemantics<S>           // parsed by Zod, never `unknown`
  onPatchConfig: (next: ConfigForSemantics<S>) => void
}
```

Inspectors emit typed patches; the shell still dispatches `patch-block` with the raw `BlockConfig` (i.e. `Record<string, unknown>` per the OpenAPI type). Conversion happens in the inspector — Zod schemas are isomorphic for the JSON-serialisable subset we use, so `schema.parse(unknown) → T` and `T → JSON-friendly object` round-trip without surprises.

### Edge inspector

```ts
type Props = {
  edge: PathwayEdge
  version: PathwayVersionDefinition        // for timing_values, time_markers, blocks
  timingKinds: PathwayEdgeTimingKind[]     // from catalogue endpoint
  offsetDirections: PathwayEdgeOffsetDirection[]
  onPatchEdge: (patch: Partial<PathwayEdge>) => void
  onDeleteEdge: () => void
}
```

Renders a segmented control over the four kinds (using `readEdgeTiming(edge).kind` for current state) and a per-kind sub-form:

- `completion`: `<select>` over `version.timing_values` rendered with their natural label (`fixed_days` / `enrollment_*`). On pick, dispatch a patch that sets `delay_value_id` AND nulls `time_marker_id`, `offset_value_id`, `offset_direction_code`, `source_branch_id`.
- `marker`: three controls — marker `<select>` over `version.time_markers`, offset value `<select>` over `version.timing_values`, direction segmented control over `offsetDirections`. Patch sets all three; nulls the other kinds.
- `immediate`: no controls. Patch nulls every timing column.
- `branch`: `<select>` over the source block's `branches` (looked up via `edge.source_block_id`). Patch sets `source_branch_id`; nulls the others.

This is where the "exactly one timing union" invariant gets enforced **client-side**. The reducer's `patch-edge` action accepts a `Partial<PathwayEdge>` but the inspector always emits a full reset of the union columns — that way the reducer never produces an invalid mixed-kind edge from a careless caller. Backend keeps its 422 validation as the authoritative gate, but the UI doesn't rely on the round-trip to scrub state.

### `patch-edge` reducer action

Mirrors `patch-block`:

```ts
case 'patch-edge': {
  const history = pushHistory(state)
  const edges = (state.version.edges ?? []).map((e) =>
    e.id === action.edgeId ? { ...e, ...action.patch } : e,
  )
  return { ...state, version: { ...state.version, edges }, history }
}
```

History snapshot already covers edges (see `snapshot()` in `useBuilderState.ts`), so undo/redo of timing-kind switches is free.

### Per-semantic Zod schemas

```ts
// configSchemas.ts
import { z } from 'zod'

const FormQuestion = z.object({
  id: z.string(),
  type: z.enum(['text','long_text','single_choice','multi_choice','scale','date','file']),
  label: z.string(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
})

const ConfigBySemantics = {
  appointment: z.object({ kind: z.string().optional(), location: z.string().optional() }),
  task: z.object({ assignee: z.string().optional(), description: z.string().optional() }),
  message: z.object({
    channel: z.enum(['email','sms','push','in_app']),
    subject: z.string(),
    body: z.string(),
    cta_label: z.string().optional(),
    cta_target: z.string().optional(),
  }),
  form: z.object({ questions: z.array(FormQuestion).default([]) }),
  decision: z.object({ criterion: z.string().optional() }),
  milestone: z.object({ note: z.string().optional() }),
  wait: z.object({
    event_type: z.enum(['pathology_report','scan_report','lab_result','external_data']),
    timeout_days: z.number().int().positive().optional(),
    on_timeout: z.enum(['advance','escalate']).optional(),
    source_block_id: z.string().uuid().optional(),
  }),
  pathway_link: z.object({
    target_pathway_id: z.string().uuid(),
    mode: z.enum(['blocking','fire_and_forget']),
    context_mapping: z.record(z.string(), z.string()).default({}),
  }),
} satisfies Record<BlockSemantics, z.ZodTypeAny>

export type ConfigForSemantics<S extends BlockSemantics> = z.infer<(typeof ConfigBySemantics)[S]>

export function parseBlockConfig(block: PathwayBlock, semantics: BlockSemantics) {
  return ConfigBySemantics[semantics].parse(block.config ?? {})
}
```

Why a `satisfies` record over a discriminated union of `z.object`s: the OpenAPI client gives `block.config` as `Record<string, unknown>` with no discriminator field — `block.semantics` lives on the block-type, not the block. The lookup pattern `Schemas[block_type.semantics].parse(block.config)` matches that shape directly.

### Pathway picker

`PathwayLinkInspector` needs to pick a target pathway. PoC uses `usePathwaysQuery()` (already exists for the pathway list page) and renders a native `<select>` over `(id, name)`. No autocomplete, no virtualisation. Sorted by `updated_at` desc.

### What about RJSF for the unchanged inspectors?

`appointment` / `task` / `message` / `decision` / `milestone` already work through `ConfigForm` (RJSF + AJV). We could leave them on RJSF and only build bespoke for the three placeholders. Trade-off:

| Option | Pro | Con |
| --- | --- | --- |
| Bespoke for all | One inspector per semantics, consistent feel | More code, but each file stays small |
| RJSF for the existing five | Less code | Two rendering paths in one drawer; Zod schemas don't get exercised for those five |

**Choice: bespoke for all eight.** The existing RJSF inspectors are already cramped and the JSON-Schema → field-order mapping has been a friction point. Bespoke forms exercise the Zod schemas (otherwise `appointment` / `task` config still goes unparsed) and we drop the `@rjsf/*` runtime cost. `ConfigForm.tsx` deletes; `@rjsf/core`, `@rjsf/utils`, `@rjsf/validator-ajv8` come out of `package.json`.

## Edge cases

- **Edge selected, then its source block deleted.** `findSelectedEdge` returns the edge; inspector renders. But `branch` sub-form needs source block branches — handle by treating a missing source block as "no branches available" and showing a disabled state. The edge gets cleaned up by `delete-block` already (filters edges where `source_block_id === blockId`), so the dangling-selection window is one render.
- **Switching kind from `branch` on an edge whose source block has no branches** — the segmented control allows pick; the sub-form shows empty list; patch isn't dispatched until author picks something. No invariant violation possible because edge keeps current values until the patch lands.
- **`block.config` fails Zod parse.** Means backend stored config that doesn't match the schema (data divergence). Inspector shows an error banner inside the drawer body with the Zod error message and a "reset to default" button that dispatches `patch-block` with the schema's default value. Better than silent rendering of stale state.

## Testing

- **Unit (Vitest)** — one test per inspector covering "renders fields from current config" and "dispatches typed patch on change".
- **Reducer** — `patch-edge` happy path + history push.
- **Schemas** — round-trip per semantics (parse → serialize → parse equality), plus one failing fixture per schema.
- **No new Playwright** — same blocker as `pathway-block-redesign` 11.4 (MSW pathway handlers + builder e2e harness not built yet). Tracked under the same follow-up.

## Open questions

- Should the edge inspector live in the same physical drawer as the block inspector, or pop a second side-panel? **Default: same drawer.** Selection is mutually exclusive, parallel UI is simpler.
- `pathway_link.context_mapping` — string→string for PoC, but `field_path → field_path` once we have a field model. Note in code, no schema change.
- `form.questions` editing — drag-reorder via dnd-kit, or up/down buttons? **Default: up/down buttons** for PoC; dnd-kit if it lands cheaply.
