# Design — patient-pathway-visuals

Front-end presentation restyle of the **patient Zorgpad summary banner** — the `PathwayTimeline` card rendered at the top of `PatientProfilePage`, **above** the tab bar (`PatientProfilePage.tsx:127`). No backend or contract changes.

## What this is (and is not)

The target is the **compact summary banner** above the patient tabs. It is a fast glance, NOT a full view — the **Zorgpad detail tab** owns the full graph, all steps, actions, dates, results, and editing. The banner answers only three things: **what just happened · where is the patient now · what's next.**

**Hard constraints (user):**
- Keep the current compact footprint (≤ +20% height).
- Keep it *calm* — a caregiver glances; intensity (anchors, attention strips, phase rails, role panels, per-block enumeration) belongs in the detail tab, not the banner.

## Chosen shape — trail window around NOW (locked, v10)

Iterated through prototypes: full vertical timeline (too tall), restyled full horizontal stepper (scrolls / lies about branches on freely-built pathways), dense adaptive summary with focus columns + phase rail + anchors (too intense), 3 isolated slots (lost the journey — a single "last step" reads thin). **Chosen: a compact horizontal stepper showing a bounded WINDOW around the current step**, with overflow pills at the ends —

```
┌ Zorgpad banner ─────────────────────────────────────────────────────────┐
│ [Actief] Blaaskanker · Fase Besluit tot biopsie            4/9 afgerond  │
│ ▰▰▰▰░░░░░                                                                │
│  (+2)──(✓)─────(✓)─────(◉)─────(○)─────(+2)                              │
│  afgerond  Scan    MDO       MDO        Uitslag   te gaan                │
│            beoord.  voorber.  diagnost.  bespreken                        │
│                              2d te laat                                   │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Header line:** status badge + pathway name + current phase + "X/N afgerond" + a thin meter.
- **Trail:** a horizontal stepper of the steps within `WINDOW` (=2) on each side of NOW — every node on one centerline (half-line · node · half-line per cell), name + one-line sub below. Connectors are teal up to NOW, neutral after.
- **End pills:** when steps fall outside the window, a dashed `+N afgerond` pill leads and a `+N te gaan` pill trails — so the journey and the full size both read at a glance.
- No phase rail, no anchor chips, no attention strip, no hover popovers — all that is the detail tab's job.

## Why a bounded window is right for fluid pathways

Pathways are freely authored (3–30+ blocks, branches, parallel fans, nested subpaths). The window is computed from the **ordered executions of the taken path** + the active index, so it is shape-agnostic and fixed-footprint by construction (always ≤ `2·WINDOW+1` nodes + up to two pills). A short pathway shows entirely with no pills; a long one shows the same compact window. See the data table below.

## Visual language — match the runtime canvas, not the builder

The merge of `feat/pathway-enrollment-runtime` landed the **detail tab as a runtime canvas** (`ZorgpadTab → EnrollmentCard → runtime-canvas/`: `RuntimeCanvas`, `RuntimeBlockNode`, `RuntimePhaseLayer`, `RuntimePlayhead`, `RuntimeLegend`, `useRuntimeGraph`, `runtimeState.ts`). That surface already set the **patient-side** block language, and it deliberately **drops lane swimlanes** — the rail conveys *runtime state*, not lane. The summary banner is that surface's compact sibling, so it adopts the **same language** (supersedes the lane-accent direction explored in prototypes v2–v8):

- Reuse `RUNTIME_STATE_COLOR` (`finished`=success, `active`=primary, `upcoming`/`pending`=border) + `BlockTypeIcon`, mirroring `RuntimeBlockNode`'s compact styling.
- **Finished** — calm: success-tinted icon tile + success check badge; sub shows `completedAt · completedByName`.
- **NOW (`active`)** — the only loud node: primary fill/border + shadow + ring (red ring + "Nd te laat" when `due_at < now`).
- **Upcoming** — hollow: card bg + border, muted icon.
- **Skipped** (dead branch) — line-through, dimmed (only when in window; usually pruned out anyway).

## Node styling source of truth

Rather than a new `BlockGlyph`, the trail node is a **compact variant of `RuntimeBlockNode`** sharing `RUNTIME_STATE_COLOR` + `BlockTypeIcon`. (Phase tint / day chip stay in the detail canvas, not the banner.)

## Components

- `PathwayProgressHeader.tsx` — compact current-phase + step n/N line, derived from buckets.
- `PathwayStepNode.tsx` — one builder-flavoured stepper node (icon, lane accent, bucket state, optional day chip).
- `PathwayProgress` (existing, in `PathwayTimeline.tsx`) — restyled to compose the header + node row; stays horizontal.
- Reuse builder primitives (`BlockTypeIcon`, `laneAccent`, `phaseTint`, day-chip styling) by import; extract to shared module only if an import cycle forces it.

## Component architecture

The banner is **fluid**: pathways are freely authored (3–30+ blocks, branches/XOR, parallel AND-fans, nested subpaths, varying phases/lanes/anchors). So nothing is per-pathway hardcoded — every piece derives from runtime + the pinned template, and the layout has a **fixed footprint** that summarises rather than enumerates.

### Layer 1 — Shared UI primitives (`components/ui/*`) — reuse, no new shadcn primitive

- `Card` (banner shell), `Badge` (status pill), `Button`, `Skeleton` (loading). All already in the closed primitive set — nothing to add (keeps the set lean per the project's primitive rule). The banner needs no Alert/Tooltip/Popover — that density lives in the detail tab.

### Module restructure (decided) — `modules/pathway/{shared,builder,patient}`

Today the pathway domain is split across two modules: `modules/pathway/` (builder) and `modules/patient-pathway/` (patient runtime view). They are two sides of one domain, with a shared visual/data vocabulary. Restructure into a single domain module with three sub-areas:

```
modules/pathway/
  shared/    — cross-side vocab: types.ts, api.ts (getPathwayVersion), theme.ts
               (laneAccent/phaseTint + lane/phase tokens), blockTypeIcon.tsx,
               DayChip.tsx, BlockGlyph.tsx (new), blockCatalogue.utils.ts
  builder/   — everything builder-only (canvas, dialog, dock, drawer, subbar,
               topbar, version, shell, blockCatalogue.tsx, canvasLayout.ts, …)
  patient/   — former modules/patient-pathway/ (api, hooks, keys, components/…,
               utils/buckets.ts) + the new summary components below
```

Rules: `builder/` and `patient/` may both import `shared/`; they do **not** import each other. This kills the "patient reads builder internals" coupling and gives the block "face" a single home.

This is a **behaviour-preserving move** — no logic changes, presentation modules only, **not** the carepath datalayer. Because most intra-module imports are relative, a bulk `git mv` keeps them valid; only absolute `@/modules/pathway/*` (≈6 files) and `@/modules/patient-pathway/*` (≈1 file) consumers + the shared-vocab importers (≈12, relative) need path fixups. **Do it as its own behaviour-preserving commit first** (see tasks Phase 0), then build the feature — and mind the 7 in-flight `pathway-*` branches when timing the merge.

### Layer 2 — Vocabulary the summary reuses

- `BlockTypeIcon` (in `shared/` after the move) — block-kind → icon; already consumed by builder `BlockNode` **and** `RuntimeBlockNode`.
- `RUNTIME_STATE_COLOR` + `deriveBlockStatus` (from `patient/.../runtime-canvas/runtimeState.ts`) — the patient runtime's state→colour map and status derivation; the summary reuses both so banner and detail tab agree.
- (lane/phase theme + `DayChip` still move to `shared/` for the builder + runtime canvas, but the **summary banner does not use them**.)

No new `BlockGlyph` — the trail node is a compact variant of `RuntimeBlockNode`'s styling.

### Layer 3 — Feature-local components (`modules/pathway/patient/components/`)

Compose Layer 1 + 2; live only here:

- `PathwayEnrollmentSummary` — banner orchestrator (header + meter + windowed trail + a compact state legend mirroring `RuntimeLegend`); replaces the inline `PathwayProgress` role inside `PathwayTimeline.tsx`.
- `PathwaySummaryHeader` — status badge + pathway name + current phase + "X/N afgerond" + thin meter.
- `PathwayTrailNode` — one stepper cell: half-line · icon node · half-line, with name + one-line sub below; styled from `RUNTIME_STATE_COLOR` (finished success / now primary+ring / upcoming muted); overdue red sub on now.
- `PathwayTrailOverflow` — a dashed `+N afgerond` / `+N te gaan` end-pill cell.
- `summary.ts` (pure selectors) — derives the window view-model `{ phaseName, done, total, window: Cell[], beforeHidden, afterHidden }` from the ordered executions + template. **Reuses `deriveBlockStatus`** (runtime status incl. `completedAt`/`completedByName`/`skipped`) rather than re-bucketing; does not modify `runtimeState.ts` or `utils/buckets.ts`.

(Anchors, attention, phase rail, per-step detail, hover — explicitly NOT in the banner; the Zorgpad detail tab owns them.)

## Data & fluidity — runtime + builder

Two inputs, joined on `block_template_id` (exactly as `PathwayProgress` does today):

- **Builder template** (pinned pathway version, read via `getPathwayVersion`): per block → `kind`, `name`, `lane`, `phase`, participant `role`, `timing_policy`, completion criterion, block-type icon. The authored *shape*.
- **Runtime** (read via `usePatientEnrollments`): per `BlockExecution` → `state`, `scheduled_at`/`due_at`/`completed_at`, `result_json`, `decision_output`, `completed_by_name`; `Enrollment.state`; `deferred_values` (enroll-set clinical dates, e.g. `operation_date`). The actual *progress*.

`summary.ts` derives the window view-model — never a per-pathway assumption:

| View element | Derived from | Fluid because |
|---|---|---|
| "X/N afgerond" + meter | bucket counts over executions | counts work for any size |
| Current phase | phase of the active (first non-finished) execution | any number of phases |
| NOW index | first `active`/`next` execution in the ordered taken path | one anchor; parallel fans pick the first, others fall into the trail |
| Window cells | executions in `[now−WINDOW, now+WINDOW]` | bounded → ≤ `2·WINDOW+1` nodes regardless of pathway size |
| Lead pill `+N afgerond` | count of finished before the window | collapses arbitrary history into one pill |
| Trail pill `+N te gaan` | count of steps after the window | collapses arbitrary future into one pill |
| Connector tint | teal up to NOW, neutral after | reads progress direction |
| Overdue sub | `due_at < now` on the active execution | — |
| Done sub | `completedAt` · `completedByName` (from `deriveBlockStatus`) | reuses runtime status, no extra fetch |
| Branch handling | executions exist only for the **taken** path; `skipped` (dead-branch) status is excluded from the trail | XOR/branches/nested subpaths handled natively — no graph-walking |

Because the trail is bounded to a window + two pills + a header line, a 3-block linear pathway (no pills) and a 30-block branching one render in the **same compact footprint**; depth lives one click away in the Zorgpad detail tab.

## Out of scope / unchanged

Bucket logic (`utils/buckets.ts`), caregiver actions, enrollment-value editing, inbox wiring, data hooks, and **all carepath datalayer** (runtime contracts, schemas, APIs). The full Zorgpad tab is a separate surface; this change is the summary banner only.

## Open questions (resolve via prototype)

- Long pathways: keep horizontal scroll, or condense far-future into a "+N" affordance (presentational only)?
- Does the under-track phase cue earn its pixels, or is the progress-line phase name enough?
- Day chip on now/next only, or also on upcoming when a date exists?
