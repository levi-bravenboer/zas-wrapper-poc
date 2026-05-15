## 1. Phase 1 — Backend pathway domain

### 1a. Collab gate (before any code) — DONE

- [x] 1.1 Data-model collab session with the user; decisions D1, D9–D14 captured in `design.md`
- [x] 1.2 `design.md` amended with chosen shape (relational + one purposeful jsonb), Naming Conventions & Schema Exceptions, Resolved/Open Questions sections
- [x] 1.3 Block-config validation: both — Pydantic on save (backend) against catalogue's `config_schema`, rjsf on input (frontend Phase 3)

### 1b. Domain + persistence

- [ ] 1.4 Create `apps/backend/.../pathway/` module (domain entities, repository, Pydantic schemas)
- [ ] 1.5 Add DB migration for the 10 canonical tables (per `design.md` D15 / Naming Conventions & Schema Exceptions). Every per-pathway table inherits `TenantOwnedEntity` (id, tenant_id, audit FKs, timestamps, soft delete). `pathway_lane_kind` inherits plain `Entity`:
  - `pathway_lane_kind` (catalogue, seeded `patient`/`caregiver`/`system`/`external`)
  - `pathway_timing_value` (shared, `kind` ∈ (`fixed`, `enrollment`) — runtime kind parked in MVP delta; CHECK enforces column-set per kind)
  - `pathway` (aggregate root; no entry_block_id — enrollment picks the start)
  - `pathway_phase` (per-pathway, ordered, optional `template_id` soft pointer)
  - `pathway_lane` (per-pathway, FK to `pathway_lane_kind`, `is_default` flag, `(pathway_id, ord)` unique)
  - `pathway_block` (FK to phase + lane, `config jsonb` — Exception 1, optional `duration_value_id`, `x`/`y` int)
  - `pathway_branch` (decision-block branches, ordered; ownership validated app-side against catalogue's branching flag per D19)
  - `pathway_edge` (FKs source/target block, optional `source_branch_id`, optional `delay_value_id`; UNIQUE `(source_block_id, target_block_id, source_branch_id) NULLS NOT DISTINCT` per D20)
  - `pathway_time_marker` (presentation-only, FK to `pathway_timing_value`)
  - `pathway_block_field_resolution` (block_id + field_path; marks enrollment-deferred fields)
- [ ] 1.6 Implement pathway aggregate; soft-delete via base `deleted_at`; cascade child rows on pathway delete via `pathway_id` FK ON DELETE CASCADE (tenant FK stays RESTRICT)
- [ ] 1.7 Implement block-type registry as a server-side static map (`appointment`, `decision`, `milestone`, `timer`, `luscii-clinical-path`) with `default_lane_kind_id` + per-type JSON schema for config
- [ ] 1.8 Implement phase-template registry as a server-side static map (Rugrevalidatie chapters: `pre-op`, `surgery`, `recovery`, `follow-up`) with `default_ord`
- [ ] 1.9 Validate pathway blocks against the catalogue on save; reject unknown block types with 422; validate each block's `config` against its `config_schema` (Pydantic) and reject mismatched field paths in `pathway_block_field_resolution`
- [ ] 1.10 Validate timing inputs against `pathway_timing_value` CHECK semantics at the app boundary; reject contradictory shapes + unsupported kinds (e.g. `runtime`) with a 422 citing the offending field
- [ ] 1.11 Materialize default `pathway_lane` rows on first block placement of a given kind; reject blocks with `lane_id = null`

### 1c. REST surface

- [ ] 1.12 Implement `GET /pathways` (list summaries: id, name, updated_at, block_count)
- [ ] 1.13 Implement `POST /pathways` (create empty)
- [ ] 1.14 Implement `GET /pathways/{id}` (full definition with all child entities embedded)
- [ ] 1.15 Implement `PUT /pathways/{id}` (wholesale replace; cascade-replace child rows)
- [ ] 1.16 Implement `DELETE /pathways/{id}` (cascade-delete child rows)
- [ ] 1.17 Implement `GET /pathway-blocks` returning the catalogue with `type`, `label`, `default_lane_kind_id`, `config_schema`
- [ ] 1.18 Implement `GET /pathway-phase-templates` returning the registry with `id`, `label`, `default_ord`
- [ ] 1.19 Wire router under central tag + prefix per `openapi-contract` requirements; declare stable `operation_id` + response models + error responses
- [ ] 1.20 Regenerate OpenAPI schema; verify no contract drift in CI

### 1d. Fixtures + tests

- [ ] 1.21 Seed one Rugrevalidatie-shaped pathway (phases via templates, lanes via defaults, fixed + enrollment timing values, one `luscii-clinical-path` block carrying a reference-only config) via migration or seed task
- [ ] 1.22 Pytest coverage: aggregate validation (unknown block type, unknown phase, unknown lane), timing CHECK enforcement (`fixed` + `enrollment` + rejection of `runtime`), branch/edge consistency (mismatched `source_branch_id`, branch on non-branching block per D19, duplicate edge rejection per D20), lane materialization, field-resolution path validation, `luscii-clinical-path` config validated as reference-only (no payload mirroring), soft-delete behavior, each REST endpoint
- [ ] 1.23 Update `apps/backend/AGENTS.md` with a `Pathway domain` section + MDR reminder (block-catalogue additions must clear `mdr-watchlist.md`)

### 1e. Phase 1 review gate

- [ ] 1.24 Run backend lint + tests; quote results
- [ ] 1.25 User review of Phase 1 output before starting Phase 2

## 2. Phase 2 — Orchestrator overview + create flow + sidebar

### 2a. API client + module scaffold

- [ ] 2.1 Regenerate orchestrator API client from updated OpenAPI; verify generated types include `Pathway`, `PathwaySummary`, `PathwayBlockType`, `PathwayPhaseTemplate`, `PathwayLaneKind`, `PathwayTimingValue`
- [ ] 2.2 Create `apps/orchestrator/src/modules/pathway/` with `pathwayKeys.list()` / `pathwayKeys.detail(id)` / `pathwayKeys.blocks()` / `pathwayKeys.phaseTemplates()` and hooks (`usePathwayList`, `usePathway`, `useCreatePathway`, `usePathwayBlocks`, `usePathwayPhaseTemplates`)
- [ ] 2.3 Add `nav.pathways` to nl/en i18n files

### 2b. Sidebar entry

- [ ] 2.4 Add `Pathways` entry to the sidebar nav with icon + ordering matching existing entries
- [ ] 2.5 Verify entry renders in expanded + collapsed sidebar states

### 2c. Overview page

- [ ] 2.6 Add `/pathways` route to orchestrator routing
- [ ] 2.7 Implement overview page rendering pathway summaries (name, last edited, block count) via `usePathwayList`
- [ ] 2.8 Implement empty state when list is empty
- [ ] 2.9 Wire row click → `/pathways/{id}`

### 2d. Create flow

- [ ] 2.10 Prototype create surface: full route `/pathways/new` vs modal-from-overview; pick one with the user; record decision in `design.md`
- [ ] 2.11 Implement chosen create surface with name input + submit
- [ ] 2.12 Wire `useCreatePathway` → `POST /pathways`; redirect to `/pathways/{id}` on success
- [ ] 2.13 Surface backend validation errors via the standard error-toast pipeline

### 2e. Builder stub route

- [ ] 2.14 Add `/pathways/{id}` route with a "builder coming in phase 3" placeholder showing pathway summary so the create flow has a real destination

### 2f. Phase 2 review gate

- [ ] 2.15 Vitest coverage for overview + create flow
- [ ] 2.16 Manual run against backend in browser: create → overview → row click → stub builder
- [ ] 2.17 Frontend lint + typecheck + tests; quote results
- [ ] 2.18 User review of Phase 2 output before starting Phase 3

## 3. Phase 3 — Orchestrator builder canvas

### 3a. Library audit + selection

- [ ] 3.1 Audit graph-canvas packages: React Flow / xyflow, Reaflow, drawflow (React 19 + Vite 8 compatibility, TS types, custom node rendering, controlled-state mode, license, maintenance signal)
- [ ] 3.2 Spike a throw-away render of the seeded Rugrevalidatie pathway with the top candidate
- [ ] 3.3 Commit choice in `design.md` Decisions section (D5)

### 3b. Canvas

- [ ] 3.4 Replace the Phase 2 stub builder route with the canvas
- [ ] 3.5 Render nodes from the pathway definition; render edges between nodes
- [ ] 3.6 Render an entry-point marker on the entry node
- [ ] 3.7 Implement controlled-state mode so the canvas state is the source of truth for the save action

### 3c. Block palette + insertion

- [ ] 3.8 Render block palette from `usePathwayBlocks` and phase picker from `usePathwayPhaseTemplates` (+ Custom phase entry)
- [ ] 3.9 Implement add-block-to-canvas interaction; auto-assign default lane based on `default_lane_kind_id`; mark pathway dirty on change
- [ ] 3.10 Implement delete-block + delete-edge with confirmation

### 3d. Per-block config editor

- [ ] 3.11 Implement a JSON-schema-driven form renderer for the side panel (pick an existing package, e.g. `@rjsf/core` — library audit first per repo convention)
- [ ] 3.12 Wire node selection → side panel shows the selected node's config form driven by its `config_schema`
- [ ] 3.13 Persist field edits into the canvas state; mark dirty on change

### 3e. Save action

- [ ] 3.14 Implement `Save` button + dirty indicator
- [ ] 3.15 Wire save → `PUT /pathways/{id}` with the full current definition
- [ ] 3.16 Clear dirty indicator on success; keep dirty + surface error toast on failure
- [ ] 3.17 Re-evaluate auto-save vs explicit save based on prototyping; capture decision in `design.md` (D8)

### 3f. Polish + tests

- [ ] 3.18 Vitest coverage: palette renders catalogue, add-block-marks-dirty, save round-trip
- [ ] 3.19 Playwright happy path: open builder → add block → configure → save → reload → state preserved
- [ ] 3.20 Update `apps/orchestrator/AGENTS.md` with a `Pathway builder` section (module layout, query-key namespace, canvas package choice)

### 3g. Phase 3 review gate

- [ ] 3.21 Frontend lint + typecheck + tests + e2e; quote results
- [ ] 3.22 Demo end-to-end flow against the seeded pathway; user review

## 4. Wrap-up

- [ ] 4.1 Update `openspec/backlog.md` `BL-036` entry to reference this change as promoted
- [ ] 4.2 Run `openspec validate pathway-builder-base` and quote result
- [ ] 4.3 Archive the change once shipped (`/opsx:archive`)
