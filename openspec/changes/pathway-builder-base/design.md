## Context

`F3` Carepath builder is the spine of the PoC: without it there's no pathway to enrol patients into for `F4`/`F5`. We have no pathway domain in the backend today and no builder surface in the orchestrator. Frontend `app-shell` + `api-client` + `design-system` are in place; backend has `tenant-base`, `user-base`, `openapi-contract`, `errors-logging` ready.

The user (project lead) wants to co-design the data model rather than have it dropped pre-baked, then prototype the builder UI iteratively. This change locks shape + sequencing; concrete domain field names and UI interactions are decided inside the phases.

Builder UIs are deep, complex surfaces. Repo convention (`feedback_prefer_packages`) is wrap, don't rebuild — graph-canvas + node-editor packages exist (React Flow / xyflow is the dominant one). We pick after a short audit in Phase 3.

## Wireframes & UX source-of-truth

Builder UX direction lives in `docs/wireframes/`:

| File | What it shows | Status |
|---|---|---|
| `docs/wireframes/TRANSCRIPTION.md` | Iteration log: design decisions, vocab (`Care Pathway` code / `Zorgpad` UI NL), 3D mental model (Lane × Tijd × Fase), Blueprint vs Instance split, planned step types | Canonical UX context — read first |
| `docs/wireframes/builder.html` | v1 — BPMN swimlanes, floating dock, dialog-based block editor, Manhattan-routed connectors | Stable reference |
| `docs/wireframes/builder-v1.1.html` | v1.1 — adds phase bands (top), time markers (vertical guides), loopback edges (amber dashed), data-flow edges (dashed) | Current target shape |
| `docs/wireframes/builder-lanes-mix.html` | Variant: lanes as auto-derived (from block type catalogue) + custom additions + per-block override | Decided shape for lanes (see D9) |
| `docs/wireframes/builder-time-phases.html` | 3 variants for combining phase bands + day axis on the canvas (A bands+axis / B tinted blocks / C phase columns) | Variant A picked, refined into time tape (D13) |
| `docs/wireframes/builder-time-gaps.html` | 3 sub-variants exploring the variable-gap problem (gap pills / range bracket / no-axis) | All rejected — drove the smart time tape concept |
| `docs/wireframes/builder-time-tape.html` | 4 stacked canvas layers (phase band / time tape / lane rail / fixed-width block cards). Tape encodes fixed/variable/slack segments | Locked data shape (D12); visual tape deferred post-PoC (D13) |
| `docs/wireframes/builder-param-fields.html` | 3 variants for parameterizable fields in the side panel (inline toggle / two-tab / lock icon) | Reference for Phase 3 form design |
| `docs/wireframes/data-model.html` | Authoritative visual map of the 11-table schema, FKs, catalogues, and validation rules | Single source of truth for the schema |

Future variant prototypes for unsettled UX forks (phase representation, time anchoring, save UX, create flow) land in the same folder and get a row in this table when added. Wireframes are durable docs; this table is the bridge between change and visual artefacts.

## Goals / Non-Goals

**Goals:**

- Land a backend pathway-definition domain (aggregate, nodes, edges, block-type catalogue) with REST surface and persistence.
- Ship the orchestrator builder vertical: sidebar entry → overview → create → builder canvas, all wired to the backend.
- Make Phase 1's data model the result of a collab session with the user, not a unilateral decision.
- Keep frontend prototyping cheap: each UI phase ships against the seeded fixture and is iterated before the next phase starts.
- Stay strictly `[poc]` — no publish flow, no versioning, no enrollment runtime, no Luscii live integration, no MDR-triggering content.
- Preserve seams: pathway domain is shaped so MVP additions (versioning, publish, Luscii Builder API) don't require a rewrite.

**Non-Goals:**

- Patient enrollment, pathway execution, task generation from a pathway — those are `F4`/`F5`/`F6` work, separate changes.
- Real Luscii Builder API integration — `luscii-clinical-path` block holds opaque JSON per `openspec/scope.md` mocks row.
- Real-time collaborative editing, comments, branching/diffing of pathway definitions.
- Pathway versioning / publish workflow — `[mvp]` delta, parked in scope deltas.
- A homegrown graph-canvas renderer.
- Encoding clinical reasoning of any kind — MDR-relevant. Builder composes operational steps only.

## Decisions

**D1 — Pathway is a single aggregate; relational child tables, not JSONB graph.**

A pathway definition is one `pathway` row plus 10 child tables (see Naming/Exceptions section for the full list). PoC operations are whole-pathway load/replace, but lanes/phases/timing are queried independently for builder UI and future analytics, so a JSONB graph blob would require app-side reshaping for every read. Per-block-type config is the only field with deliberately variable shape — that's the one purposeful jsonb (Exception 1). All other structural data is relational with FKs and CHECK constraints.

**D2 — Block-type catalogue is server-owned, returned by `GET /pathway-blocks`.**

The frontend renders blocks driven by per-block JSON schema returned from the server. Reasoning: adding/changing a block type stays a backend concern; the orchestrator doesn't hardcode block names or config shapes. Alternative considered: TS-only frontend registry — rejected, makes parity with future MVP block additions (e.g. Luscii live) harder.

**D3 — Saved = enrollable; no publish step in PoC.**

Matches `F3` scope row. `PUT /pathways/{id}` replaces the definition wholesale. No draft/published split. MVP publish flow is a separate change.

**D4 — Phase 2 ships against a stub builder route; Phase 3 replaces the stub.**

Reasoning: overview + create flow + sidebar can land and demo without the canvas. Forces the create flow to be tested end-to-end (route + redirect) before the canvas absorbs all attention. Alternative considered: bundle all UI in one phase — rejected, kills iterative prototyping.

**D5 — Graph canvas package selected via audit in Phase 3, not pre-committed.**

Candidates: React Flow (xyflow), Reaflow, drawflow. Audit criteria: React 19 + Vite 8 compatibility, TS types, custom node rendering, controlled-state mode, license, maintenance signal. Document choice in `design.md` deltas during Phase 3 kick-off. Default expectation: React Flow / xyflow.

**D6 — Module + query-key naming follows existing `apps/orchestrator` FHIR-ready conventions.**

`modules/pathway/`, `pathwayKeys.list()` / `pathwayKeys.detail(id)` / `pathwayKeys.blocks()`. No FHIR resource backing (pathways are our domain, not FHIR), but the same shape so the orchestrator stays internally consistent.

**D7 — One change, three phases, sequential gates.**

Phases are review gates inside this change, not separate proposals. Reasoning: scope is small enough to fit one change; splitting into three proposals adds OpenSpec overhead without value. Each phase ends with a user review before the next starts.

**D9 — Lanes follow a mix model: auto-derived + custom + override.**

Each block type in the server catalogue declares a `default_lane_kind` (e.g. `hix.task` → `system_hix`, `manual.gate` → `caregiver`, `push.notification` → `patient`). The builder auto-renders a lane for every distinct default kind in use. Pathway authors can additionally `+ Add lane` for custom roles (e.g. "Apotheek") — these persist as `pathway_lane` rows. Any block can be moved into a custom lane, recorded as `pathway_block.lane_id` (NULL = use default).

Wireframe: `docs/wireframes/builder-lanes-mix.html`.

Reasons:
- Zero setup for the 90% case (default flows like the BIJLAGE PDF process work without any lane configuration).
- Custom lanes solve the 10% (Apotheek as distinct from generic Caregiver, Specialist subgroups, etc.).
- `pathway_lane` rows only exist for custom lanes — schema stays small.
- Block's natural home (HiX block in HiX lane) stays default; override is opt-in.

Alternatives considered:
- Fixed system-wide lanes (Patient/Caregiver/EPD/External) — too rigid for custom roles, breaks before MVP.
- Fully user-defined per-pathway — setup overhead on every pathway, inconsistent reporting across pathways.
- Pure derivation from block type — no escape valve for custom roles.

**D8 — Auto-save vs explicit save button: deferred to Phase 3 prototyping.**

Initial direction: explicit `Save` button + dirty indicator. Reason: simpler, no debounce/conflict logic, matches `F3` PoC scope. Re-evaluated in Phase 3 if prototyping shows save friction.

**D10 — Lanes persist as two tables: `lane_kind` catalogue + `pathway_lane` instances.**

Locks the storage shape behind D9.

```
lane_kind                  -- system catalogue, seeded migration
  id text PK               -- 'patient' | 'caregiver' | 'system' | 'external' | future
  label_i18n text          -- i18n key (e.g. 'lane.patient')
  color_token text         -- design-system token
  icon text
  default_ord int
  is_system boolean        -- true for seeded, false reserved for tenant-custom kinds (post-PoC)

pathway_lane               -- per-pathway lane instance
  id uuid PK
  pathway_id uuid FK ON DELETE CASCADE
  kind_id text FK -> lane_kind
  label text               -- defaults to lane_kind.label, overridable for custom (e.g. 'Apotheek' on caregiver kind)
  ord int
  is_default boolean       -- true = auto-derived from blocks of this kind; false = author-added
  UNIQUE (pathway_id, ord)

pathway_block.lane_id uuid NOT NULL FK -> pathway_lane
```

Reasons:
- `lane_kind` is data, not code — adding a kind = seed migration row, no deploy-coupled enum.
- Coarse 4 default kinds (`patient` / `caregiver` / `system` / `external`) keep visuals readable; integration (HiX vs Luscii) is a chip on the block, not a lane.
- `pathway_lane` always exists for any lane in use — defaults are materialized on first block placement, customs created via `+ Add lane`. Block always points at a real lane row, never at a kind directly. Avoids "phantom lane" branching at render time.
- `is_default` lets the UI hide an empty default lane and offer "Reset to default lanes" without losing custom rows.

Alternatives rejected:
- Single `pathway_lane` table with kind as enum column — re-introduces deploy coupling for new kinds.
- Lane-on-block via `kind_id` only (no `pathway_lane` row) — loses ordering, custom labels, and per-pathway "Apotheek under caregiver" override.

**D11 — Phases are per-pathway clinical chapters; not navigable; loopback is derived.**

Phases are the top-level "where in the journey" labels (Pre-op / Surgery / Recovery / Follow-up). They are anchored to a clinical event (often a surgery), are ordered, and carry an optional duration hint. They are NOT separate canvases — the user does not click into a phase. Blocks in any phase can edge to blocks in any other phase (incl. earlier ones); a "loopback" is just an edge whose target sits in a lower-`ord` phase, derived at render time.

```
pathway_phase                                  -- per-pathway, ordered
  id uuid PK
  pathway_id uuid FK ON DELETE CASCADE
  template_id text NULL                        -- optional ref to code-side template (see D14)
  label text
  ord int
  duration_value_id uuid NULL FK -> pathway_timing_value
  UNIQUE (pathway_id, ord)

pathway_block.phase_id uuid NOT NULL FK -> pathway_phase
```

Reasons:
- Phases give clinicians the mental scaffold ("this happens after surgery") without forcing the graph to be hierarchical.
- Single-canvas keeps the builder simple; phase bands at the top of the canvas are pure visual grouping.
- Loopback as derived (not a special edge type) means one edge model handles forward, branch, and loopback uniformly.

Alternatives rejected:
- Phases as own sub-canvases — fragments the flow, hides loopback intent.
- Phase as a tag on blocks (no `pathway_phase` row) — loses ordering and per-pathway duration hint.

**D12 — Time lives on `pathway_block.duration` and `pathway_edge.delay`, both via the shared `pathway_timing_value` table; tri-kind: fixed / enrollment / runtime.**

Time has two distinct meanings in a pathway:
- **Block duration** — how long the block itself takes (an appointment is 30 min, a wait-block is 3 days, a notification is instant).
- **Edge delay** — how long after the upstream block before the downstream block fires.

Both reference the same shared value table to keep timing semantics uniform and queryable across the pathway. The value table is a typed, normalized row — not a JSON blob — with a discriminator + CHECK constraints on the kind-specific columns:

```
pathway_timing_value
  id uuid PK
  kind text NOT NULL CHECK (kind IN ('fixed','enrollment','runtime'))

  -- kind = 'fixed'
  fixed_days int NULL

  -- kind = 'enrollment' (caregiver picks at enrollment; bounded)
  enrollment_default_days int NULL
  enrollment_min_days int NULL
  enrollment_max_days int NULL

  -- kind = 'runtime' (read from an upstream block's output at execution)
  runtime_source_block_id uuid NULL FK -> pathway_block
  runtime_source_output text NULL

  CHECK (
    (kind = 'fixed'      AND fixed_days IS NOT NULL
                         AND enrollment_default_days IS NULL AND runtime_source_block_id IS NULL)
 OR (kind = 'enrollment' AND enrollment_default_days IS NOT NULL
                         AND fixed_days IS NULL AND runtime_source_block_id IS NULL)
 OR (kind = 'runtime'    AND runtime_source_block_id IS NOT NULL AND runtime_source_output IS NOT NULL
                         AND fixed_days IS NULL AND enrollment_default_days IS NULL)
  )

pathway_block.duration_value_id uuid NULL FK -> pathway_timing_value   -- NULL = instant
pathway_edge.delay_value_id     uuid NULL FK -> pathway_timing_value   -- NULL = no delay
```

Reasons:
- **Three lifecycles, one shape**: design-time (`fixed`), enrollment-time (`enrollment` w/ bounds), runtime (`runtime` reading an upstream output). Same surface for builder UI, enrollment wizard, and execution engine.
- **Shared table** keeps duration + delay queryable as one concept ("show all variable timing on this pathway") and avoids duplicating CHECKs on two tables.
- **No JSONB on timing**: typed columns + CHECK keep validation in the DB and let plain SQL diffs surface drift (see naming/exceptions section for the one purposeful jsonb).
- **NULL FK = instant / no delay** keeps the row count down for the common case without losing the seam.

Alternatives rejected:
- One JSONB column per timing field — fails the NO JSONB rule, loses queryability.
- CTI (one row per kind, three sub-tables) — more joins, no real win at PoC scale.
- Separate `pathway_block_timing` and `pathway_edge_timing` tables — duplicates the discriminator + CHECK; harder to reason about as one concept.

**D13 — Block card UI is fixed-width; smart time tape is a future visual; data shape is built for it now.**

The canvas renders block cards at a constant width (≈175px) regardless of `duration_value`. Time visualization appears as:
- Time chips on the card (e.g. `3d` / `0–7d` / `runtime`) — Phase 3.
- A separate "smart time tape" lane above the rails (solid = fixed segment, striped = variable, dashed = slack) — **deferred post-PoC**, but the data model (D12) already supports it.

Reasons:
- Scaling cards by duration produces "ugly" canvases at any non-trivial range (3d card vs 90d card). User explicit feedback.
- Tape concept is appealing but visually heavy; not worth the build inside this change. Data shape preserves the seam so a later change can render the tape without a migration.

**D14 — Phase templates live in code, not the DB; mirrors D2 block catalogue.**

A phase-template registry on the backend ships with default chapter sets (e.g. Rugrevalidatie: `Pre-op` → `Surgery` → `Recovery` → `Follow-up`). The builder offers them in a "+ Add phase" picker; a chosen template seeds `pathway_phase.label`, `ord`, and optional default `duration_value_id`. After creation the row is just a `pathway_phase` — no FK back to the template.

```
GET /pathway-phase-templates  -> [{ id, label, default_ord, default_duration_days, ... }]
pathway_phase.template_id text NULL  -- soft pointer for analytics; no FK constraint
```

Reasons:
- Same operating model as block catalogue (D2): server-owned, deploy-coupled additions, no tenant authoring.
- `template_id` as a soft pointer (no FK) lets templates be renamed/removed without breaking pathways that already used them.
- Custom phases stay first-class — `template_id` is NULL for them.

Alternatives rejected:
- Phase templates as their own DB table — tenant-authoring surface we don't want in PoC.
- Per-pathway phase clone with hard FK — coupling without benefit for a code-side catalogue.

## Naming Conventions & Schema Exceptions

**Convention.** Every pathway-domain table is prefixed `pathway_`. This includes shared/lookup tables (`pathway_timing_value`) and catalogue tables (`pathway_lane_kind`) so other domains (e.g. tenant-base, user-base, future enrollment) can never collide on a generic name like `lane_kind` or `timing_value`. Junction/extension tables encode the relationship explicitly (`pathway_block_luscii_extension`).

**Exception 1 — `pathway_block.config jsonb`.** Block-type-specific config is intentionally a single jsonb column. It's validated at the app boundary by Pydantic against the per-type `config_schema` returned by `GET /pathway-blocks` (D2). Reasons it earns the exception: the schema is already authoritative and lives in code; per-type relational tables would multiply with every block type added; the catalogue already documents shape. This is the ONLY jsonb in the schema.

**Exception 2 — `pathway_block_luscii_extension.payload text`.** The Luscii clinical-path payload is opaque by contract (we do not interpret it; MDR-relevant). Stored as text in a dedicated extension table rather than on `pathway_block` so the generic table stays clean and the extension only exists for blocks that actually use it. Not jsonb — we never query into it.

```
pathway_block_luscii_extension
  block_id uuid PK FK -> pathway_block ON DELETE CASCADE
  payload text NOT NULL              -- opaque, round-tripped byte-for-byte
```

**YAGNI drops** during the audit: `pathway_lane_kind.is_system`, `pathway_phase.color_token`, `pathway.created_by`, `pathway_block.created_at`/`updated_at`. Re-add when a real consumer asks.

**Final table count: 11.** `pathway_lane_kind`, `pathway_timing_value`, `pathway`, `pathway_phase`, `pathway_lane`, `pathway_block`, `pathway_block_luscii_extension`, `pathway_branch`, `pathway_edge`, `pathway_time_marker`, `pathway_block_field_resolution`.

## Risks / Trade-offs

- **[Data model painted into a corner by JSONB shortcut]** → Mitigated by collab session before Phase 1 implementation; design.md amended with the chosen shape and the seam to a relational split if needed for MVP.
- **[Graph canvas package wrong choice — discovered late]** → Mitigated by D5 audit gate in Phase 3 kick-off, before integration. Spike a throw-away render of the seeded pathway with the top candidate before committing.
- **[Block-catalogue server-roundtrip cost on every builder open]** → Negligible at PoC scale (≤10 block types). Cached on the client with `pathwayKeys.blocks()` for the session.
- **[Phase 2 stub builder route confuses reviewers as "broken"]** → Mitigated by an explicit "builder coming in phase 3" placeholder with the pathway summary visible. Demo script for Phase 2 review calls this out.
- **[MDR drift via clever block additions]** → Mitigated by the block catalogue being server-owned and reviewed; any block that interprets clinical data must trigger `mdr-watchlist.md` before merge. Documented in the backend module's AGENTS.md addendum.
- **[Frontend prototyping iterations creep beyond the change scope]** → Mitigated by phase boundaries being real review gates with a written summary of decisions before Phase 3 starts.

## Migration Plan

No production data exists. Phase 1's DB migration is additive (new tables) — straight forward in dev. Roll-forward only; no rollback path needed for PoC. Seeded Rugrevalidatie pathway lands in the same migration script (or a seed task) so phase 3 prototyping always has content to render.

## Resolved (was Open)

- **Storage shape** → relational with one purposeful jsonb (D10–D14, Naming/Exceptions).
- **Pathway identifier** → UUID PK; no slug in PoC.
- **Block config validation** → both. Pydantic on save against catalogue's `config_schema` (D2); frontend rjsf renderer enforces on input (Phase 3).
- **Entry-point semantics** → explicit `pathway.entry_block_id` FK to `pathway_block`.
- **Edge metadata for decision blocks** → branches are first-class entities (`pathway_branch`); edges carry an optional `source_branch_id` to disambiguate which branch they leave from.

## Open Questions

- **Graph canvas package**: confirmed in Phase 3 audit. Default expectation: React Flow / xyflow.
- **Create flow shape**: full route `/pathways/new` vs modal-from-overview. Decided in Phase 2 prototyping.
- **Save UX**: explicit button + dirty indicator (default) vs auto-save. Revisited in Phase 3.
- **Smart time tape rendering**: data shape locked (D12); visual tape itself revisited post-PoC (D13).
