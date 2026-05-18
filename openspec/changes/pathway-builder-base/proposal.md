**Tier**: [poc]

**Feature**: `F3` Carepath builder (`openspec/scope.md`). Promotes backlog item `BL-036 — F3 pathway domain` (`openspec/backlog.md`) to an active change. Update `BL-036` note to "Promoted to `changes/pathway-builder-base/` on 2026-05-15".

## Why

The PoC needs `F3` end-to-end: a caregiver opens a builder, composes a care pathway from blocks (appointment, decision, milestone, Luscii clinical care path), saves it, and the saved pathway is enrollable. Today there is no pathway domain in the backend and no builder surface in the orchestrator.

We land the F3 foundation in one change, in three sequenced phases so the data model is settled before any UI work locks against it, and the UI ships in two passes (skeleton first, canvas second) so we can prototype the builder interactions without blocking the overview/create flow.

## What Changes

**Phase 1 — backend pathway domain (data model + API).**

- New backend module `pathway/` with the pathway-definition domain: aggregate (pathway), nodes (blocks), edges (connectors), entry point. Exact field shape **TBD via collab session** before implementation — proposal locks intent, not column names.
- Persistence: pathway definitions stored in the existing backend DB (Postgres/SQLite per `apps/backend` setup). Saved-in-builder = enrollable (no separate publish), matching `F3` PoC behaviour.
- REST surface under `/pathways`: `GET /pathways` (list), `POST /pathways` (create empty / from template), `GET /pathways/{id}` (full definition for the builder), `PUT /pathways/{id}` (replace definition), `DELETE /pathways/{id}`.
- Block catalogue endpoint `GET /pathways/blocks` returning the static block-type registry the builder renders (PoC set: `appointment`, `decision`, `milestone`, `timer`, `task`, `email`). Block schemas are server-owned so the frontend never hardcodes them. External-system blocks (e.g. a future Luscii care-path reference) are deferred.
- OpenAPI regenerated; orchestrator API client regenerated against the new surface.
- Fixtures: at least one seeded pathway (Rugrevalidatie-shaped) to drive prototyping.

**Phase 2 — orchestrator: overview page + create flow + sidebar entry.**

- Sidebar nav: add `Pathways` entry (i18n key `nav.pathways`). Placement and icon follow existing `app-shell` conventions.
- Route `/pathways` (overview): table of pathway definitions, columns TBD with phase-2 prototyping but minimally `name`, `last edited`, `# of blocks`. Empty state when none exist.
- Route `/pathways/new` (or modal — TBD in prototyping): create flow that takes a name, hits `POST /pathways`, redirects to the builder route (stub page in phase 2, real canvas in phase 3).
- Module + query-key naming follow orchestrator conventions (`modules/pathway/`, `pathwayKeys.*`).
- No canvas yet — builder route renders a placeholder "builder coming in phase 3" surface so the create flow has a destination.

**Phase 3 — orchestrator: builder canvas.**

- Route `/pathways/{id}` renders the full builder canvas: block palette, node graph, connectors, entry-point marker, save action wired to `PUT /pathways/{id}`.
- Block-instance editor (side panel) renders the block's config form, driven by the per-block schema from `GET /pathways/blocks`.
- **Library audit first** per repo convention — pick an existing graph-canvas package (e.g. React Flow / xyflow) rather than rolling our own. Wrap, don't rebuild.
- Frontend prototyping happens against the seeded Phase-1 pathway. Interaction details (auto-save vs save button, validation surfacing, undo) are decided in prototyping and captured in `design.md` deltas before implementation.

**Explicitly out of scope (deferred):**

- Runtime execution / enrollment of patients into a pathway (`F4`/`F5` — separate changes). Versions are designed to be enrollment-pinnable (`pathway_version_id` as FK target), but the enrollment surface itself lands later.
- Luscii Builder API integration. Any external-system block (Luscii care-path reference, FHIR pulls, HiX tasks) is out of PoC scope; if/when re-introduced it stays reference-only per `openspec/scope.md` mocks row.
- Real-time multi-user editing, comments, branching/diffing of pathway definitions.
- MDR-territory blocks (clinical decision logic that interprets measurements). See `openspec/mdr-watchlist.md`.

## Capabilities

### New Capabilities

- `pathway-domain`: Backend pathway-definition domain — aggregate, nodes, edges, block-type catalogue, REST surface under `/pathways` (catalogue endpoints nested as `/pathways/blocks` + `/pathways/phase-templates`), persistence in our own DB. No runtime/enrollment behaviour. Structural children FK to `pathway_version_id`; lifecycle of versions lives in `pathway-version`.
- `pathway-version`: Backend pathway-version lifecycle — `pathway_version` table, concept/published states, one-concept-max invariant, publish operation (label + note + clinical-approval acknowledgement), restore + fork-from-publish endpoints, hybrid resolution on `GET /pathways/{id}`, version listing/detail endpoints, derived pathway-level rollups. See `history-spec.md` for full backend implications and `design.md` D36–D45 for the decisions behind the shape.
- `pathway-builder`: Orchestrator surface for managing pathway definitions — sidebar entry, overview page, create flow, builder canvas, block palette + node graph + connectors + per-block config editor. Wraps an existing graph-canvas package.

### Modified Capabilities

None — `app-shell`, `api-client`, and `openapi-contract` are exercised by this change (new sidebar entry, regenerated client, new routes) but no requirement in those specs changes. Compliant additive use only.

## Impact

- **Backend code**: new `apps/backend/.../pathway/` module (domain + repository + router + schemas + tests). DB migration adds pathway tables. OpenAPI regenerated.
- **Frontend code**: new `apps/orchestrator/src/modules/pathway/` (overview page, create flow, builder canvas, block palette, per-block editors). New route entries in `app-shell` routing. Sidebar nav entry. New i18n keys under `nav.pathways` + `pathway.*`.
- **Dependencies added**:
  - Backend: none expected beyond existing stack — TBD when data model finalised.
  - Frontend: one graph-canvas package (React Flow / xyflow or equivalent) selected after library audit. Documented in `design.md`.
- **Fixtures / demo**: one Rugrevalidatie-shaped seeded pathway lands with phase 1 so phase 3 prototyping has real content to render.
- **Docs**: `apps/backend/AGENTS.md` gains a Pathway-domain section; `apps/orchestrator/AGENTS.md` gains a Pathway-builder section. `openspec/scope.md` `F3` row stays — this change implements it, doesn't redefine it.
- **Cross-stack collab gate**: Phase 1 data model is co-designed with the user before implementation starts; phases 2–3 ship with frontend prototyping passes against the seeded fixture. Phase boundaries are review gates, not separate change proposals.
- **MDR check**: No clinical decision logic, no measurement interpretation, no diagnostic output. PoC block set is workflow-only (`appointment`/`decision`/`milestone`/`timer`/`task`/`email`). Clear of `openspec/mdr-watchlist.md` triggers.
