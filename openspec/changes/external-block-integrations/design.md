## Context

The pathway block-type catalogue is currently a closed code-side constant (`BLOCK_TYPES` in `app/services/pathway/catalogue.py`) — adding a block type is a code change + deploy. All semantics, `config_schema`, `ui_schema`, and `allowed_lane_kind_codes` live in catalogue entries. The clinical roadmap wants Luscii care paths to appear as pathway blocks today, with HiX or registry-backed blocks following the same pattern. A Luscii-specific carve-out would bleed vendor names into core builder code.

Research on Luscii's API surface (`docs/research/luscii-care-pathways-research.md`) confirms two boundaries that shape this design:

1. **A Luscii care path is a Program.** Programs are the single primitive Luscii exposes via the Public API (`GET /v1/programs`). Questionnaires, measurements, alert thresholds, and education content all live *inside* a program — they are not API-addressable on their own.
2. **Per-patient customisation happens only at enrollment runtime.** Clinical parameters (alert thresholds, measurement cadence) are fixed in the program. The only per-patient values Luscii accepts are demographics, locale, contact info, and FHIR identifier — all captured at `POST /v1/patients` time.

## Goals / Non-Goals

**Goals:**

- One namespaced block-type code form (`<provider>.<kind>`) that the existing catalogue + persistence accept alongside native bare codes.
- Provenance metadata (`source`, `provider`, `kind`) on every catalogue entry so frontends can dispatch to per-provider renderers.
- Luscii lands as the first concrete external block (`luscii.program`) with stub-only program data served by per-vendor routes.
- A content-sized canvas thumbnail that auto-scales with program density (360×200 → 540×300 clamp), implemented via a component decomposition that swaps fake → live data in a single file when the live adapter lands.
- Encode the per-patient-vs-pathway-author boundary in the catalogue contract: external block config schemas declare author-time fields only.

**Non-Goals:**

- Live Luscii HTTP client, OAuth, patient-data ingestion, FHIR webhook delivery.
- Persisting Luscii program payloads in our DB (today: in-memory constant; future: cache layer added with live adapter, not here).
- A generic `ExternalBlockClient` Protocol or cross-vendor provider registry. Each vendor today ships per-vendor routes (`/luscii/programs`, future `/hix/...`). Cross-vendor abstraction is deferred until a second vendor exists *and* the abstraction is justified.
- A `external_block_provider` registry table. The catalogue is a code constant — adding a vendor is a code change, same as adding a native block.
- Per-tenant provider enablement. Every tenant sees every block type today. Gating, when needed, lands via a tiny `tenant_external_block_provider` join table — separate change.
- Editing the external content from inside our builder. The block stores a *reference* (`luscii.program` + `program_id` + `protocol_id`); editing happens in the vendor product.
- Nested pathway-as-block (covered by sibling `nested-pathway-blocks` change).
- Per-patient configuration at build time, "Open Viewer" SAML SSO, "Manage in Luscii Builder" link, version-pin field (each deferred or dropped — see decisions below).

## Decisions

### Namespaced block-type codes

Block-type codes use dotted form for external entries (`luscii.program`) and bare form for native (`appointment`). The existing `pathway_block.type` column stays `TEXT`; a CHECK constraint enforces the lexical shape: `type ~ '^[a-z_]+(\.[a-z_]+)?$'`. Application-level validation continues via the catalogue lookup.

The parser is `BlockTypeCode` (`app/services/pathway/block_type_code.py`) — a frozen dataclass parsing `raw → (source, provider, kind)`. Native bare codes yield `source='native', provider=None, kind=None`. Dotted codes yield `source='external', provider=<left>, kind=<right>`.

### Catalogue stays a code constant (no registry table)

`BLOCK_TYPES` in `app/services/pathway/catalogue.py` gains a `luscii.program` entry alongside native types. The Pydantic `PathwayBlockType` schema gains three fields: `source`, `provider`, `kind`. Native entries serialize with `source='native', provider=null, kind=null`. The `luscii.program` entry serializes with `source='external', provider='luscii', kind='program'`.

Alternative considered (and rejected): an `external_block_provider` table with `capabilities_json` blob describing each vendor's contributions. Rejected as overengineered for our current scope (one vendor, one kind, hand-authored metadata). Adding a vendor today = code change + deploy, identical to adding a native block. Per-tenant gating, when real, lands via a small join table — not a generic registry.

### Per-vendor routes (no cross-vendor Protocol abstraction)

Each external vendor that ships block types also ships its own backend routes. Luscii's are:

- `GET /luscii/programs` — picker list. Returns array of `{id, name, version, description, enrolled_count_org_wide}`.
- `GET /luscii/programs/{id}` — full `LusciiProgramData` payload. Drives both the inspector "Program contents" card and the on-canvas thumbnail.

Both routes read from `app/adapters/luscii/programs.py` — a `# POC ONLY` static constant of 4 synthetic programs. The live-Luscii-adapter change replaces the constant with a real fetch + cache layer; route shapes stay unchanged.

Alternative considered (and rejected): a generic `ExternalBlockClient` Protocol + `get_external_block_client(provider, settings)` factory + uniform routes (`GET /external-block-providers/{provider}/kinds/{kind}/options`). Rejected — with one vendor, the Protocol is unused abstraction. When a second vendor lands, we'll refactor toward a shared shape *based on what both vendors actually need*, not on speculative symmetry today.

### Per-patient values stay at enrollment runtime (not in block config)

The `luscii.program` config schema is **author-time only**: `program_id` (required), `protocol_id` (required), `mode` (enum `blocking | fire_and_forget`, required).

Not in the schema: per-patient BP targets, per-patient dose, per-patient contact preferences, per-patient measurement frequency, or anything else that varies between patients enrolled in the same pathway. Those values are filled at runtime by the caregiver via the enrollment call (`POST /v1/patients`), in the caregiver-app surface — out of scope for this change.

**Patient identifier system is org-level, not per-block.** Which FHIR identifier we send when enrolling (BSN vs NHS vs Chipsoft Workflow ID) is effectively constant inside one organization (ZAS = BSN). It lives on the `organization` row (or equivalent tenant setting) and is read at enrollment time by the runtime, not picked per Luscii block at design time.

**Version pinning is implicit in the id, not a separate config field.** Luscii's API model treats different versions of "the same care path" as distinct programs with distinct ids (`luscii-hartfalen-monitoring-v4`, future `…-v5`). When the author selects a `program_id`, they have implicitly pinned to that exact version forever (unless they explicitly switch the block to a newer id). No separate `version_pin` toggle in v1.

Alternative considered (and rejected): collapse author-time and runtime fields into a single `config_schema` with a per-field `scope: 'author' | 'enrollment'` annotation. Rejected — confuses two distinct UX surfaces (builder inspector vs caregiver enrollment dialog) and risks pathway authors silently committing patient-specific defaults that get applied to every enrolled patient.

### `LusciiProgramData` shape (the contract)

Single Pydantic model at `app/adapters/luscii/program.py`, mirrored end-to-end via OpenAPI → TypeScript. Stored in-memory today (`LUSCII_STUB_PROGRAMS` constant in `app/adapters/luscii/programs.py`), exposed via the resolve route.

Top-level fields: `id`, `name`, `description`, `version`, `version_published_at`, `ce_class` (always `'IIa'`), `is_two_way_messaging`, `enrolled_count_org_wide`.

Nested:
- `protocols: list[LusciiProtocol]` — picker options for the inspector's protocol field. One marked `is_default=True`.
- `instruments: list[LusciiInstrument]` — measurement / questionnaire types in the program. Shown in the inspector card.
- `alert_thresholds: list[LusciiAlertThreshold]` — clinician-facing alert rules (Class IIa). Shown read-only in the inspector card.
- `care_network: str | None` — the program's care team description.
- `layout: LusciiLayout` — drives the on-canvas thumbnail. Mirrors `PathwayBlock`'s coordinate model: each node carries `phase_id` + `lane_id` + intra-cell `x` + `y`.

### Luscii block visualization: fake-now, data-driven-later

The Luscii block on the pathway canvas is rendered as a ~360×200 → 540×300 card whose body shows a small visual of the program.

**Locked visual direction:**

- **Minimum: 360×200** (≤2 phases × ≤2 lanes). Ref: `prototypes/luscii-block-mini-pathway/v3.html` variant C1.
- **Maximum: 540×300** (≥5 phases × ≥4 lanes). Ref: `prototypes/luscii-block-large/v2.html` (504×280 sits mid-range).
- **Sizing rule:** `width = clamp(360, 360 + 60×max(0, p-2), 540)` × `height = clamp(200, 200 + 50×max(0, l-2), 300)`.

Same outer chrome at every size (rail + title glass chip + Luscii corner badge + meta chip bottom-right). Only the SVG body density changes. Size is computed from the resolved program payload, not from selection state.

**Stub mode (this change):** the body renders a fake placeholder visual built from the program's `layout` (real phase × lane × node structure, abstract shape language). No selected-state size toggle. Empty state (no `program_id` picked yet) renders at the minimum 360×200 with a "Pick a Luscii program" CTA inside the body.

**Live mode (future change):** swap `LusciiProgramThumbnailFake` for `LusciiProgramThumbnailLive` — single-file change inside the dispatcher branch.

### Lane geometry update

`LANE_ROW_HEIGHT` in `apps/orchestrator/src/modules/pathway/canvasLayout.ts` is bumped from `180` to `320` (default for all lane kinds) so the maximum 540×300 Luscii block fits with margin. Native blocks (240×64) are unaffected functionally. Author-resizable lane heights still apply on top.

`getBlockDimensions(block, blockType)` (added in section 0 of tasks; already shipped on this branch) is the single seam where per-block-type sizes are computed. Native blocks always return `{BLOCK_WIDTH, BLOCK_HEIGHT}`. The Luscii size computer plugs in here without touching `useFlowNodes`.

### Inspector dispatch via `external_program` semantics

`BlockSemanticsLiteral` (backend) and `BlockSemantics` (frontend, derived from OpenAPI) gain `'external_program'`. The `luscii.program` catalogue entry's `semantics` field is `'external_program'`. Frontend `BuilderDrawer` dispatch adds a branch on `external_program` that picks the provider-specific inspector from a small inner map (`{luscii: LusciiProgramInspector, ...}`). Future providers register in that inner map — no per-block-type-string switch in `BuilderDrawer`.

`CONFIG_SCHEMAS` in `apps/orchestrator/src/modules/pathway/configSchemas.ts` gains an `external_program` Zod schema covering `program_id` / `protocol_id` / `mode`. The existing `safeParse` flow in `BuilderDrawer` then works unchanged.

### No "Manage in Luscii" / "Open Viewer" CTAs in the author inspector

Earlier prototypes included two external CTAs in the inspector header. Both are dropped:

- **"Manage in Luscii Builder"** — Luscii programs can only be authored / edited by Certified Medical Developers (a tightly-restricted role); shipping a CTA that the vast majority of our users can't act on is noise.
- **"Open Viewer"** — Luscii Vitals (the clinician viewer) is patient-specific via SAML SSO. It does not belong in the author-time pathway-builder inspector (no patient exists yet at build time). It will land in the caregiver-runtime UI as a separate spec.

Replacement: a small **metadata strip** at the bottom of the Luscii block's inspector showing the Luscii program id, program version, and protocol id as monospace, copy-paste-able text. Useful for support tickets and cross-referencing with Luscii admins.

### Component contract — built once, swappable body

To make the stub → live swap a body-only change, the Luscii block is decomposed into stable + swappable parts up front. The directory `apps/orchestrator/src/modules/pathway/components/canvas/nodes/external/luscii/` contains:

- **`LusciiProgramBlockNode.tsx`** — xyflow `NodeProps` adapter. Reads block config + optional resolved-program data. Computes the block's intrinsic size from the resolved program's `layout` via the clamp rule; falls back to 360×200 when data is null. Renders header + thumbnail inside the computed frame. **Stable across stub → live.**
- **`LusciiProgramHeader.tsx`** — title-overlay glass chip + provider corner badge + meta-overlay bottom-right. Scales internal padding/typography proportionally to the computed block dimensions. **Stable across stub → live.**
- **`LusciiProgramThumbnail.tsx`** — body-slot dispatcher: receives `data: LusciiProgramData | null`. When `null` → renders `LusciiProgramThumbnailFake`. When non-null → renders `LusciiProgramThumbnailLive`. **Stable signature across stub → live.**
- **`LusciiProgramThumbnailFake.tsx`** — synthetic placeholder SVG built from the resolved program's `layout` shape (so even the fake reflects which program is selected). Used in stub mode and as fallback whenever live data is loading or unavailable.
- **`LusciiProgramThumbnailLive.tsx`** — data-driven SVG shell. Lands as a thin shell that throws `NotImplementedError` in this change. Real implementation arrives with the live-Luscii-adapter change.
- **`types.ts`** — local re-exports of `LusciiProgramData` and friends from the generated OpenAPI schema.

Consumers (canvas, inspector preview if any) interact only with `LusciiProgramBlockNode` + `LusciiProgramHeader`. Swapping the thumbnail renderer is a single-file change inside `LusciiProgramThumbnail.tsx`'s dispatcher branch.

xyflow registration uses a single dispatcher: `NODE_TYPES = { block: BlockNodeRouter }`. `BlockNodeRouter` reads `data.block.type`; bare codes route to existing `BlockNode`, dotted codes route to provider-specific components. One xyflow type key, ever.

## Reuse principles (do not reinvent)

Full audit lives in `reuse-audit.md`. Locked principles:

### Three-way naming alignment for free invalidation

`DB table name == realtime resource name == TanStack key prefix.` With it, `RealtimeInvalidationProvider` auto-invalidates the right caches without any bespoke subscription code. In this leaner shape there is no DB table for Luscii programs — so no realtime invalidation today. The convention still applies to future caches (e.g. when the live-adapter change introduces a `luscii_program_cache` table, the topic name + TanStack key prefix follow the table name).

### Single Luscii client, multiple capability slices

The existing `app/adapters/luscii/protocol.py` Protocol + `app/adapters/luscii/stub.py` stub stay one class each per vendor. New per-vendor schemas / data live in the same `app/adapters/luscii/` package (`program.py` for the Pydantic schema, `programs.py` for the static constant). No parallel "Luscii blocks adapter".

### One xyflow node type, dispatcher inside

`NODE_TYPES = { block: BlockNodeRouter }`. `BlockNodeRouter.tsx` reads `data.block.type` and routes:

- bare code (e.g. `appointment`, `task`) → existing `BlockNode`
- dotted code (e.g. `luscii.program`) → `LusciiProgramBlockNode`

Future providers register their component inside the router, not at xyflow level.

### One generic `external_program` semantics, mapped onto by providers

`BlockSemantics` enum gains `'external_program'`. `BuilderDrawer` branches on semantics for the inspector dispatch, then picks the provider-specific inspector from a small inner map keyed on `block.provider`. Avoids a switch-on-block-type-string inside `BuilderDrawer` for every new provider.

### Extension points (not new modules)

| Surface | Reused via |
|---|---|
| `LusciiClient` Protocol | Reused as-is for `ping()`; block routes don't need a Protocol slice |
| `LusciiStubClient` class | Reused as-is for `ping()`; block routes read from `app.adapters.luscii.programs` |
| `BLOCK_TYPES` catalogue | Extended with one entry (`luscii.program`) |
| `PathwayBlockType` Pydantic schema | Extended with `source` / `provider` / `kind` fields |
| `BlockSemanticsLiteral` enum | Extended with `'external_program'` |
| `BuilderDock` palette | Extended to group by `source` then `provider` |
| `BuilderDrawer` inspector | Extended dispatch (new `external_program` semantics branch) |
| `InspectorField` wrapper | Reused as-is |
| `CONFIG_SCHEMAS` registry | Extended with `external_program` semantics |
| `BlockTypeIcon` resolver | Reused as-is (Luscii's `icon='activity'`) |
| `laneAccent` / `phaseTint` | Reused as-is (`external` lane already exists) |
| `useFlowNodes` mapper | Reused as-is (the dispatcher swap is rendering-only) |
| `getBlockDimensions` helper | Extended (Luscii size computer registers here) |
| shadcn `Select` / `Input` / `Button` / `Label` | Reused directly |
| OpenAPI → TS pipeline (`/openapi-sync`) | Reused for `LusciiProgramData` |
| Alembic migration tooling | Reused as-is (CHECK widening only — DDL only per AGENTS rule 209) |

### Anti-patterns explicitly forbidden in this change

1. Parallel block-only Luscii client class
2. Per-provider xyflow `NODE_TYPES` registration
3. New inspector drawer component for Luscii
4. New Zod / form library for the Luscii config
5. New shadcn primitive or UI wrapper
6. Hand-written TypeScript mirror of `LusciiProgramData`
7. Seed data inside Alembic revisions (rule 209 — DDL only)
8. New realtime event envelope shape
9. `external_block_provider` table (rejected above)
10. `ExternalBlockClient` Protocol + cross-vendor factory (rejected above)

## Risks / Trade-offs

- **Dotted block-type codes ripple through type validation everywhere `type` is parsed.** → Centralised parsing in `block_type_code.py` (`BlockTypeCode(source, provider, kind)`); CHECK constraint plus app-level catalogue lookup keep DB consistent.
- **Stub-only Luscii means demo blocks won't resolve to real data.** → Acceptable; the resolve route serves static synthetic payloads. Inspector + thumbnail look real because they're fed by the same Pydantic schema the live adapter will emit.
- **Author asking "where do I set BP targets?"** → The inspector's read-only "Program contents" card must explicitly say *"Thresholds and schedules are part of the Luscii program — change them in Luscii Builder."*
- **A second external vendor arriving without our refactor.** → When HiX or registries ship their first block type, do a small refactor pass: extract the shared parts (catalogue dispatch, palette grouping, lane snap) into shared modules, decide whether per-vendor routes survive or merge into a generic shape. Doing it now would freeze the wrong abstraction.

## Migration Plan

1. Single Alembic migration: widen `pathway_block.type` CHECK to `^[a-z_]+(\.[a-z_]+)?$`. DDL only per AGENTS rule 209.
2. Backend code: extend `BLOCK_TYPES` with `luscii.program`, extend Pydantic `PathwayBlockType` with provenance fields, add `external_program` to `BlockSemanticsLiteral`, add `app/api/routers/luscii/luscii_router.py` + `app/services/luscii/luscii_service.py`, wire `BlockTypeCode` into pathway service validation.
3. Orchestrator: regenerate types via `/openapi-sync`, scaffold the Luscii component decomposition, extend `BuilderDock` grouping + `BuilderDrawer` dispatch + `configSchemas`, bump `LANE_ROW_HEIGHT`, register Luscii size computer in `getBlockDimensions`.
4. Rollback: down-migration narrows the CHECK back to bare-only after removing any persisted `luscii.program` rows; orchestrator changes are pure additions and roll back via revert.

## Open Questions

- **Multi-provider lane grouping (deferred)**: today the `external` lane kind hosts all external-provider blocks (Luscii first). When a second provider lands, revisit whether to split into per-provider lane kinds (`hix`, `registry`) or keep a single `external` bucket. Deferred until a real second provider exists.
- **Program-family "latest" pinning (deferred)**: today each Luscii program version is a distinct id (mirrors Luscii's API model). If users want "always use the newest version of the Hartfalen family", add a family-grouping field on the payload + a `program_family_id + always_latest` config alternative. Out of scope today.
- **Enrollment-time surface**: when does the caregiver-app enrollment dialog land? Its `enrollment_schema` shape (companion to author-time `config_schema`) should be defined before live Luscii integration, but is out of scope here.
- **Live-Luscii cache layer**: when the live adapter arrives, decide between an in-process LRU + TTL vs a DB table (`luscii_program_cache`). The route shape and `LusciiProgramData` payload don't change.
