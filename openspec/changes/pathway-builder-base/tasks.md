## 1. Phase 1 — Backend pathway domain

### 1a. Collab gate (before any code) — DONE

- [x] 1.1 Data-model collab session with the user; decisions D1, D9–D14 captured in `design.md`
- [x] 1.2 `design.md` amended with chosen shape (relational + one purposeful jsonb), Naming Conventions & Schema Exceptions, Resolved/Open Questions sections
- [x] 1.3 Block-config validation: both — Pydantic on save (backend) against catalogue's `config_schema`, rjsf on input (frontend Phase 3)

### 1b. Domain + persistence

- [x] 1.4 Create `apps/backend/.../pathway/` module (domain entities, repository, Pydantic schemas)
- [x] 1.5 Add DB migration for the 10 canonical tables (per `design.md` D15 / Naming Conventions & Schema Exceptions). Every per-pathway table inherits `TenantOwnedEntity` (id, tenant_id, audit FKs, timestamps, soft delete). `pathway_lane_kind` inherits plain `Entity`:
  - `pathway_lane_kind` (catalogue, seeded `patient`/`caregiver`/`system`/`external`)
  - `pathway_timing_value` (shared, `kind` ∈ (`fixed`, `enrollment`) — runtime kind parked in MVP delta; CHECK enforces column-set per kind)
  - `pathway` (aggregate root; no entry_block_id — enrollment picks the start)
  - `pathway_phase` (per-pathway, ordered, optional `template_id` soft pointer)
  - `pathway_lane` (per-pathway, FK to `pathway_lane_kind`, `is_default` flag, `(pathway_id, ord)` unique)
  - `pathway_block` (FK to phase + lane, `config jsonb` — Exception 1, optional `duration_value_id`, `x`/`y` int)
  - `pathway_block_branch` (decision-block branches, ordered; ownership validated app-side against catalogue's branching flag per D19)
  - `pathway_edge` (FKs source/target block, optional `source_branch_id`, optional `delay_value_id`; UNIQUE `(source_block_id, target_block_id, source_branch_id) NULLS NOT DISTINCT` per D20)
  - `pathway_time_marker` (presentation-only, FK to `pathway_timing_value`)
  - `pathway_block_deferred_field` (block_id + field_path; marks enrollment-deferred fields)
- [x] 1.6 Implement pathway aggregate; soft-delete via base `deleted_at`; cascade child rows on pathway delete via `pathway_id` FK ON DELETE CASCADE (tenant FK stays RESTRICT)
- [x] 1.7 Implement block-type registry as a server-side static map (`appointment`, `decision`, `milestone`, `timer`, `task`, `email`) with `default_lane_kind_code` + per-type JSON schema for config (PoC set; `luscii-clinical-path` removed during Phase 3 scoping, `task` + `email` added during Phase 3 prototype alignment)
- [x] 1.8 Implement phase-template registry as a server-side static map (Rugrevalidatie chapters: `pre-op`, `surgery`, `recovery`, `follow-up`) with `default_ord`
- [x] 1.9 Validate pathway blocks against the catalogue on save; reject unknown block types with 422; validate each block's `config` against its `config_schema` (Pydantic) and reject mismatched field paths in `pathway_block_deferred_field`
- [x] 1.10 Validate timing inputs against `pathway_timing_value` CHECK semantics at the app boundary; reject contradictory shapes + unsupported kinds (e.g. `runtime`) with a 422 citing the offending field
- [x] 1.11 Materialize default `pathway_lane` rows on first block placement of a given kind; reject blocks with `lane_id = null`

### 1c. REST surface

- [x] 1.12 Implement `GET /pathways` (list summaries: id, name, updated_at, block_count)
- [x] 1.13 Implement `POST /pathways` (create empty)
- [x] 1.14 Implement `GET /pathways/{id}` (full definition with all child entities embedded)
- [x] 1.15 Implement `PUT /pathways/{id}` (wholesale replace; cascade-replace child rows)
- [x] 1.16 Implement `DELETE /pathways/{id}` (cascade-delete child rows)
- [x] 1.17 Implement `GET /pathways/blocks` returning the catalogue with `type`, `label`, `default_lane_kind_code`, `config_schema`
- [x] 1.18 Implement `GET /pathways/phase-templates` returning the registry with `id`, `label`, `default_ord`
- [x] 1.19 Wire router under central tag + prefix per `openapi-contract` requirements; declare stable `operation_id` + response models + error responses
- [x] 1.20 Regenerate OpenAPI schema; verify no contract drift in CI

### 1d. Fixtures + tests

- [x] 1.21 Seed one Rugrevalidatie-shaped pathway (phases via templates, lanes via defaults, fixed + enrollment timing values) via migration or seed task
- [x] 1.22 Pytest coverage: aggregate validation (unknown block type, unknown phase, unknown lane), timing CHECK enforcement (`fixed` + `enrollment` + rejection of `runtime`), branch/edge consistency (mismatched `source_branch_id`, branch on non-branching block per D19, duplicate edge rejection per D20), lane materialization, field-resolution path validation, soft-delete behavior, each REST endpoint
- [x] 1.23 Update `apps/backend/AGENTS.md` with a `Pathway domain` section + MDR reminder (block-catalogue additions must clear `mdr-watchlist.md`)

### 1e. Phase 1 review gate

- [x] 1.24 Run backend lint + tests; quote results
- [x] 1.25 User review of Phase 1 output before starting Phase 2

## 2. Phase 2 — Orchestrator overview + create flow + sidebar

### 2a. API client + module scaffold

- [x] 2.1 Regenerate orchestrator API client from updated OpenAPI; verify generated types include `Pathway`, `PathwaySummary`, `PathwayBlockType`, `PathwayPhaseTemplate`, `PathwayLaneKind`, `PathwayTimingValue` (lane-kind type is server-internal, not on the OpenAPI surface)
- [x] 2.2 Create `apps/orchestrator/src/modules/pathway/` with `pathwayKeys.list()` / `pathwayKeys.detail(id)` / `pathwayKeys.blocks()` / `pathwayKeys.phaseTemplates()` and hooks (`usePathwayList`, `usePathway`, `useCreatePathway`, `usePathwayBlocks`, `usePathwayPhaseTemplates`)
- [x] 2.3 Add `nav.pathways` to nl i18n (en/fr locales not yet populated in repo)

### 2b. Sidebar entry

- [x] 2.4 Add `Pathways` entry to the sidebar nav with icon + ordering matching existing entries
- [x] 2.5 Verify entry renders in expanded + collapsed sidebar states

### 2c. Overview page

- [x] 2.6 Add `/pathways` route to orchestrator routing
- [x] 2.7 Implement overview page rendering pathway summaries (name, last edited, block count) via `usePathwayList`
- [x] 2.8 Implement empty state when list is empty
- [x] 2.9 Wire row click → `/pathways/{id}`

### 2d. Create flow

- [x] 2.10 Prototype create surface: full route `/pathways/new` vs modal-from-overview; pick one with the user; record decision in `design.md` (chose modal-from-overview; goals: name + clinical_goal + patient_goal)
- [x] 2.11 Implement chosen create surface with name input + submit (dialog: name + clinical_goal + patient_goal, all required, trimmed)
- [x] 2.12 Wire `useCreatePathway` → `POST /pathways`; redirect to `/pathways/{id}` on success
- [x] 2.13 Surface backend validation errors via the standard error-toast pipeline (inline alert in dialog; toast wiring deferred — no toast pipeline yet for mutations)

### 2e. Builder stub route

- [x] 2.14 Add `/pathways/{id}` route with a "builder coming in phase 3" placeholder showing pathway summary so the create flow has a real destination

### 2f. Phase 2 review gate

- [x] 2.15 Vitest coverage for overview + create flow (236/236 pass locally with temp rolldown binding; committed state hits pre-existing `@rolldown/binding-darwin-arm64` infra blocker per commit 4b02bd2 — flagged for user)
- [ ] 2.16 Manual run against backend in browser: create → overview → row click → stub builder
- [x] 2.17 Frontend lint + typecheck + tests; quote results (lint 0 errors / 19 pre-existing warnings; typecheck 0 errors; tests 236/236 — see 2.15 caveat)
- [ ] 2.18 User review of Phase 2 output before starting Phase 3

## 3. Phase 3 — Orchestrator builder canvas

### 3a. Library audit + selection

- [x] 3.1 Audit graph-canvas packages: React Flow / xyflow, Reaflow, drawflow (React 19 + Vite 8 compatibility, TS types, custom node rendering, controlled-state mode, license, maintenance signal)
- [ ] 3.2 Spike a throw-away render of the seeded Rugrevalidatie pathway with the top candidate
- [x] 3.3 Commit choice in `design.md` Decisions section (D5)

### 3b. Canvas

- [ ] 3.4 Replace the Phase 2 stub builder route with the canvas
- [ ] 3.5 Render nodes from the pathway definition; render edges between nodes
- [ ] 3.6 Render an entry-point marker on the entry node
- [ ] 3.7 Implement controlled-state mode so the canvas state is the source of truth for the save action

### 3c. Block palette + insertion

- [ ] 3.8 Render block palette from `usePathwayBlocks` and phase picker from `usePathwayPhaseTemplates` (+ Custom phase entry)
- [ ] 3.9 Implement add-block-to-canvas interaction; auto-assign default lane based on `default_lane_kind_code`; mark pathway dirty on change
- [ ] 3.10 Implement delete-block + delete-edge with confirmation

### 3d. Per-block config editor

- [ ] 3.11 Implement a JSON-schema-driven form renderer for the side panel (pick an existing package, e.g. `@rjsf/core` — library audit first per repo convention)
- [ ] 3.12 Wire node selection → side panel shows the selected node's config form driven by its `config_schema`
- [ ] 3.13 Persist field edits into the canvas state; mark dirty on change

### 3e. Save action

Aligned with D30 + D31 (concept = autosave 800ms; published = read-only via fork-on-edit). No `Save` button on concept. Top-right button is `Publish version` — wired in Phase 5 (5.10). Concept builder ships with autosave + save-state pill only.

- [ ] 3.14 Implement autosave hook (`useAutosavePathway`) debounced at 800ms after the last dirty-marking action; flushes on route leave + tab visibility-hidden; cancels pending flush on unmount
- [ ] 3.15 Wire autosave → `PUT /pathways/{id}` with the full current definition; reuse mutation infra; backend resolves to the current concept version per `history-spec.md` §6
- [ ] 3.16 Implement save-state pill (`pathway.status.{clean,dirty,saving,error}`) per `builder-ui-spec.md` §17; pill replaces explicit `Save` button in the topbar history-group cluster
- [ ] 3.17 (DONE) Re-evaluate auto-save vs explicit save based on prototyping; capture decision in `design.md` (D30 + D31: concept = autosave 800ms, published = manual save per §17)
- [ ] 3.17a Render `Publish version` button in the topbar right cluster as a disabled placeholder gated on Phase 5 wiring (i18n key `pathway.topbar.publish`, replaces the prior `pathway.topbar.save` key — drop `save` when no callers remain)
- [ ] 3.17b Block all mutating actions on read-only versions at the dispatch boundary so Phase 5's fork-on-edit intercept (5.11/5.12) has a single hook point — concept builder asserts `version.status === 'concept'` before applying any reducer mutation

### 3f. Polish + tests

- [ ] 3.18 Vitest coverage: palette renders catalogue, add-block-marks-dirty, autosave debounce + flush-on-leave round-trip, save-state pill transitions (clean→dirty→saving→clean / →error)
- [ ] 3.19 Playwright happy path: open builder → add block → configure → wait for autosave-idle → reload → state preserved
- [ ] 3.20 Update `apps/orchestrator/AGENTS.md` with a `Pathway builder` section (module layout, query-key namespace, canvas package choice)

### 3g. Phase 3 review gate

- [ ] 3.21 Frontend lint + typecheck + tests + e2e; quote results
- [ ] 3.22 Demo end-to-end flow against the seeded pathway; user review

## 4. Phase 4 — Version lifecycle (backend `pathway-version` capability)

Implements the `pathway-version` capability spec (`specs/pathway-version/spec.md`) and the supporting backend changes called out in `history-spec.md` §6 and `design.md` D36–D45. Land before Phase 5 frontend version surface so the orchestrator hook (`useResolvedVersion`) and ver-switch chip have endpoints to bind against.

### 4a. Schema migration

- [ ] 4.1 New Alembic migration `add_pathway_version_table.py` — create `pathway_version` (id, pathway_id FK CASCADE, version_no, status enum `concept|published|archived`, kind enum `initial|fork-from-publish|restore-from-version`, derived_from_version_id self-FK ON DELETE SET NULL, label 120, note text, published_at, published_by FK user, audit columns from `TenantOwnedEntity`)
- [ ] 4.2 Same migration — `UNIQUE (pathway_id, version_no)` and partial unique index `pathway_version (pathway_id) WHERE status = 'concept' AND deleted_at IS NULL`
- [ ] 4.3 Same migration — backfill: every existing `pathway` row gets one `pathway_version` row with `version_no=1`, `status='concept'`, `kind='initial'`, copied audit columns
- [ ] 4.4 Same migration — add `pathway_version_id` FK column to each structural child table (`pathway_phase`, `pathway_lane`, `pathway_block`, `pathway_edge`, `pathway_block_branch`, `pathway_time_marker`, `pathway_block_deferred_field`); backfill from existing `pathway_id` linkage; switch each table's per-pathway unique constraint to `(pathway_version_id, ord)` (or equivalent); drop the obsolete `pathway_id` FK column where redundant
- [ ] 4.5 Same migration — required indexes: `pathway_version (pathway_id, status, published_at DESC)`, `pathway_block (pathway_version_id)`, `pathway (tenant_id, deleted_at, updated_at DESC)`
- [ ] 4.6 `moon run backend:migrate` against the dev DB, verify backfill via psql (every pathway has exactly one concept; every child row references a version)

### 4b. Models + repositories + services

- [ ] 4.7 Add SQLAlchemy `PathwayVersion` model under `apps/backend/app/db/models/pathway/version.py` mirroring the migration columns
- [ ] 4.8 Update child models to point their `pathway_id` relationship at `pathway_version` via the new FK column; drop direct `pathway` relationships on structural children
- [ ] 4.9 `PathwayVersionRepository` — `latest_concept(pathway_id)`, `latest_published(pathway_id)`, `list_versions(pathway_id)`, `version(pathway_id, version_id)`, `create_initial(pathway)`, `create_concept_from(source_version, kind)`, `mark_published(version, label, note, user)`
- [ ] 4.10 `PathwayVersionService` — encapsulates concept-creation, restore, fork-from-publish, publish (validates the clinical-approval flag), and the immutability rule (raise `PathwayVersionImmutable` when callers try to mutate a published version's children)
- [ ] 4.11 Update `PathwayService` write paths so structural mutations resolve to the pathway's current concept version (`PUT /pathways/{id}` → concept resolution; 409 `no_concept_version` when none exists)
- [ ] 4.12 Update `PathwayService` read paths to embed the resolved version on `GET /pathways/{id}` per "Hybrid version resolution"; overview rollups computed via LATERAL joins per "Pathway-level rollups are derived"
- [ ] 4.13 New domain errors `ConceptAlreadyExists`, `NoConceptVersion`, `PathwayVersionImmutable` mapped to 409 + machine-readable error codes (mirror existing error envelope)

### 4c. REST surface

- [ ] 4.14 Update `PathwayRouter` — `GET /pathways/{id}` returns `{ pathway, version }`; remove old "definition embedded directly" shape
- [ ] 4.15 New `PathwayVersionRouter` mounted at `/pathways/{pathway_id}/versions`: `GET /` (list summaries reverse-chrono), `GET /{version_id}` (full snapshot)
- [ ] 4.16 `POST /pathways/{id}/publish` — request body `{ label?, note?, clinically_approved: true }`; 422 when `clinically_approved` missing/false
- [ ] 4.17 `POST /pathways/{id}/versions/{version_id}/restore` — 409 `concept_already_exists` when a concept already exists
- [ ] 4.18 `POST /pathways/{id}/versions/{version_id}/fork-from-publish` — 422 when source is not `published`, 409 when concept already exists
- [ ] 4.19 Wire all new routes under the central `pathway` tag with stable `operation_id`s and declared response models per `openapi-contract`
- [ ] 4.20 Regenerate openapi (`moon run backend:openapi`) and orchestrator types (`/openapi-sync`)

### 4d. Tests

- [ ] 4.21 Pytest — `test_pathway_version_service.py`: initial creation, restore copies children, fork-from-publish requires published source, publish flips status + sets `published_at`/`published_by`, publish without `clinically_approved` → 422, restore-while-concept-exists → 409 `concept_already_exists`, attempted mutation on published version → 409 `pathway_version_immutable`, partial unique index rejects double-concept under concurrency
- [ ] 4.22 Pytest — `test_pathway_version_router.py`: list ordering reverse-chrono, version detail tenant-scoped (404 on cross-tenant), hybrid resolution returns concept-if-exists else latest published, autosave PUT routes to current concept (409 when none), restore + fork-from-publish endpoints round-trip
- [ ] 4.23 Pytest — overview query: rollups (`latest_published_version_no`, `has_concept`, `block_count`, `last_edited_at`) correct after publish/restore/edit cycles; required indexes present after `alembic upgrade head`
- [ ] 4.24 Update seed (`seed_pathway.py`) so Rugrevalidatie ships with at least one published version + one concept to exercise the version surface in dev

### 4e. Phase 4 review gate

- [ ] 4.25 `moon run backend:lint backend:typecheck backend:test-host`; quote results
- [ ] 4.26 User review of Phase 4 output before starting Phase 5

## 5. Phase 5 — Orchestrator version surface

Implements `pathway-builder` requirements added in `specs/pathway-builder/spec.md` for hybrid version routes, topbar version-switch chip, read-only banner, crumb version marker, publish modal, restore-when-concept-exists handling, and the Geschiedenis drawer. Components per `builder-components.md` §19. Hooks against the Phase 4 endpoints — do NOT start until Phase 4 review gate passes.

### 5a. Routing + loader hook

- [ ] 5.1 Add `/pathways/$pathwayId/v/$versionId` route mounting the same shell as the bare `/pathways/$pathwayId` route (per `pathway-builder` capability "Hybrid version route resolution")
- [ ] 5.2 Implement `useResolvedVersion(pathwayId, versionId?)` returning `{ pathway, version, isReadOnly, readOnlyVariant }`; bare route resolves via `GET /pathways/{id}`, `/v/...` route resolves via `GET /pathways/{id}/versions/{versionId}`; `isReadOnly = url-has-/v/ OR version.status !== 'concept'`; `readOnlyVariant = 'historical' | 'published-fallback'`
- [ ] 5.3 Shell applies `.is-readonly` class to `<main>` when `isReadOnly`; dims palette dock, save button, undo/redo, status pill, presence stack per `builder-ui-spec.md` §28 + history-spec §5

### 5b. Version-switch chip + crumb marker

- [ ] 5.4 `<VersionSwitchChip>` (`modules/pathway/components/topbar/VersionSwitchChip.tsx`) — trigger `dot · v.{n} · chev`, popover menu grouped Werkversie/Gepubliceerd, footer link `Alle versies in geschiedenis` opens drawer
- [ ] 5.5 Navigation rule from chip: if target version = what bare URL would currently resolve to → navigate bare; else navigate `/v/{versionId}` (history-spec §5a)
- [ ] 5.6 `<CrumbVersionMarker>` (`modules/pathway/components/topbar/CrumbVersionMarker.tsx`) — passive `<span aria-hidden="true">` with dot + `v.{n}` + state word inline in crumbs
- [ ] 5.7 Remove the standalone `Geschiedenis` topbar button (replaced by chip + drawer-footer link)

### 5c. Read-only banner + drawer

- [ ] 5.8 `<ReadOnlyBanner>` (`modules/pathway/components/shell/ReadOnlyBanner.tsx`) — 36px strip between topbar and subbar; variant from `version.status` (`published-fallback` → success tint + `Maak nieuwe versie` CTA; `historical` → info tint + `Herstel als nieuw concept` + `Terug naar huidige` CTAs); `role="status"`
- [ ] 5.9 `<GeschiedenisDrawer>` (`modules/pathway/components/drawer/GeschiedenisDrawer.tsx`) — mutex with block-config drawer; renders version rows from `useVersionList(pathwayId)`; per-row `Bekijken` + `Herstellen`; restore confirmation swaps copy when concept already exists, offers `Open bestaande concept` escape (navigates bare URL, no restore call)

### 5d. Publish + fork-on-edit flows

- [ ] 5.10 `Publish version` button (`modules/pathway/components/topbar/PublishButton.tsx`) in the topbar right cluster, label `pathway.topbar.publish`, primary variant; disabled while autosave save-state ≠ `clean` or when `isReadOnly`; click opens the publish modal — optional `label` (max 120) + optional `note` (max 2000) + required `clinically_approved` checkbox; confirm disabled until checkbox ticked; on success toast `Versie v.{n} gepubliceerd`, optimistic concept-disappear so bare URL falls back to the new published
- [ ] 5.11 Fork-on-edit intercept — the dispatch-boundary guard added in 3.17b becomes the intercept hook: when a mutation is attempted against a read-only version (banner variant `published-fallback`), open the `Nieuwe versie nodig` modal; on confirm calls `POST /pathways/{id}/versions/{versionId}/fork-from-publish`, navigates to bare URL with router state `pendingMutation`, replays it as the first edit on the new concept; cancel discards the attempted mutation and keeps the read-only view
- [ ] 5.12 Surface 409 `pathway_version_immutable` from the autosave path identically to the click-intercept (same modal); autosave debounce flush is the race window — handler retries against the resolved new concept after fork-from-publish succeeds
- [ ] 5.13 Restore mutation hook `useRestoreVersion()` flushes in-memory undo stack on success; toast `pathway.history.restore.success`

### 5e. Tests + review

- [ ] 5.14 Vitest coverage — `useResolvedVersion` cases (concept exists, concept absent, `/v/...` route); chip navigation rule; banner variant selection; restore-when-concept-exists modal-copy swap
- [ ] 5.15 Playwright — happy path publish → automatic concept-disappears → bare URL falls back to published → ver-switch chip shows green dot; restore historical → new concept appears → undo stack empty
- [ ] 5.16 i18n keys added to `nl/pathway.json` (publish modal copy, banner copy, restore-when-concept-exists copy, ver-switch labels)
- [ ] 5.17 `moon run orchestrator:lint orchestrator:typecheck orchestrator:test`; quote results
- [ ] 5.18 User review of Phase 5 output

## 6. Wrap-up

- [ ] 6.1 Update `openspec/backlog.md` `BL-036` entry to reference this change as promoted
- [ ] 6.2 Run `openspec validate pathway-builder-base` and quote result
- [ ] 6.3 Archive the change once shipped (`/opsx:archive`)
