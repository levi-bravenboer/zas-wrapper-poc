**Tier**: [poc]

## Why

The current pathway block catalogue (`appointment`, `decision`, `milestone`, `timer`, `task`, `email`) was sized to prove drag/drop, not to model real clinical workflows. Mapping the bladder-cancer pathway exposed gaps:

- **`timer` is redundant** — edges already carry `delay_value_id`. A timer block is a placeholder node for something the edge can already express.
- **`email` is too narrow** — onboarding invites, Luscii invites, prep reminders, and post-op messages all need a channel selector (email / SMS / push / in-app). Naming the block after one channel forces TS/backend churn whenever a new channel appears.
- **No `form` block** — PROMs, PREMs, consent, anaesthesia questionnaire all need structured patient input with validation. `task` is "did it" boolean; doesn't carry response data.
- **No `wait-for-result` block** — pathology returns in 5–10 days, scans return when radiology uploads. The pathway must idle on an event, not a timer. Today there is no node that models "pause until external data lands".
- **No `pathway-link` block** — bladder pathway hands off to an oncology pathway. Without a link node, designers must inline an entire downstream pathway in one graph.
- **Per-block config is hardcoded UI** — every new block type implies new inspector code. We want schema-driven settings so backend catalogue is the single source of truth and the frontend renders from JSON Schema.
- **Edge timing only supports completion-anchored delays** — "3 days before surgery" is a normal request and cannot be modelled. We need a marker-anchored timing kind alongside the existing completion delay.

## What Changes

- **BREAKING (catalogue shape)**:
  - `PathwayBlockType` gains `semantics: BlockSemantics`, `icon: str`, `ui_schema: dict`.
  - `BlockSemantics` is a fixed enum (`appointment`, `task`, `message`, `form`, `decision`, `milestone`, `wait`, `pathway_link`).
- **BREAKING (block roster)**:
  - **Remove** `timer`.
  - **Rename** `email` → `message`; broaden config (`channel`, `subject`, `body`, optional `cta_label`, `cta_target`).
  - **Add** `form` — structured patient input (`questions[]` schema inline).
  - **Add** `wait` — pause until a catalogued external event lands (`event_type`, optional `timeout_days`, `on_timeout`).
  - **Add** `pathway_link` — handoff to another pathway (`target_pathway_id`, `mode`: `blocking` / `fire_and_forget`).
- **Edge timing** — `pathway_edge` gains marker-anchored timing:
  - New nullable cols: `time_marker_id` (FK `pathway_time_marker`), `offset_value_id` (FK `pathway_timing_value`), `offset_direction_code` (FK to new `pathway_edge_offset_direction`).
  - New lookup table `pathway_edge_offset_direction` (`before` / `after`) — mirrors `pathway_lane_kind` convention.
  - DB-level CHECK constraints enforce "exactly one timing kind" and "marker + offset + direction set together".
- **Lane mapping** (extends `block-lane-snap`):
  | block | allowed lanes |
  |---|---|
  | appointment | caregiver |
  | task | patient, caregiver |
  | message | patient |
  | form | patient |
  | decision | system |
  | milestone | system |
  | wait | system |
  | pathway_link | system |
- **Event-type catalogue** — new code-owned tuple in `app/services/pathway/catalogue.py` enumerating `pathology_report`, `scan_report`, `lab_result`, `external_data`. `wait.event_type` validated via JSON Schema `enum`. No DB table.
- **API surface**:
  - `/pathway-block-types` response shape extends with new fields.
  - New `/pathway-edge-timing-kinds` lists the four timing variants + their JSON Schemas (completion / marker / immediate / branch).
  - New `/pathway-edge-offset-directions` lists rows from the lookup table.
- **Data migration** — single Alembic revision: rename `email` → `message`, delete `timer` blocks (edges cascade), add edge timing cols + lookup table + CHECK constraints.
- **Out of scope for this change**: rendering schema-driven forms in the inspector. That ships in follow-up change `pathway-config-forms`. Until that lands, existing hardcoded inspector forms continue to work for the renamed/new blocks via temporary type checks (documented in tasks).

## Capabilities

### New Capabilities

- `pathway-block-redesign`: Block catalogue model carrying semantics, icon, JSON Schema config, and ui_schema, plus the extended block roster and edge timing union.

### Modified Capabilities

<!--
`block-lane-snap` adds entries for the new block types (form / wait / pathway_link) and renames the email → message entry. Spec delta lives below in tasks; capability spec itself is light-touch.
-->

- `block-lane-snap`: Allowed-lane table extended for new blocks; rename of `email` propagates.

## Impact

- **Backend**
  - `app/services/pathway/catalogue.py` — extend `BlockTypeEntry` dataclass, add `BlockSemantics` enum, replace block roster, add `EVENT_TYPES` tuple, add edge timing catalogue helpers.
  - `app/schemas/pathway/catalogue.py` — extend `PathwayBlockTypeOut`; add `PathwayEdgeTimingKindOut`, `PathwayEdgeOffsetDirectionOut`.
  - `app/schemas/pathway/pathway.py` — `PathwayEdgeIn` / `PathwayEdgeOut` gain `time_marker_id`, `offset_value_id`, `offset_direction_code`.
  - `app/services/pathway/pathway_service.py` — `_ResolvedDefinition.from_payload` validates the edge timing union (exactly-one rule mirrors DB CHECK).
  - `app/services/pathway/errors.py` — new `EdgeTimingValidationError` (422).
  - `app/db/models/pathway/edge.py` — three new cols, FK + index declarations.
  - `app/db/models/pathway/edge_offset_direction.py` — new lookup model (mirrors `lane_kind.py`).
  - `app/api/routers/pathway/` — two new GET routers: `/pathway-edge-timing-kinds`, `/pathway-edge-offset-directions`. Extend the block-type router response.
  - `app/services/pathway/seed.py` (or equivalent) — seed `pathway_edge_offset_direction` rows.
  - `scripts/seed_pathway.py` — replace `timer` / `email` references; demo pathway includes a `form` and a `wait` block; one edge uses marker-anchored timing.
  - Alembic revision `pathway_block_redesign_and_edge_timing` — DDL + data migration as documented in `design.md`.
- **Frontend**
  - `apps/orchestrator/src/lib/api/schema.d.ts` — regenerated via `moon run orchestrator:typegen`.
  - `apps/orchestrator/src/modules/pathway/types.ts` — new `BlockSemantics` literal union, edge timing union types.
  - `apps/orchestrator/src/modules/pathway/blockCatalogue.tsx` — icon lookup switches to catalogue's `icon` string (lucide name resolved at runtime).
  - `apps/orchestrator/src/modules/pathway/components/PathwayBuilderShell.tsx` — `onAddBlock` reads `allowed_lane_kind_codes[0]` for new types; existing logic untouched.
  - `apps/orchestrator/src/modules/pathway/components/canvas/nodes/BlockNode.tsx` — render switches on `semantics` (single switch, no per-type files).
  - `apps/orchestrator/src/modules/pathway/components/drawer/BuilderDrawer.tsx` — temporary `switch (block.type)` guard for inspector forms until `pathway-config-forms` lands.
  - i18n: rename `pathway.blockType.email.*` → `pathway.blockType.message.*`; new keys for `form`, `wait`, `pathwayLink`, edge timing kinds, offset directions.
- **Tests**
  - Backend: catalogue test asserts new fields + every type's `semantics` resolves to enum; service test rejects edge with two timing kinds set; service test rejects `wait` with unknown `event_type`; Alembic migration test (round-trip on a seeded snapshot).
  - Orchestrator: vitest for new types' lane defaults; vitest for edge timing serialization round-trip; Playwright happy-path covers dropping a `form` and a `wait` block.
- **Data migration**
  - `email` blocks → `message` (config keys `subject` / `body` retained; `channel` defaults to `email` for backfilled rows).
  - `timer` blocks deleted (orphan edges cascade).
  - New edge timing cols default to NULL; existing edges keep using `delay_value_id`. No row rewrites.
