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
- Real Luscii Builder API integration — and the `luscii-clinical-path` block itself was removed from the PoC catalogue. If/when external-system blocks return, they stay reference-only per `openspec/scope.md` mocks row.
- Real-time collaborative editing, comments, branching/diffing of pathway definitions.
- Pathway versioning / publish workflow — `[mvp]` delta, parked in scope deltas.
- A homegrown graph-canvas renderer.
- Encoding clinical reasoning of any kind — MDR-relevant. Builder composes operational steps only.

## Decisions

**D1 — Pathway is a single aggregate; relational child tables, not JSONB graph.**

A pathway definition is one `pathway` row plus 10 child tables (see Naming/Exceptions section for the full list). PoC operations are whole-pathway load/replace, but lanes/phases/timing are queried independently for builder UI and future analytics, so a JSONB graph blob would require app-side reshaping for every read. Per-block-type config is the only field with deliberately variable shape — that's the one purposeful jsonb (Exception 1). All other structural data is relational with FKs and CHECK constraints.

**D15 — Aggregate tables inherit repo base classes (`TenantOwnedEntity`).**

Every per-pathway table extends `apps/backend/app/db/base.py::TenantOwnedEntity` (which itself extends `AuditableEntity` → `Entity`). Free inherited columns: `id`, `created_at`, `updated_at`, `deleted_at` (soft delete), `created_by`, `updated_by`, `deleted_by`, `tenant_id` (NOT NULL, ON DELETE RESTRICT). `pathway_lane_kind` is system-wide and inherits plain `Entity` only. Audit columns are auto-stamped by the `before_flush` hook from `session.info[SESSION_ACTOR_KEY]`. Soft delete: `DELETE /pathways/{id}` sets `deleted_at` and `BaseRepository.list()` filters it out.

**D16 — Entry block is not a definition-time property.**

The pathway aggregate has no `entry_block_id`. Execution start is picked at enrollment time (F4, separate change). The builder guarantees ≥1 block exists; nothing more. Aligns with React Flow's save shape (nodes + edges, no entry pointer) and removes the would-be circular FK between `pathway` and `pathway_block`.

**D17 — PoC timing kinds: `fixed` + `enrollment` only. Runtime kind deferred to MVP.**

`pathway_timing_value.kind` CHECK is `fixed | enrollment`. The `runtime` kind (block A's duration reads block B's output at execution) is parked in `openspec/scope.md` F3 MVP delta. Reintroducing it later is additive: widen the CHECK, add `runtime_source_block_id` + `runtime_source_output`, add `output_schema` to the block-type catalogue. No migration of existing rows needed.

**D18 — Field resolution table flags enrollment-deferred config fields only.**

`pathway_block_deferred_field` collapses to `(id, block_id, field_path)` for PoC. A row marks that `field_path` (must exist in the block's `config_schema`) is filled at enrollment rather than design-time. Runtime resolution is dropped per D17 and re-added together with the runtime timing kind.

**D19 — Branch ownership enforced app-side, against block-type catalogue.**

`pathway_block_branch` rows are permitted only on blocks whose catalogue entry advertises branching support. PoC: Pydantic on save hard-codes the check against `type == 'decision'`. Once the block-type catalogue (D2) gains per-entry behaviour flags (e.g. `supports_branches: bool`), the validator reads the flag instead. No DB trigger / CHECK — the catalogue lives in code (mirrors D2 operating model), and DB enforcement of a code-side enum is awkward. REST + Pydantic cover all real entry points.

**D20 — Edges are unique on `(source, target, branch)` with defense-in-depth.**

`pathway_edge` enforces `UNIQUE (source_block_id, target_block_id, source_branch_id) NULLS NOT DISTINCT` at the DB layer. Duplicate connectors (e.g. accidental double-drag in the builder) are bugs, not features; branch tag is part of the key so yes/no branches can both legitimately route to the same target. The builder UI ALSO refuses duplicate-edge creation before save so users see the conflict before a 422. Postgres ≥15 syntax — repo already targets 15+.

**D2 — Block-type catalogue is server-owned, returned by `GET /pathways/blocks`.**

The frontend renders blocks driven by per-block JSON schema returned from the server. Reasoning: adding/changing a block type stays a backend concern; the orchestrator doesn't hardcode block names or config shapes. Alternative considered: TS-only frontend registry — rejected, makes parity with future MVP block additions (e.g. Luscii live) harder.

**D3 — Saved = enrollable; no publish step in PoC.**

Matches `F3` scope row. `PUT /pathways/{id}` replaces the definition wholesale. No draft/published split. MVP publish flow is a separate change.

**D4 — Phase 2 ships against a stub builder route; Phase 3 replaces the stub.**

Reasoning: overview + create flow + sidebar can land and demo without the canvas. Forces the create flow to be tested end-to-end (route + redirect) before the canvas absorbs all attention. Alternative considered: bundle all UI in one phase — rejected, kills iterative prototyping.

**D5 — Graph canvas package: `@xyflow/react` (React Flow 12), confirmed via Phase 3 audit.**

Audit results (May 2026):

| Candidate | Verdict | Notes |
|---|---|---|
| `@xyflow/react` 12.10.2 | **picked** | MIT, TS-native, peer `react: ">=17"` (works with our React 19.2.6), 36.6k stars, last release March 2026, controlled-state mode + custom React-component nodes documented, Vite-friendly (official `xyflow/vite-react-flow-template`). Internal `zustand ^4.4.0` dep co-exists with repo's zustand 5 (separate store instance; minor bundle dup, no functional clash). |
| `reaflow` 5.4.1 | rejected | Last published ~1 year ago, no React 19 compat statement, less ecosystem momentum. |
| `drawflow` + `react-Drawflow` | rejected | Public React wrapper marked discontinued (moved to private repo). Hard dependency risk. |

Reason for picking xyflow: meets every audit criterion, largest ecosystem (templates, examples, RJSF/Tailwind compat references), controlled-state mode is a first-class feature documented for our exact use case (save button driven by current canvas state). Risk parked: if zustand 4-vs-5 duplication causes a real bundle/runtime issue, revisit — not a blocker for PoC.

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

**D11 — Phases are per-pathway clinical chapters; not navigable; loopback is derived; PoC phases are decorative.**

Phases are the top-level "where in the journey" labels (Pre-op / Surgery / Recovery / Follow-up). They are ordered. They are NOT separate canvases — the user does not click into a phase. Blocks in any phase can edge to blocks in any other phase (incl. earlier ones); a "loopback" is just an edge whose target sits in a lower-`ord` phase, derived at render time.

PoC scope: phases are pure visual chapter labels. No anchor event, no duration, no runtime date math. Block-level timing (`fixed` / `enrollment`) drives everything. Anchor model (when phase X starts for patient Y) is parked in MVP delta and decided when F5/F6 runtime engine lands.

```
pathway_phase                                  -- per-pathway, ordered
  -- inherits TenantOwnedEntity: id, tenant_id, created_at, updated_at, deleted_at, audit FKs
  pathway_id uuid FK ON DELETE CASCADE
  template_id text NULL                        -- optional soft pointer to code-side template (see D14); no FK
  label text NOT NULL
  ord int NOT NULL
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

**D12 — Time lives on `pathway_block.duration` and `pathway_edge.delay`, both via the shared `pathway_timing_value` table. PoC kinds: `fixed` + `enrollment`. `runtime` is MVP (D17).**

Time has two distinct meanings in a pathway:
- **Block duration** — how long the block itself takes (an appointment is 30 min, a wait-block is 3 days, a notification is instant).
- **Edge delay** — how long after the upstream block before the downstream block fires.

Both reference the same shared value table to keep timing semantics uniform and queryable across the pathway. The value table is a typed, normalized row — not a JSON blob — with a discriminator + CHECK constraints on the kind-specific columns:

```
pathway_timing_value
  -- inherits TenantOwnedEntity: id, tenant_id, audit, timestamps, soft delete
  kind text NOT NULL CHECK (kind IN ('fixed','enrollment'))

  -- kind = 'fixed'
  fixed_days int NULL

  -- kind = 'enrollment' (caregiver picks at enrollment; bounded)
  enrollment_default_days int NULL
  enrollment_min_days int NULL
  enrollment_max_days int NULL

  CHECK (
    (kind = 'fixed'      AND fixed_days IS NOT NULL
                         AND enrollment_default_days IS NULL)
 OR (kind = 'enrollment' AND enrollment_default_days IS NOT NULL
                         AND fixed_days IS NULL)
  )

pathway_block.duration_value_id uuid NULL FK -> pathway_timing_value   -- NULL = instant
pathway_edge.delay_value_id     uuid NULL FK -> pathway_timing_value   -- NULL = no delay
```

Reasons:
- **Two PoC lifecycles, one shape**: design-time (`fixed`) and enrollment-time (`enrollment` w/ bounds). Same surface for builder UI and enrollment wizard.
- **Shared table** keeps duration + delay queryable as one concept ("show all variable timing on this pathway") and avoids duplicating CHECKs on two tables.
- **No JSONB on timing**: typed columns + CHECK keep validation in the DB and let plain SQL diffs surface drift (see naming/exceptions section for the one purposeful jsonb).
- **NULL FK = instant / no delay** keeps the row count down for the common case without losing the seam.
- **Runtime kind deferred to MVP** (D17): no PoC seed flow needs it. Re-adding is additive (widen CHECK, add two nullable columns, add `output_schema` to block-type catalogue). Parked in `openspec/scope.md` F3 MVP delta.

Alternatives rejected:
- One JSONB column per timing field — fails the NO JSONB rule, loses queryability.
- CTI (one row per kind, sub-tables) — more joins, no real win at PoC scale.
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
GET /pathways/phase-templates -> [{ id, label, default_ord, default_duration_days, ... }]
pathway_phase.template_id text NULL  -- soft pointer for analytics; no FK constraint
```

Reasons:
- Same operating model as block catalogue (D2): server-owned, deploy-coupled additions, no tenant authoring.
- `template_id` as a soft pointer (no FK) lets templates be renamed/removed without breaking pathways that already used them.
- Custom phases stay first-class — `template_id` is NULL for them.

Alternatives rejected:
- Phase templates as their own DB table — tenant-authoring surface we don't want in PoC.
- Per-pathway phase clone with hard FK — coupling without benefit for a code-side catalogue.

### Builder canvas UX decisions (Phase 3 prototype)

Locked during the `builder-canvas-prototype.html` design pass (May 2026). All decisions assume `@xyflow/react` 12.x as the canvas substrate (D5) and the orchestrator's existing design tokens (Geist, ZAS teal `#266b5e`, Linear-tight radii 4/6/8/12, glass utilities).

**D21 — Builder shell is a 3-row grid.**

The `/pathways/{id}` route renders a fixed grid `topbar (64px) / subbar (44px) / canvas-frame (1fr)` inside the app shell. Sidebar stays collapsed-by-default while editing — the canvas earns the horizontal space. Frame fills with `position: absolute; inset: 0`. The canvas is the only scrollable region; subbar and topbar pin.

Reasons: predictable z-order, no surprise reflows when the drawer opens, the canvas dimensions stay knowable for xyflow viewport math.

**D22 — Phases render as full-height columns on the canvas with header chips.**

Each phase occupies a vertical column on the canvas (Pre-op 0–760, Operatie 760–1280, Herstel 1280–2000, Follow-up 2000–2320 in the seeded layout). The column has a tinted background (`--ph-soft`), a header chip `[N] Label … [count]` pinned at the top, and a divider between columns. Phase tint cascades to the numbered badge via `--ph-soft` / `--ph-ink` custom properties. The subbar phase row uses the SAME tokens so subbar ↔ canvas read as one system.

Reasons: phase membership is the most asked question ("which phase is this block in?"); columns make it spatial instead of textual.

**D23 — Lanes render as horizontal rows with sticky labels inside the canvas.**

Each lane is a horizontal band (`patient` 60–230, `caregiver` 230–400, `system` 400–560, `external` 560–710 in the seeded layout). Lane label is a glass chip pinned at `position: sticky; left: 12px` so it stays visible during horizontal scroll, contains the lane icon + name + count, and exposes `--lane-accent` to every block in the row. The left-rail lane menu from earlier iterations is removed — lanes-in-canvas obsoletes it.

Reasons: a single source of truth for lane membership; sticky labels survive zoom-out without occluding the canvas; one fewer panel.

**D24 — Edge routing is orthogonal smoothstep with gentle Q-curve corners; no arrowheads.**

Edges are SVG `<path>` elements using H/V segments with `Q` corners at ~8–10px radius. Color = neutral `#cbd1d8` (1.75px) by default, `--primary` (2px) for branch-positive or cross-phase, `dashed` for branch-negative. **No arrowheads** — direction is implied by port placement (out-right → in-left) and node order. Delay labels (`+1d`, `+7d`) sit centered on the longest straight segment.

Reasons: arrowheads at PoC fidelity looked dirty against tight grid. Direction is unambiguous from ports + flow. Q-corners match the n8n/react-flow "smoothstep" feel.

**D25 — Connection ports are visible affordances on every block.**

Each block exposes a single `in` port (mid-left, 11px circle, lane-accent border) and a single `out` port (mid-right). Branching blocks (decision) replace the single `out` with `out-yes` (top-right, `top: 28%`) and `out-no` (bottom-right, `top: 72%`). Ports scale 1.25× on block hover. They are the only legitimate edge endpoints — xyflow's `Handle` components map 1:1 to these visual ports.

Reasons: explicit ports remove the "where do I drag from?" guesswork and match the user's mental model from React Flow / n8n / Zapier-class tools.

**D26 — Block group = one moment in time, multiple blocks triggered in order.**

A `block-group` is a dashed lane-tinted container holding 2+ ordered child blocks that share a single trigger moment (e.g. a Pre-op protocol delivered as four sequential steps on `D+10`). The group has:
- one outer `in` port and one outer `out` port (children are not individually edge-targets);
- a header row with uppercase label + step count + day-chip;
- numbered children (`1 / 2 / 3 / …`) each rendered as a slim row (`14px idx | 24px ico | 1fr name | auto type`).

This replaces the earlier "Volume" scene that scattered 28 micro-blocks across the canvas. Data model implication: groups need a parent-block-of-group relation or a `pathway_block_group` table — parked for Phase 3 implementation, prototype only validates the UX.

Reasons: protocols-as-bundle is a real clinical pattern; rendering them as a scatter buried the time-locked-cluster intent.

**D27 — Block-card anatomy is fixed: 220×68, 3-col grid.**

`grid-template-columns: 4px 36px 1fr` → rail-bar (lane-accent vertical strip) | ico-tile (lane-tinted 28px square with type icon) | name + meta row. Meta row is `type · day-chip` (e.g. `Taak · D0`, `Afspraak · 30 min · D0+1`). Selected state lifts the card 1px and adds `--lane-accent` border + glow. Entry-block flag renders as a `START` corner-tab inside the card (top-left, `border-top-left-radius` + `border-bottom-right-radius` only) — not an absolutely-positioned overlay, to avoid clipping by phase headers.

Reasons: fixed width keeps the canvas legible regardless of durations (D13). The corner-tab survives every z-context.

**D28 — Topbar pattern: identity → meta → status → presence → actions.**

Reading left-to-right: gradient pathway-id tile (32px, ZAS teal→mint, with workflow icon) → vertical stack of `eyebrow-crumb` (uppercase, `Zorgpaden / Rugrevalidatie`) above `title-row` (`Rugrevalidatie [edit] · 9 blokken · 4 fasen · bewerkt 13:24`) → slim status pill (warm-amber pulsing dot when dirty, success when saved, danger when error) → flex spacer → presence avatar stack → 1px vertical divider → undo/redo icon-buttons → `Geschiedenis` ghost button → `Opslaan` primary button with gradient-active background. Height 64px so the meta line breathes; topbar uses backdrop-filter blur + a faint gradient-aurora bleed at the bottom.

Reasons: topbar was previously flat and "boring" (user feedback). The identity → meta → status → actions sequence is the same pattern Linear/Figma/Pitch use; it gives the page a personality without screaming.

**D29 — Combined minimap + zoom panel sits bottom-right; subbar acts as phase anchors.**

The right-bottom panel is a single ~220px-wide glass card stacking `mm-map` (132px tall, scaled-down block dots colored by `--lane-accent`) over `mm-bar` (`-` icon · `%` percent · `+` icon · `fit-to-screen` icon). The standalone zoom strip is gone — one floating UI element instead of two. The subbar renders phase entries as `[idx] Label` anchors separated by chevrons (not tabs); clicking scrolls the canvas to that phase's column. No "active phase" highlight — anchors are navigational, not stateful.

Reasons: fewer floating things, one combined control. Anchors instead of tabs because phases are spatial regions, not view modes.

## Lifecycle, create-flow & empty-canvas decisions (Phase 2/3)

**D30 — Pathway lifecycle is `concept → published` with a one-way publish action.**

Newly created pathways land in `concept` and are NOT eligible for patient enrollment until the caregiver explicitly publishes via `POST /pathways/{id}/publish`. `published` pathways may still be edited; future archival is `published → archived` (parked). The same builder canvas component renders both modes — lifecycle only flips which signals (status badge copy, topbar primary action, save policy) are active.

Reasons: separating "I'm sketching" from "patients can join this" is a clinical-safety axis, not a UI nicety. A one-way explicit gate avoids accidental enrollment on a half-built path; allowing edits post-publish keeps the door open for live tuning. Builder-as-one-component (not a wizard + an editor) means concept and edit flows share every interaction, animation, and bug fix.

**D31 — Concept pathways autosave (debounced 800ms); published pathways use manual save.**

Autosave runs only while `status === concept`. Debounce: 800ms after last edit settles. `⌘S` force-flushes. Status pill copy disambiguates the four states: `automatisch opgeslagen` / `niet opgeslagen` / `wijzigingen opslaan…` / `opslaan mislukt`. Once published, the existing §17 manual-save state machine takes over. Publish is guarded — clicking `Publiceren` while autosave is dirty or in flight forces a flush first; flush failure aborts publish.

Reasons: concept mode is exploratory — users move fast and shouldn't lose work to forgetting Save. Published is auditable — every save is a deliberate revision moment, and manual save preserves §17's audit-friendly state transitions. Splitting policy by lifecycle costs almost nothing because the pill already has four states; just the copy and the debounce wrapper change. The publish guard exists because publishing while an autosave is pending could publish a slightly-stale version — unacceptable for an enrollment gate.

**D32 — Create-pathway dialog is a modal-from-overview with 5 fields; no full-route create page.**

Modal captures name, clinical_goal, patient_goal, phase_preset, owner. Submit triggers `POST /pathways` and routes to `/pathways/{id}` with pre-seeded cache (no loading flash). Dialog is prettified to match the new topbar identity language: 40px gradient identity tile + uppercase eyebrow + grouped fields + gradient-active submit button.

Reasons: a modal keeps the user anchored to "where they were going" (the overview list), and the canvas is the real workspace — the dialog is an entrance, not a destination. Five fields instead of three (added phase_preset + owner) avoid a second "setup" step inside the canvas, which is the smallest amount of friction that still produces a useful starting point. Pre-seeding the detail cache from the mutation response removes the "create → loading skeleton → ready" flash that makes the create flow feel slow.

**D33 — Phase preset on create: `Standaard (4 fasen)` (default) vs `Leeg canvas`.**

`Standaard` seeds 4 phases (`Voorbereiding`, `Behandeling`, `Herstel`, `Nazorg`) with the default lane scaffold (`patient`, `caregiver`, `system`). `Leeg canvas` seeds zero phases and zero lanes. The builder canvas opens in `ready-empty` either way, but with different copy and CTAs.

Reasons: most clinical pathways slot into a standard arc — picking the preset means the canvas isn't intimidatingly empty on first open. The `Leeg canvas` escape hatch matters for one-off or atypical pathways (e.g. a follow-up-only path). Phase naming is opinionated to teach the model; users can rename later. Not offering a long preset library yet keeps the dialog one-screen.

**D34 — `BuilderShellState` is a 5-state matrix: `loading`, `not-found`, `error`, `ready-empty`, `ready-populated`.**

One discriminated union drives every shell variant. `not-found` and `error` are full-canvas cards (topbar still renders identity + back link so the user is never stranded). `ready-empty` renders the full chrome plus the empty-canvas first-block CTA. `ready-populated` is the normal canvas. Each state has scoped a11y treatment (`role="alert"` on error/not-found, `role="status"` on the loading skeleton).

Reasons: a single union forces every branch to be a designed surface rather than an afterthought rendered when something breaks. Topbar-always-rendered means the brand, identity, and back-out stay consistent across failure modes — the user never feels "lost in a broken page".

**D35 — First-block CTA anchors to the earliest phase + earliest lane; drop overrides default lane.**

When `ready-empty` and the scaffold exists, a dashed placeholder card sits at phase-1 × lane-1 with an arrow + label pointing down to the dock. Dropping a palette item onto the placeholder forces that block's lane to the placeholder's lane (overriding the type's `default_lane_kind_code`). If the scaffold is empty (`Leeg canvas` preset), the CTA shifts to a centered prompt pointing at the subbar `+ Fase` action.

Reasons: an empty canvas is the hardest moment in any builder — the user has to guess "where do I start?". A placeholder card teaches both the shape (this is what a block looks like) and the interaction (drag from the dock to here). Forcing the lane on drop trades a tiny override (type defaults) for guaranteed correctness of the first block's position — the user can rearrange after.

## Version-resolution & version-switching decisions (Phase 3 prototype)

**D36 — Hybrid route resolution: bare URL = current, `/v/$versionId` = historical (Q3 = iii).**

`/pathways/$pathwayId` resolves server-side to the latest concept if one exists, otherwise the latest published version (read-only fallback). `/pathways/$pathwayId/v/$versionId` always opens a specific version read-only. Read-only chrome activates when EITHER the URL is `/v/...` OR the resolved version's status ≠ `concept`. After a successful fork/restore the router navigates to bare `/pathways/{id}` — concept URLs never expose a version_id. See `history-spec.md` §5 for the loader contract.

Reasons: bare URL is shareable and stable for caregivers and admins ("send me the rugrevalidatie path") — they don't care about version numbers, they want the current state. The `/v/...` variant is for deliberate retrospective work (audit, comparison, restore). Hybrid avoids two failure modes: option (i) auto-resolve would silently land users on read-only published when they expected concept; option (ii) always-explicit would break shareability and add noise to every link the team passes around. Hybrid also gives loader logic one clear branch — bare = resolve, explicit = pin.

**D37 — Concept is one continuous WIP; no in-concept `Bewaar versie` checkpoint action (Q1 = a).**

A concept version is mutated freely and autosaved. There is no user-facing "save as new version" inside a concept — the only way to mint an immutable snapshot is publishing. After publish, the concept row's status flips to `published` and any further edits must fork a new concept (see D38 + §4 of `history-spec.md`).

Reasons: per the locked lifecycle, the meaningful boundary in a clinical-safety context is "patients can join this" (publish), not "I felt like saving" (manual checkpoint). Adding a checkpoint action would muddle the meaning of a version row — is `v.5` a publish or a save? — and make the patient-enrollment-pinning model harder to reason about. Autosave + undo/redo already cover the "I want to experiment without losing work" need that a checkpoint would otherwise address.

**D38 — Linear version chain, one concept maximum per pathway (Q2 = i).**

Versions form a strictly linear chain `v1 → v2 → v3 …`. At any moment a pathway has at most one row with `status = concept`, enforced by a partial unique index `(pathway_id) WHERE status = 'concept'`. No parallel concept branches. Restoring a historical version while a concept exists is refused (409 `concept_already_exists`); the user must publish or discard the existing concept first.

Reasons: parallel concepts ("alternative drafts") add a merge problem the PoC team is not staffed to solve and that has no clinical analogue (caregivers don't run A/B drafts of a care path). Linear chain matches how surgeons and care leads actually iterate — try, publish, learn, revise. Database-level enforcement is the cheap insurance against application bugs that would otherwise corrupt the enrollment-pinning model.

**D39 — Version-switch is a tiny topbar dropdown chip (dot + `v.{n}` + chev) anchored next to Save.**

Replaces the standalone `Geschiedenis` ghost button in the topbar. Trigger renders one colored status dot + `v.{n}` + chevron. Click opens a 240px popover grouped by `Werkversie` / `Gepubliceerd` with checkmark on the active row, plus a footer link to the full Geschiedenis drawer (the drawer is now reached only via this footer link). Trigger stays interactive even when the shell is read-only.

Reasons: an earlier prototype iteration put a chunky 3-button segmented control top-right and a tinted pill in the topbar identity stack — both made the chrome chaotic and competed with `Opslaan` for visual weight. A compact menu trigger is the standard pattern users already recognize from version-aware editors (Figma, Linear) and it collapses three controls (segmented switch + identity pill + Geschiedenis button) into one. The dot-on-trigger carries the status signal so the number stays neutral; the menu carries the choices so the topbar stays calm. The footer-link-to-drawer keeps the full version drawer available without paying for a permanent topbar button.

**D40 — Read-only chrome uses a tinted strip below the topbar with state-driven CTA.**

When read-only, a 36px tinted strip stacks between the topbar and the phase subbar. Variant follows the resolved version's status — published-fallback uses success tint + `Maak nieuwe versie` CTA; historical uses info tint + `Herstel als nieuw concept` CTA (plus `Terug naar huidige` ghost). Banner uses `role="status"`. The editing chrome (palette dock, save button, undo/redo, status pill) dims/disables via a single `.main.is-readonly` class on the shell.

Reasons: surfacing read-only state with a modal or a full overlay would be too heavy for what is a navigation choice, not an error. A thin colored strip is the lightest possible read-only signal that still tells the user *why* they can't edit and *what to do instead*. Driving variant from `version.status` (not the URL shape) keeps the rule one place: the banner, the ver-switch dot, and the crumb-version marker all read the same state and stay coherent. Dimming via a single shell-level class avoids per-component readonly props and keeps the chrome changes a styling concern.

**D41 — Crumb-version marker is a passive dot + `v.{n} {state}` token inline in the crumbs row.**

Always visible. No background, no border, no padding — just a 6px colored dot and tinted text. Color follows the same status palette as the ver-switch dot and the read-only banner. Decorative for AT (`aria-hidden="true"`) because the ver-switch trigger already announces the same info.

Reasons: caregivers need an at-a-glance answer to "what am I looking at right now?" that doesn't require opening the menu or reading the URL. A passive inline marker in the crumbs row is the smallest possible affordance for that — and pairing it with the ver-switch trigger (which is the *interactive* surface) cleanly separates identity from action. Earlier attempts to use a chip-with-background in the topbar identity stack added visual weight that competed with the title; a colored-dot-plus-text token disappears into the crumbs typography and only reads when the user is looking for it.

**D42 — Version labels are captured at publish time only (Q5 = a); publish modal owns `label`, `note`, clinical-approval checkbox.**

The publish modal — opened by clicking `Publiceren` after autosave has flushed (D31) — captures an optional single-line `label` (max 120 chars, placeholder `bijv. Post-MDR-update`), an optional multi-line `note` (max 2000 chars, placeholder `Wat is er veranderd t.o.v. de vorige versie?`), and a REQUIRED checkbox `Ik bevestig dat deze versie klinisch is goedgekeurd en geschikt voor patiëntinschrijving`. Confirm button is disabled until the checkbox ticks; `label` and `note` remain optional. On submit, `label` + `note` + `published_at` + `published_by` are written onto the same version row that just flipped `concept → published`. Concept rows and `restore-from-version` / `fork-from-publish` rows keep server-assigned auto-labels (`Werkversie`, `Hersteld van v.{n}`, `Nieuw concept op v.{n}`) and are NOT user-editable in PoC.

Reasons: publish is the only moment in the lifecycle where naming a version pays for itself — it's the immutable, audit-relevant snapshot that someone might later need to identify ("v.4 was the one before the MDR change"). Labels on concept rows would be noisy churn (caregivers edit drafts constantly, and the draft label would lose meaning once published). The mandatory checkbox is a clinical-safety gate, not a label concern: publishing a pathway opens it for patient enrollment, and forcing an explicit acknowledgment per publish creates the audit trail that compliance will eventually demand. Putting label + note + checkbox in one modal (vs. a separate "edit metadata" surface later) keeps the "publish moment" a single deliberate action — no two-step publish-then-annotate sequence where the user might publish and walk away.

**D43 — Restore is blocked when a concept already exists; user gets an "Open bestaande concept" escape (Q6 = a).**

When the user triggers `Herstel als nieuw concept` (from the read-only banner CTA, the Geschiedenis drawer row action, or the blocked-mutation modal on a published version) and the pathway already has a `concept` version, the restore confirmation modal swaps copy to `Er bestaat al een concept-versie (v.{n}). Wil je dat openen?` with buttons `Annuleren` and `Open bestaande concept`. The latter navigates to bare `/pathways/{id}`; the restore request is never sent. The server enforces the same rule as a backstop — `POST .../restore` and `POST .../fork-from/{versionId}` reject with HTTP 409 + machine-readable error code `concept_already_exists` when a concept exists for the pathway.

Reasons: D38 already enforces the one-concept-max invariant. Three plausible behaviors when the user requests restore-while-concept-exists: silently auto-discard the in-flight concept (clinical-safety hostile — caregiver loses WIP without informed consent); silently route them to the existing concept (hides the original intent — confusing); or explicitly block with an escape (this choice). Blocking with an inline "Open bestaande concept" affordance keeps the user oriented (they see their existing concept exists and can open it in one click) without destroying work. If they genuinely want to restore over the existing concept they must first publish or discard it — that's the right amount of friction for an action that throws away in-flight authoring. The 409 + error-code backstop guarantees the invariant even if a UI race condition (e.g. concept created in another tab) bypasses the pre-flight check.

**D44 — `pathway_version` stores nullable `derived_from_version_id` for lineage (Q7 = a).**

Every `restore-from-version` and `fork-from-publish` row writes `derived_from_version_id` pointing at the source version. `initial` rows (the first version of a pathway) leave it null. FK has `ON DELETE SET NULL` so deleting a source version doesn't cascade-orphan its descendants. Column drives the auto-label rendering in the Geschiedenis drawer and the version-switch menu (`Hersteld van v.{n}` / `Nieuw concept op v.{n}`) and powers any future lineage-tree visualization without a schema change. No separate `pathway_version_event` audit table in PoC (deferred to whenever audit/compliance needs arrive).

Reasons: the auto-labels (D42) literally require this column to render — dropping it would mean either inventing the label client-side from the request-time intent (lossy on reload) or storing the rendered string (denormalized, drifts when version_no renumbering ever happens). One nullable FK is the cheapest possible audit signal that survives reload, supports the labels for free, and unlocks the lineage view if/when product asks for it. A separate event table would be the "more correct" long-term shape but reads as YAGNI here — nothing in PoC queries it, and adding it later is a pure-append migration that won't conflict with this column.

**D45 — Pathway-level rollups are pure-derived now; migrate to hybrid denormalization on scale trigger (Q8 = a → c on trigger).**

Overview-list fields that summarise a pathway across its versions (`latest_published_version_id`, `latest_published_version_no`, `latest_published_at`, `has_concept`, `concept_version_id`, `block_count`, `last_edited_at`) are computed at query time in PoC. The overview endpoint joins `pathway` against `pathway_version` via two `LATERAL` subqueries (latest-published, current-concept) plus a `LEFT JOIN LATERAL` count over `pathway_block` for the resolved version's block tally. Required indexes: `pathway_version (pathway_id, status, published_at DESC)`, the existing partial unique `pathway_version (pathway_id) WHERE status = 'concept'`, `pathway_block (pathway_version_id)`, and `pathway (tenant_id, deleted_at, updated_at DESC)`. No denormalized columns on `pathway` in PoC. When a single tenant's overview exceeds ~200ms p95 (target trigger; revisit with real telemetry), migrate to **hybrid (c)**: denormalize only the two cheapest fields — `latest_published_version_id uuid` and `has_concept bool` — on `pathway`, maintained transactionally inside the publish/restore/fork RPCs. Leave `block_count` and `last_edited_at` derived even after migration, so the autosave hot path never touches the parent row.

Reasons: PoC scale is ≤25 pathways × ≤2 tenants; pure-derived (a) keeps schema honest, has zero write-path complexity, and the tenant-scoped query under the listed indexes is bounded by `LIMIT 50`-style overview pagination — well inside budget. Fully denormalized (b) adds five+ columns the autosave hot path would have to keep in sync, and any divergence (forgotten path, failed RPC retry, manual SQL) silently lies on the overview — a clinical-safety smell. Hybrid (c) only earns its keep when overview latency starts visibly slipping; deferring it until a measured trigger fires avoids paying the consistency tax for free. Picking the migration shape now means the eventual switch is a pure-additive migration: backfill `latest_published_version_id` + `has_concept` once, flip the overview query, leave everything else alone. Keeping `block_count` and `last_edited_at` derived even post-migration is the deliberate exception — those would invalidate on every autosave tick and the rollup query at that point already runs in <50ms.

**D46 — Published versions are read-only; edits trigger fork-on-edit. No manual `Save` button anywhere.**

Supersedes the "published pathways use manual save" half of D31. Aligns with D36–D45 + `history-spec.md` §0 (`published` is immutable). The builder topbar right cluster has exactly one primary action: `Publish version` (i18n key `pathway.topbar.publish`, replacing `pathway.topbar.save`). On concept, the button is enabled iff save-state pill = `clean` AND not read-only; it opens the publish modal (D42). On any read-only version (published or historical), the button stays disabled — the read-only banner (D40) owns the call to action (`Maak nieuwe versie` / `Herstel als nieuw concept`). Any mutating action attempted against a read-only version routes through the fork-on-edit intercept (Phase 5 task 5.11): modal `Nieuwe versie nodig` → `POST /pathways/{id}/versions/{versionId}/fork-from-publish` → navigate bare URL → replay intercepted mutation as first edit on the new concept. The autosave 409-`pathway_version_immutable` path (task 5.12) feeds the same modal so race-window mutations resolve identically.

Reasons: a `Save` button on `published` would either (a) overwrite immutable history — violates lifecycle invariant, or (b) silently fork — surprises the user. Fork-on-edit makes the lineage explicit: every published version stays an audit-able artefact, and every edit lands on a fresh concept the user can iterate on freely. Collapsing the topbar primary action to a single label across both modes removes the cognitive split D31 carried — there is no "save policy by lifecycle"; there is autosave on concept, fork on read-only, publish as the only explicit user action.

## Naming Conventions & Schema Exceptions

**Convention.** Every pathway-domain table is prefixed `pathway_`. This includes shared/lookup tables (`pathway_timing_value`) and catalogue tables (`pathway_lane_kind`) so other domains (e.g. tenant-base, user-base, future enrollment) can never collide on a generic name like `lane_kind` or `timing_value`.

**Exception 1 — `pathway_block.config jsonb`.** Block-type-specific config is intentionally a single jsonb column. It's validated at the app boundary by Pydantic against the per-type `config_schema` returned by `GET /pathways/blocks` (D2). Reasons it earns the exception: the schema is already authoritative and lives in code; per-type relational tables would multiply with every block type added; the catalogue already documents shape. This is the ONLY jsonb in the schema.

**MDR / external-system note.** The `luscii-clinical-path` block type was removed from the PoC catalogue (Phase 3 scoping); the seeded Rugrevalidatie pathway now uses a `timer` block in the Recovery phase instead. Schema is unchanged. If/when external-system blocks return (Luscii care-path, FHIR pulls, HiX tasks), they MUST stay reference-only: `config` jsonb stores IDs/URLs only — never the upstream payload — and backend MUST NOT fetch, parse, or mirror clinical content. Pattern is documented here for future re-introduction.

**YAGNI drops** during the audit: `pathway_lane_kind.is_system`, `pathway_phase.color_token`, `pathway.last_edited_at` (replaced by inherited `updated_at` from `Entity`). `created_at`, `updated_at`, `created_by`, `updated_by` come from the repo base classes (D15) for free — keep them everywhere.

**Final table count: 10.** `pathway_lane_kind`, `pathway_timing_value`, `pathway`, `pathway_phase`, `pathway_lane`, `pathway_block`, `pathway_block_branch`, `pathway_edge`, `pathway_time_marker`, `pathway_block_deferred_field`.

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

- **Storage shape** → relational with one purposeful jsonb (D10–D18, Naming/Exceptions).
- **Pathway identifier** → UUID PK from `Entity` base; no slug in PoC.
- **Block config validation** → both. Pydantic on save against catalogue's `config_schema` (D2); frontend rjsf renderer enforces on input (Phase 3).
- **Entry-point semantics** → no design-time entry (D16). Enrollment picks the start block.
- **Edge metadata for decision blocks** → branches are first-class entities (`pathway_block_branch`); edges carry an optional `source_branch_id` to disambiguate which branch they leave from.
- **Repo base inheritance** → every per-pathway table extends `TenantOwnedEntity` (D15). Audit, timestamps, soft delete, tenancy come for free.
- **Branch ownership enforcement** → app-side Pydantic against catalogue's branching flag (D19). No DB trigger.
- **Edge uniqueness** → UNIQUE `(source_block_id, target_block_id, source_branch_id) NULLS NOT DISTINCT` + UI prevention (D20).
- **Graph canvas package** → `@xyflow/react` 12.x (D5 audit, May 2026).
- **Create flow shape** → modal-from-overview with 5 fields (D32). Pre-seeds builder cache; no separate create route.
- **Save UX** → autosave for `concept`, manual save for `published` (D30 + D31). Publish action gated on clean autosave.
- **Route resolution for `/pathways/$pathwayId`** → hybrid (D36). Bare URL resolves to current (concept-if-exists else latest published, read-only fallback); `/v/$versionId` opens specific historical version read-only.
- **Concept checkpointing inside a version** → none (D37). Only publish creates an immutable snapshot.
- **Concurrent concept versions** → at most one (D38), enforced by partial unique index.
- **Topbar version surface** → tiny dropdown chip next to Save (D39); replaces standalone Geschiedenis topbar button; full drawer reached via menu footer.
- **Read-only chrome** → tinted strip below topbar with state-driven CTA (D40); shell carries `.is-readonly` class to dim editing controls.
- **Passive version identity in crumbs** → dot + `v.{n} {state}` marker (D41); decorative-for-AT, paired with the ver-switch chip as the interactive surface.
- **Version label scope** → publish-time only (D42). Publish modal captures optional `label` + optional `note` + required clinical-approval checkbox. Concept/restore/fork rows keep auto-labels.
- **Restore preconditions when a concept exists** → block (D43). Restore confirmation swaps copy to offer "Open bestaande concept" escape; server enforces with 409 `concept_already_exists`.
- **Version lineage tracking** → yes, nullable `derived_from_version_id` FK on `pathway_version` (D44). Populated on restore/fork rows; drives auto-labels and future lineage view; ON DELETE SET NULL.
- **Pathway-level rollups (overview summary)** → pure-derived in PoC via `LATERAL` joins on indexed `pathway_version` + `pathway_block` (D45 = a). Required indexes listed in `history-spec.md §6`. Migrate to hybrid (denormalize only `latest_published_version_id` + `has_concept` on `pathway`) when a tenant's overview crosses ~200ms p95; keep `block_count` + `last_edited_at` derived to keep autosave hot path off the parent row.

## Open Questions
- **Smart time tape rendering**: data shape locked (D12); visual tape itself revisited post-PoC (D13).
- **Phase anchor model**: parked. Decide when F5/F6 runtime needs phase dates (likely `anchor_block_id` or `anchor_event_type`).
- **Runtime timing kind**: parked in MVP delta (D17). Re-add together with `output_schema` on block-type catalogue.
- **Publish reversal**: whether `published → concept` is allowed and under what conditions (D30).
- **Autosave debounce duration**: 800ms is a guess (D31); user-test before locking.
