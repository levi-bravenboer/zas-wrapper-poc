## Context

The pathway block-type catalogue is currently a closed set keyed by the `pathway_block.type` enum (see `pathway-block-redesign`). All semantics, `config_schema`, `ui_schema`, and `allowed_lane_kind_codes` live in backend code and DB migrations. The clinical roadmap wants Luscii care paths to appear as pathway blocks today, with HiX or registry-backed blocks following the same pattern. A Luscii-specific carve-out would duplicate the catalogue contract and bleed vendor names into core builder code.

Adapter scaffolding already exists for ping-style vendor protocols (`external-adapters` spec: `HixClient`, `LusciiClient` with stub/live mode toggles). What does not exist is a way for those adapters to publish *block-shaped capabilities* into the pathway catalogue.

Research on Luscii's API surface (`docs/research/luscii-care-pathways-research.md`) confirms two boundaries that shape this design:

1. **A Luscii care path is a Program.** Programs are the single primitive Luscii exposes via the Public API (`GET /v1/programs`). Questionnaires, measurements, alert thresholds, and education content all live *inside* a program — they are not API-addressable on their own. An earlier draft of this proposal mistakenly modelled three separate kinds (`questionnaire`, `monitoring_program`, `education_module`); that was wrong and has been replaced with a single `program` kind.
2. **Per-patient customisation happens only at enrollment runtime.** Clinical parameters (alert thresholds, measurement cadence) are fixed in the program. The only per-patient values Luscii accepts are demographics, locale, contact info, and FHIR identifier — all captured at `POST /v1/patients` time. Pathway authors therefore have nothing useful to set per-patient at build time, and our block config must not pretend otherwise.

## Goals / Non-Goals

**Goals:**

- One generic seam through which any external provider contributes pathway blocks, with the builder treating them uniformly.
- Backend registry of providers + the block kinds each provides; namespaced codes (`<provider>.<kind>`) so the existing block-type primary key stays a single string.
- API symmetry: external entries appear in the same `GET /pathway-block-types` response as native ones, distinguished by structured metadata (`source: "native" | "external"`, `provider`, `kind`).
- Frontend renders the inspector for external blocks via the existing JSON-schema form renderer — zero vendor-specific React.
- Luscii lands as the first provider with stub fixtures only, contributing a single `program` kind.
- Encode the per-patient-vs-pathway-author boundary in the contract: block config schemas declared by adapters carry author-time fields only.

**Non-Goals:**

- Live Luscii HTTP client, OAuth, patient-data ingestion, or webhook delivery. Stub adapter returns hard-coded fixtures.
- Versioning of external block definitions across pathway snapshots (separate problem — see Open Questions).
- Editing the external content from inside our builder. The block stores a *reference* (`luscii.program` + `programId` + `protocolId`); editing happens in the vendor product.
- Nested pathway-as-block — covered by the sibling `nested-pathway-blocks` change.
- **Per-patient configuration at build time.** The block config never asks the pathway author for per-patient values (BP targets, dosing, contact details). Those are filled by the caregiver at runtime against the enrollment endpoint.

## Decisions

### Namespaced block-type codes

Block-type codes use dotted form for external entries (`luscii.program`) and bare form for native (`appointment`). The existing `pathway_block.type` column stays `TEXT`; the CHECK constraint widens from a closed enum to `type ~ '^[a-z_]+(\.[a-z_]+)?$'` plus FK-style validation in the application layer.

Alternative considered: separate `external_block_ref_id` column. Rejected — doubles the catalogue lookup paths, complicates the existing lane-allowed-kinds join, and forces the frontend to branch on every block.

### One `program` kind for Luscii (no sub-kinds)

The Luscii provider declares exactly one capability: `kind='program'`. The block's `config_schema` carries `program_id` + `protocol_id` references; the runtime resolves the program's instruments, alert thresholds, and education content via `resolve_block(...)` at inspector-open time for read-only display.

Alternative considered: split into `questionnaire`, `monitoring_program`, `education_module`. Rejected — these don't map to Luscii's API surface. `GET /v1/programs` is the only enrollment-addressable resource; sub-elements (`program-actions`, `program-moments`) are read-only descriptors of *what's inside* a program, not separately enrollable. Modelling them as distinct block kinds would force us to invent a wrapper that doesn't correspond to any real Luscii operation.

### Luscii program data layer — `luscii_program` table

The Luscii adapter (stub today, live later) does NOT load programs from filesystem fixtures. Both modes read from a dedicated DB table — `luscii_program` — keyed by Luscii's own program id, with the entire program payload stored as a single `JSONB` column. This makes the stub→live swap a pure write-path change: stub mode seeds the table at boot/migration time; live mode (future) fetches from Luscii's API and upserts into the same table. The read path is identical for both.

**Table shape (deliberately minimal):**

```sql
CREATE TABLE luscii_program (
  id          TEXT PRIMARY KEY,         -- Luscii's program id (e.g. "luscii-hartfalen-monitoring-v4")
  data        JSONB NOT NULL,           -- entire LusciiProgramData payload (see below)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional GIN index on data for future filter queries (deferred — not needed for v1)
```

No separate columns for `name`, `version`, `protocols`, etc. — all live inside `data`. The id mirrors Luscii's id so foreign references (`pathway_block.config.program_id`) point at the same string in both stub and live mode.

**`LusciiProgramData` payload shape (the contract):**

```json
{
  "id": "luscii-hartfalen-monitoring-v4",
  "name": "Hartfalen thuismonitoring",
  "description": "Daily monitoring for chronic heart failure with weekly KCCQ.",
  "version": "v4.2",
  "version_published_at": "2026-05-08T00:00:00Z",
  "ce_class": "IIa",
  "is_two_way_messaging": true,
  "enrolled_count_org_wide": 248,

  "protocols": [
    {
      "id": "proto-std-12w",
      "name": "Standaard 12 weken",
      "duration_weeks": 12,
      "reminder_cadence": "daily 09:00",
      "overdue_hours": 48,
      "is_default": true
    },
    {
      "id": "proto-intensief-16w",
      "name": "Intensief 16 weken",
      "duration_weeks": 16,
      "reminder_cadence": "twice daily",
      "overdue_hours": 24,
      "is_default": false
    }
  ],

  "instruments": [
    { "code": "bp",       "label": "Bloeddruk",  "cadence": "1×/dag",  "icon": "heart-pulse" },
    { "code": "weight",   "label": "Gewicht",    "cadence": "1×/dag",  "icon": "scale" },
    { "code": "spo2",     "label": "Saturatie",  "cadence": "1×/dag",  "icon": "droplets" },
    { "code": "kccq",     "label": "KCCQ",       "cadence": "1×/week", "icon": "clipboard-list" }
  ],

  "alert_thresholds": [
    { "label": "Syst. BP",         "rule": "< 90 of > 180" },
    { "label": "Gewichtstoename",  "rule": "≥ 2 kg / 48u" },
    { "label": "Inactiviteit",     "rule": "≥ 3 dagen geen meting" }
  ],

  "care_network": "Cardioloog + monitoring-verpleegkundige · escalatie naar SEH bij prio HIGH",

  "layout": {
    "phases": [
      { "id": "p1", "ord": 0, "label": "Onboarding" },
      { "id": "p2", "ord": 1, "label": "Pre-op" },
      { "id": "p3", "ord": 2, "label": "Monitor" },
      { "id": "p4", "ord": 3, "label": "Close-out" }
    ],
    "lanes": [
      { "id": "l1", "ord": 0, "kind": "patient" },
      { "id": "l2", "ord": 1, "kind": "caregiver" },
      { "id": "l3", "ord": 2, "kind": "external" },
      { "id": "l4", "ord": 3, "kind": "system" }
    ],
    "nodes": [
      { "id": "n1", "phase_id": "p1", "lane_id": "l4", "x": 70, "y": 26, "label": "Welkomstmail",       "type": "message",       "timing_label": "D0",                 "is_entry": true },
      { "id": "n2", "phase_id": "p2", "lane_id": "l1", "x": 70, "y": 26, "label": "Intake-vragenlijst", "type": "form",          "timing_label": "D1" },
      { "id": "n3", "phase_id": "p2", "lane_id": "l2", "x": 70, "y": 26, "label": "Telefonische intake","type": "appointment",   "timing_label": "D2" },
      { "id": "n4", "phase_id": "p3", "lane_id": "l1", "x": 70, "y": 26, "label": "Bloeddruk meting",   "type": "measurement",   "timing_label": "W1-12 · 1×/dag" },
      { "id": "n5", "phase_id": "p3", "lane_id": "l3", "x": 70, "y": 26, "label": "KCCQ wekelijks",     "type": "questionnaire", "timing_label": "W1-12 · 1×/wk" },
      { "id": "n6", "phase_id": "p3", "lane_id": "l2", "x": 70, "y": 26, "label": "Review alerts",      "type": "task",          "timing_label": "async · ≥ med" },
      { "id": "n7", "phase_id": "p4", "lane_id": "l1", "x": 70, "y": 26, "label": "Monitoring afgerond","type": "milestone",     "timing_label": "W12" }
    ],
    "edges": [
      { "id": "e1", "source": "n1", "target": "n2" },
      { "id": "e2", "source": "n2", "target": "n3" },
      { "id": "e3", "source": "n3", "target": "n4" },
      { "id": "e4", "source": "n3", "target": "n5" },
      { "id": "e5", "source": "n5", "target": "n6" },
      { "id": "e6", "source": "n4", "target": "n7" }
    ]
  }
}
```

**Layout coordinate model — mirrors `PathwayBlock`:**

Each `layout.nodes[]` entry carries `phase_id` + `lane_id` (cell coords) + `x` + `y` (intra-cell pixel offsets in Luscii's own coordinate space). This is the exact same model `pathway_block` uses (`apps/orchestrator/src/modules/pathway/canvasLayout.ts` → `blockOrigin`). The thumbnail renderer reuses the `blockOrigin`-style math, scaled to its viewBox: compute mini-geometry from phase + lane counts, then apply x/y proportionally.

Benefit: the renderer becomes a generic "draw a mini-canvas given (phases, lanes, blocks-with-xy, edges)" — reusable for `nested-pathway-blocks` (same model: nested pathway IS a pathway). No new positioning abstraction.

**Why this shape:**

- The `layout` sub-object drives both thumbnail sizes (small silhouette uses `phases.length × lanes.length × nodes` positions only; large labeled version uses `nodes[].label + timing_label + type`). One payload, two renderings.
- The `protocols` array drives the protocol picker in the inspector. The default is marked explicitly.
- The `instruments` + `alert_thresholds` + `care_network` fields feed the inspector's read-only Program contents card.
- The top-level metadata (`name`, `version`, `ce_class`, `enrolled_count_org_wide`) drives the catalogue picker (`GET /external-block-providers/luscii/kinds/program/options`) and the header chip on the block.

**Adapter access pattern:**

- `LusciiStubClient.list_blocks('program')` → `SELECT id, data->>'name' AS label FROM luscii_program ORDER BY data->>'name'`
- `LusciiStubClient.resolve_block('program', ref)` → `SELECT data FROM luscii_program WHERE id = :ref` → returns the full `LusciiProgramData` payload
- `LusciiStubClient.get_block_schema('program')` → returns a static JSON Schema for the author-time config (program_id / protocol_id / mode). This is NOT derived from the table — it's the author-time UI contract, not the program payload. The patient identifier system is org-level config, not part of the block schema. Version pinning is implicit in `program_id` (no separate field — see "Per-patient values" decision).

**Seeding:**

Initial seed (Alembic data migration or `moon run backend:seed` extension) inserts 4 synthetic programs:

| `id` | `data.name` | duration | protocols | instruments | nodes |
|------|-------------|----------|-----------|-------------|-------|
| `luscii-hartfalen-monitoring-v4` | Hartfalen thuismonitoring | 12w | 3 | 4 (BP/Wt/SpO₂/KCCQ) | ~7 |
| `luscii-copd-self-management-v2` | COPD self-management | 16w | 2 | 3 (CAT/FEV1/symptom) | ~5 |
| `luscii-diabetes-coaching-v6` | Diabetes type 2 coaching | 24w | 2 | 4 (glucose/food/med/coaching) | ~9 |
| `luscii-rugrevalidatie-monitoring-v0` | Rugrevalidatie monitoring (pilot) | 8w | 1 | 4 (NRS/ODI/oefening/mobiliteit) | ~6 |

All synthetic — no real patient data, no real Luscii ids. The `id` prefix `luscii-` makes them clearly identifiable as Luscii-namespaced.

Alternative considered: separate columns per top-level field (`name`, `version`, `protocols` as join table, etc.). Rejected — defeats the point of a stub-mode cache, increases migration churn whenever Luscii's shape changes, and forces us to commit to a relational model for data we don't own. JSONB keeps us shape-flexible until live data arrives, at which point we can promote frequently-queried fields if needed.

### Provider registry table

`external_block_provider(code, label, status, capabilities_json)` seeded by Alembic. `capabilities_json` enumerates the block kinds the provider contributes with their static `semantics`, `icon`, `ui_schema`, `allowed_lane_kind_codes`, and the **author-time** `config_schema`. This keeps the catalogue authoritative in our DB rather than fetched live from the vendor on every builder load — the adapter only needs to supply per-instance data (e.g. list of program IDs for the picker) at inspector-edit time.

Alternative considered: pull catalogue live from each adapter on every `GET /pathway-block-types`. Rejected for latency, vendor-availability coupling, and caching complexity. Live data is fetched only when the inspector opens (e.g. populating the program-id dropdown).

### Per-patient values stay at enrollment runtime (not in block config)

The adapter Protocol's `get_block_schema(kind)` returns the JSON Schema for **pathway-author choices only**. For `luscii.program` that is: `program_id`, `protocol_id`, `mode` (blocking | fire_and_forget).

**Version pinning is implicit in the id, not a separate config field.** Luscii's API model treats different versions of "the same care path" as distinct programs with distinct ids (`luscii-hartfalen-monitoring-v4`, future `…-v5`). Our `luscii_program` table mirrors this — each version is its own row. When the author selects a `program_id`, they have implicitly pinned to that exact version forever (unless they explicitly switch the block to a newer id). No separate `version_pin` toggle is needed in v1. A future "always use the latest matching family" semantic can be added if/when version drift becomes a real workflow; until then YAGNI.

**Patient identifier system is org-level, not per-block.** Which FHIR identifier we send when enrolling (BSN vs NHS vs Chipsoft Workflow ID) is effectively constant inside one organization (ZAS = BSN). It lives on the `organization` row (or equivalent tenant setting) and is read at enrollment time by the runtime, not picked per Luscii block at design time. Block authors never see it. A future per-block override can be added if a real use case appears; for now keep it off the inspector to reduce noise.

It is **not**: per-patient BP targets, per-patient dose, per-patient contact preferences, per-patient measurement frequency, or anything else that varies between patients enrolled in the same pathway. Those values are filled at runtime by the caregiver via the enrollment call (`POST /v1/patients`), in the caregiver-app surface — out of scope for this change.

This boundary is asserted as a contract requirement on every external provider (not Luscii-specific): adapters MUST declare that their `config_schema` is author-time only, and any runtime per-enrollment fields MUST be exposed via a separate `enrollment_schema` (deferred to a follow-up change that introduces the caregiver-side enrollment surface).

Alternative considered: collapse author-time and runtime fields into a single `config_schema` with a per-field `scope: 'author' | 'enrollment'` annotation. Rejected — confuses two distinct UX surfaces (builder inspector vs caregiver enrollment dialog) and risks pathway authors silently committing patient-specific defaults that get applied to every enrolled patient.

### Adapter Protocol slice

Add to `external-adapters` (alongside `ping()`):

```python
class ExternalBlockClient(Protocol):
    async def list_blocks(self, kind: str) -> list[ExternalBlockOption]: ...
    async def get_block_schema(self, kind: str) -> dict: ...  # JSON Schema for AUTHOR-TIME instance config
    async def resolve_block(self, kind: str, ref: str) -> ExternalBlockResolution: ...
```

`LusciiStubClient` implements this against `apps/backend/app/adapters/luscii/fixtures/`. Routes type the dependency as `ExternalBlockClient`; resolution dispatches on `provider` via `get_external_block_client(provider)`.

For `luscii.program`:
- `list_blocks('program')` returns fixture Programs (e.g. Hartfalen monitoring, COPD self-management, Diabetes type 2 coaching, Rugrevalidatie monitoring).
- `get_block_schema('program')` returns the author-time JSON Schema described above.
- `resolve_block('program', ref)` returns the program's read-only summary: instruments, alert thresholds, care network, version, CE marking — for inspector display only.

### Luscii block visualization: fake-now, data-driven-later

A Luscii Program block on the pathway canvas is **not** rendered as a flat 240×64 row like native blocks. It is rendered as a wider, taller card (~300×140) whose body shows a small visual of the program.

This change ships with a **fake placeholder visualization** — synthetic markers + abstract shapes sized against the lane accent. The fake exists because (a) the Luscii adapter is stub-only in this change and has no real program data to render, and (b) we don't yet have a confirmed visual reference for how Luscii itself draws a care path, so we cannot mimic Luscii's canonical look pixel-for-pixel today.

The intent is that the **same block component, with the same dimensions and the same surrounding chrome (header + provider badge), later renders a real miniature of the chosen Luscii program** — generated from `resolve_block(program_id)` output once the live Luscii client lands. Instruments, weekly schedule, milestones, etc. become the visual content. The fake is structurally compatible with that future swap: same outer frame, same header, same body slot.

A **zoom-to-full** interaction is planned as a follow-up: clicking / zooming the block opens a larger view of the real program rendering. The block-on-canvas visual is the thumbnail; the zoomed view is the full-fidelity rendering. Both come from the same underlying data once live data is available.

What the visualization deliberately does NOT do:

- It does not display real program-internal data while the adapter is stubbed (no real instruments / thresholds / patient counts on the canvas face — those are visible in the inspector's read-only "Program contents" card, fed by the same `resolve_block` call but rendered as text not pictures).
- It does not constrain authors at design-time. Pathway authors do not pick or edit the visualization — it follows from the selected program.

**Lane geometry update:** `LANE_ROW_HEIGHT` in `apps/orchestrator/src/modules/pathway/canvasLayout.ts` is bumped from `180` to `320` (default for all lane kinds) so even the maximum 540×300 Luscii block fits with margin. Native blocks (240×64) are unaffected functionally; lanes simply carry more vertical breathing room. Author-resizable lanes still apply on top.

**Locked visual direction (as of design review):**

The Luscii block auto-sizes within a fixed range based on the resolved program's layout density. No selected-state toggle, no separate "zoomed" mode — the block is honest about how much pathway it contains.

- **Minimum: 360×200.** What you get for a small program (≤2 phases × ≤2 lanes). Reference: `prototypes/luscii-block-mini-pathway/v3.html` variant C1.
- **Maximum: 540×300** (≈50% bigger than minimum in both dimensions). What you get for a dense program (≥5 phases × ≥4 lanes). Reference: `prototypes/luscii-block-large/v2.html` sits near the high end of this range at 504×280.
- **Sizing rule:**
  - `width = clamp(360, 360 + 60 × max(0, phase_count - 2), 540)`
  - `height = clamp(200, 200 + 50 × max(0, lane_count - 2), 300)`
  - So 2p×2l = 360×200 (min) · 3p×3l = 420×250 · 5p×4l = 540×300 (max).
- Same outer chrome at every size (rail + title glass chip + Luscii corner badge + meta chip). Only the SVG body density changes.
- The size is **computed from the resolved program payload**, not from a selection state. Drop a small program → small block. Drop a big program → big block. Same block, different intrinsic size.
- Renderer scales SVG content proportionally — `LusciiProgramData.layout.nodes[].x/y` are Luscii's coords, mapped into the computed viewBox via mini-`blockOrigin` math.
- Empty state (no `program_id`) renders at the minimum 360×200 with the CTA (see scenario in `external-block-integrations` spec).

Alternative considered: keep the Luscii block at the native 240×64 size, distinguished only by lane-accent + corner badge. Rejected — too subtle; pathway authors scanning a busy canvas would miss that a block represents an externally-executed sub-flow worth several weeks of patient activity.

Alternative considered: ship a purely abstract decorative visual (no intent to ever bind it to real data). Rejected — the block is meant to *show what the program is*, not just signal "external thing". A long-lived decorative placeholder would silently diverge from what authors actually need once real data arrives.

#### Component contract — built once, swappable body

To make the stub → live swap a body-only change (no callsite churn, no xyflow re-registration, no inspector rewiring), the Luscii block is decomposed into stable + swappable parts up front. The directory under `apps/orchestrator/src/modules/pathway/components/canvas/nodes/external/luscii/` SHALL contain:

- **`LusciiProgramBlockNode.tsx`** — outer container; the xyflow `NodeProps` adapter. Reads block config (`program_id`, `protocol_id`, `mode`, `version_pin`) and resolved-program data (when available) from props. Computes the block's intrinsic size from the resolved program's `layout` (phases × lanes) using the clamp rules; falls back to minimum 360×200 when data is null. Renders `LusciiProgramHeader` + `LusciiProgramThumbnail` inside the computed frame. **Stable across stub → live.**
- **`LusciiProgramHeader.tsx`** — top strip: program icon-box, program name, sub-line (protocol · mode · version-pin), provider corner badge slot. **Stable across stub → live.** Fed by block config + light catalogue lookup; does NOT depend on the heavy `resolve_block` payload.
- **`LusciiProgramThumbnail.tsx`** — body slot. Single dispatcher: receives `data: LusciiProgramData | null`. When `null` → renders `LusciiProgramThumbnailFake`. When non-null → renders `LusciiProgramThumbnailLive`. **Stable signature across stub → live.**
- **`LusciiProgramThumbnailFake.tsx`** — synthetic placeholder SVG. Used in stub mode and as fallback whenever live data is loading or unavailable.
- **`LusciiProgramThumbnailLive.tsx`** — data-driven SVG renderer. Lands as a thin shell that throws `NotImplementedError` in this change (no live data yet). Real implementation arrives with the live-Luscii-adapter change.
- **`types.ts`** — `LusciiProgramData` shape (instruments, weekly cadence, milestones — whatever the chosen v6 visual variant needs). Drives both the fake's silhouette and the live renderer's real bindings.

Consumers (canvas, dock, inspector preview if any) interact only with `LusciiProgramBlockNode` + `LusciiProgramHeader`. Swapping the thumbnail renderer is a single-file change inside `LusciiProgramThumbnail.tsx`'s dispatcher branch.

Anti-pattern explicitly forbidden in this change: a monolithic `LusciiBlock.tsx` mixing config-reading, header rendering, and body rendering in one file. That kind of file is what the future swap pays for in rework.

### No "Manage in Luscii" / "Open Viewer" CTAs in the author inspector

Earlier prototypes (v1–v3 of `luscii-block-inspector`) included two external CTAs in the inspector header: "Manage in Luscii Builder" and "Open Viewer". Both are dropped:

- **"Manage in Luscii Builder"** — Luscii programs can only be authored / edited by Certified Medical Developers (a tightly-restricted role); shipping a CTA that the vast majority of our users can't act on is noise.
- **"Open Viewer"** — Luscii Vitals (the clinician viewer) is patient-specific via SAML SSO. It does not belong in the **author-time** pathway-builder inspector (no patient exists yet at build time). It will land in the caregiver-runtime UI as a separate spec.

Replacement: a small **metadata strip** at the bottom of the Luscii block's inspector showing the Luscii program id, program version, and protocol id as monospace, copy-paste-able text. Useful for support tickets ("which program is this?"), cross-referencing with Luscii admins, and debugging without offering an action the user can't take.

Example strip:
```
luscii-hartfalen-monitoring-v4 · v4.2 · proto-std-12w   [copy]
```

### Inspector renderer reuse

`pathway-config-forms` already drives JSON-schema → form. External entries return the same `{config_schema, ui_schema}` shape, scoped to author-time only. The inspector wraps it with a small read-only header (`Provider · kind`) plus a "manage in Luscii" external link and an "Open Viewer" SSO link, but the form body is the existing renderer with no special-casing.

The read-only program summary (instruments, thresholds, care network) is rendered as a separate inspector section below the form, not as part of `config_schema` — it's information-for-the-author, not author-input.

### Catalogue API shape change

`GET /pathway-block-types` entries gain three fields:

```json
{ "source": "native" | "external", "provider": "luscii" | null, "kind": "program" | null }
```

Frontend palette groups by `source` first, then by `provider`.

## Reuse principles (do not reinvent)

The full audit lives in `reuse-audit.md`. Locked principles:

### Three-way naming alignment for free invalidation

`DB table name == realtime resource name == TanStack key prefix.` This is deliberate, not coincidence. With it, `RealtimeInvalidationProvider` auto-invalidates the right caches without any bespoke subscription code.

- DB table `luscii_program` → `RealtimeEvent(resource='luscii_program', ...)` → query key `['luscii_program', ...]`
- DB table `external_block_provider` → `RealtimeEvent(resource='external_block_provider', ...)` → query key `['external_block_provider', ...]`

Any deviation from this rule pays an invalidation tax — don't pay it.

### Single Luscii client, multiple capability slices

`apps/backend/app/adapters/luscii/protocol.py` already defines `LusciiClient` (`ping()`). The new generic `ExternalBlockClient` Protocol lives at `apps/backend/app/adapters/external_blocks.py`. The single Luscii client class (and its `LusciiStubClient` stub) implements BOTH protocols. No parallel "Luscii block client" class. Same goes for HiX when it gets block capabilities.

### One xyflow node type, dispatcher inside

`NODE_TYPES = { block: BlockNodeRouter }` stays the only registration. `BlockNodeRouter.tsx` (new file in `apps/orchestrator/src/modules/pathway/components/canvas/nodes/`) reads `data.block.type` and routes:

- bare code (e.g. `appointment`, `task`) → existing `BlockNode`
- dotted code (e.g. `luscii.program`) → `LusciiProgramBlockNode`

Future providers register their component inside the router, not at xyflow level. xyflow stays unaware of providers.

### One generic `external_program` semantics, mapped onto by providers

The `BlockSemantics` enum (consumed by `CONFIG_SCHEMAS` in `apps/orchestrator/src/modules/pathway/configSchemas.ts` and by the `BuilderDrawer` dispatch) gains a new value: `'external_program'`. Both backend (capabilities `semantics` field) and frontend (`CONFIG_SCHEMAS['external_program']`) use it. The provider+kind metadata (`luscii.program`) still flows on the catalogue entry — `BuilderDrawer` branches on semantics for the inspector dispatch, then picks the provider-specific inspector from a tiny inner map (`{luscii: LusciiProgramInspector, ...}`). Avoids a switch-on-block-type-string inside `BuilderDrawer` for every new provider.

### Extension points (not new modules) for these surfaces

| Surface | Reused via |
|---|---|
| `LusciiClient` Protocol | Extend with block methods |
| `LusciiStubClient` class | Extend with block methods (queries `luscii_program` table) |
| `get_luscii_client` factory | Wrapped by `get_external_block_client('luscii', ...)` |
| `RealtimeEvent` envelope | Reused as-is |
| `RealtimeInvalidationProvider` | Reused as-is via naming alignment |
| `BuilderDock` palette | Extended to group by `source` then `provider` |
| `BuilderDrawer` inspector | Extended dispatch (new `external_program` semantics branch) |
| `InspectorField` wrapper | Reused as-is |
| `CONFIG_SCHEMAS` registry | Extended with `external_program` semantics |
| `BlockTypeIcon` resolver | Reused as-is (Luscii's `icon='activity'`) |
| `laneAccent` / `phaseTint` | Reused as-is (`external` lane already exists) |
| `useFlowNodes` mapper | Reused as-is (the dispatcher swap is rendering-only) |
| shadcn `Select` / `Input` / `Button` / `Label` | Reused directly |
| OpenAPI → TS pipeline (`/openapi-sync`) | Reused for `LusciiProgramData` |
| moon seed task pattern | Extended with `backend:seed-luscii` |
| Alembic migration tooling | Reused as-is |

### Anti-patterns explicitly forbidden in this change

1. Parallel block-only Luscii client class
2. Per-provider xyflow `NODE_TYPES` registration
3. New inspector drawer component for Luscii
4. Bespoke realtime subscription for Luscii topics
5. New Zod / form library for the Luscii config
6. New shadcn primitive or UI wrapper
7. Hand-written TypeScript mirror of `LusciiProgramData`
8. New Alembic seed runner
9. New realtime event envelope shape
10. Bypassing `get_external_block_client` factory from routes

Each is rejected because something in the table above already does the job.

## Risks / Trade-offs

- **Dotted block-type codes ripple through type validation everywhere `type` is parsed.** → Centralise parsing in `block_type_code.py` with `BlockTypeCode(source, provider, kind)` and migrate all touch points in one PR; CHECK constraint plus app-level FK keep DB consistent.
- **Stub-only Luscii means demo blocks won't resolve to real data.** → Acceptable; we ship a "stub" badge on resolved instances and a stub-mode banner in the inspector. The live client is a follow-up change.
- **Provider catalogue drift (vendor renames a kind).** → `capabilities_json` is versioned by migration; renames are explicit migrations, not silent overrides.
- **Block-type catalogue cache invalidation.** → Reuse the existing realtime invalidation channel (`realtime-invalidation` spec). Two topics: `external_block_provider` (registry rows changed — catalogue add/remove/enable/disable) and `luscii_program` (a Luscii program's payload changed — seed re-ran or live adapter upserted). Frontend listens to both and invalidates the matching TanStack Query keys (`['externalBlocks', 'providers']` and `['externalBlocks', 'luscii', 'programs', ref?]` respectively). The whole builder is already realtime; the Luscii catalogue follows the same pattern, not a per-fetch stale-time fallback.
- **Permission boundary: who can drop an external block?** → Inherits the existing block-place permission; no new auth surface in this change. Vendor-side authorisation (does this org actually have a Luscii contract?) is enforced at `resolve_block` time, not at drag-drop.
- **Authors will ask "where do I set BP targets?"** → The inspector's read-only "Program contents" card must explicitly say *"Thresholds and schedules are part of the Luscii program — change them in Luscii Builder."* and the "manage in Luscii" CTA must be prominent. Surface the boundary in copy, not in error messages.
- **Future adapters might mistakenly stuff per-patient fields into `config_schema`.** → Cross-adapter contract: a provider whose `config_schema` declares fields that are obviously per-patient (e.g. patient_dob, target_value, dose) MUST be rejected by registry registration. Lint check on `capabilities_json` shape is a follow-up; for v1, document the boundary in the registry seed migration's docstring and add a code-review checklist item.

## Migration Plan

1. Alembic migration: create `external_block_provider`, widen `pathway_block.type` CHECK, seed one row for `luscii` with a single `program` capability (semantics, icon, ui_schema, allowed_lane_kind_codes=[`external`], author-time `config_schema`).
2. Backend: add `app/pathways/external_blocks/registry.py`, extend `pathway-block-types` route to merge native + external rows, add `ExternalBlockClient` protocol + Luscii stub.
3. Orchestrator: regenerate types via `/openapi-sync`; add palette grouping + inspector header. No new components, only props on existing ones.
4. Rollback: down-migration drops the registry table and restores the closed CHECK enum; any external rows must be removed first (migration aborts if found, with a runbook hint).

## Open Questions

- How do we represent a "stale" external block when a provider is later disabled? Treat as readonly + invalid for activation, or auto-archive? (defer to follow-up).
- Per-tenant provider enablement: does every tenant see Luscii blocks, or do we gate on a `tenant_provider_enabled` table? Default in this change: visible to all tenants; gate later when live client lands.
- Snapshotting: when a pathway version is published, do we freeze the provider `capabilities_json` into the version? Probably yes, but design-detail deferred to a versioning follow-up.
- **Enrollment-time surface**: when does the caregiver-app enrollment dialog land? Its `enrollment_schema` shape (companion to author-time `config_schema`) should be defined before live Luscii integration, but is out of scope here.
- **Multi-provider lane grouping (deferred)**: today the `external` lane kind hosts all external-provider blocks (Luscii first). When a second provider lands (HiX, registry, etc.) we'll revisit whether to split into per-provider lane kinds (`hix`, `registry`) or keep a single `external` bucket. Deferred until a real second provider exists — designing for hypothetical providers without their shape would lock in the wrong model.
- **Program-family "latest" pinning (deferred)**: today each Luscii program version is a distinct id (mirrors Luscii's API model). Authors pick a specific id, which means a specific version. If a user workflow emerges where authors want "always use the newest version of the Hartfalen family", we'll add a family-grouping field on `luscii_program` (e.g. `data.family_key = 'luscii-hartfalen-monitoring'`) and a `program_family_id + always_latest` config alternative. Out of scope today — no real version drift yet.
