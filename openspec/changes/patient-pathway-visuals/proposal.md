**Tier**: [poc]
**Parent**: `pathway-patient-runtime` (defines the Zorgpad tab + `PathwayTimeline`; this change restyles its rendering)

## Why

`pathway-patient-runtime` shipped the patient Zorgpad **summary banner** — the `PathwayTimeline` card rendered at the top of `PatientProfilePage`, **above** the tab bar (`PatientProfilePage.tsx:127`). For each active enrollment it renders a horizontal stepper of bucketed executions (`finished` / `next` / `upcoming`, see `patient-pathway-tab` + `utils/buckets.ts`). It is functional but visually thin — a row of numbered circles with a connecting line. Two problems:

- **It does not feel like the builder.** The pathway builder canvas has a rich, recognisable visual language: block cards with a lane-accent rail, a tinted block-type icon, and a day chip for timing. A caregiver who authored the pathway in the builder sees something unrelated when they open the patient. The two surfaces should rhyme.
- **"Where is this patient now?" does not pop.** The caregiver's primary question is not called out; the current step reads like every other circle.

This change restyles the summary banner into a **compact trail window around the current step** — a header line (status + pathway name + current phase + "X/N afgerond" + thin meter) and a small horizontal stepper showing a bounded window of steps (≈2 each side of NOW): the recent finished steps → the current step → the next steps, with dashed **`+N afgerond`** / **`+N te gaan`** pills at the ends collapsing the rest. Each node uses the **patient runtime visual language** the detail tab already established (block-type icon + runtime-state colour, reusing `deriveBlockStatus`/`RUNTIME_STATE_COLOR`); only the NOW node is loud, and an overdue current step is flagged inline.

**Constraints (user):** it is a fast *glance*, not a view — the **Zorgpad detail tab** owns the full graph, all steps, dates, results, and editing. Keep the compact footprint (≤ +20% height) and keep it calm: no phase rail, anchor chips, attention strips, or per-block enumeration in the banner.

It is a **front-end presentation change only**. The runtime data contract, the three-bucket classification (`utils/buckets.ts`), the per-block caregiver actions, the enrollment-value editing, and the `/tasks` inbox wiring from `pathway-patient-runtime` are all unchanged — only how the steps are laid out and styled changes.

## What Changes

### Modified frontend capability — `patient-pathway-tab`

- The per-enrollment `PathwayProgress` (today a horizontal `<ol>` stepper of numbered circles) is replaced by a **bounded trail window** within the current footprint (≤ +20% height):
  - **Header line:** status badge + pathway name + current phase + "X/N afgerond" + thin meter.
  - **Trail:** the ordered executions within ≈2 steps of the current one, each node carrying the block's **`BlockTypeIcon`** in **runtime-state colour** (`RUNTIME_STATE_COLOR`), on a single centerline. Finished = calm success tint + check (+ `completedAt · completedByName`); NOW = the only loud node (primary + ring; red ring + inline "Nd te laat" when `due_at < now`); upcoming = muted. Connectors are teal up to NOW.
  - **End pills:** `+N afgerond` (finished before the window) and `+N te gaan` (steps after) as dashed end-cells; absent on short pathways that fit entirely.
- Everything heavier — full step graph, all dates, results, role panels, editing — stays in the **Zorgpad detail tab**, not the banner.
- The enrollment card chrome (state badge, manage toggle, `EnrollmentCard`, `EnrollDialog`) and the empty / loading / error states are preserved; only the inner step rendering changes.
- No change to data flow: still reads `usePatientEnrollments` + `getPathwayVersion`, still buckets via `utils/buckets.ts`, still resolves block names from the pinned pathway version.

## Capabilities

### Modified Capabilities

- `patient-pathway-tab` — the enrollment step rendering becomes a compact builder-flavoured trail window around the current step (header line + bounded stepper + end pills). Bucket semantics, actions, and data contract unchanged.

## Impact

- **No module restructure, no `shared/` folder.** The existing `modules/pathway/` (builder) ↔ `modules/patient-pathway/` (patient runtime) boundary is the split; the feature lands in `modules/patient-pathway/`. Genuinely generic, content-agnostic bits may be promoted to a reusable `components/` primitive — domain bits stay in the module.
- **Frontend only** (`modules/patient-pathway/`):
  - new `summary.ts` (reuses `deriveBlockStatus`), `components/{PathwayEnrollmentSummary,PathwaySummaryHeader,PathwayTrailNode,PathwayTrailOverflow}.tsx` + tests; `components/PathwayTimeline.tsx` rewires `PathwayProgress` → `PathwayEnrollmentSummary`.
  - reuses existing vocab — `deriveBlockStatus` + `RUNTIME_STATE_COLOR` (own runtime-canvas) and `BlockTypeIcon` (`@/modules/pathway/blockCatalogue`). No new `BlockGlyph`, no builder restyle, no module move.
  - `lib/i18n/locales/nl/patient-pathway.json`: new keys.
- **No backend, no DB, no migration, no API change, no `runtimeState.ts`/`utils/buckets.ts` change.** Pure presentation.
- **HTML prototypes**: `openspec/changes/patient-pathway-visuals/prototypes/pathway-visuals/vN.html` (v8 = locked look). Iterate as new `vN.html`; never edit prior versions.

## Out of scope

- A read-only React Flow mini-canvas mirroring the builder (lanes/phases/edges with pan/zoom) — considered and rejected as too heavy to scan for a read-only patient view.
- Any change to the bucket classification, block caregiver actions, enrollment-value editing, or `/tasks` inbox wiring (owned by `pathway-patient-runtime`).
- Mobile / patient-facing rendering (out of orchestrator scope).
- Showing completed/cancelled enrollments (still dropped per `patient-pathway-tab`).
