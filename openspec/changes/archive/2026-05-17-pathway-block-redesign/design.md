## Context

The pathway-builder-base catalogue was sized to demo drag/drop. Mapping the bladder-cancer pathway (see `docs/superpowers/notes/bladder-cancer-care-pathway.md` once written; reference uploaded by user on 2026-05-17) exposed structural gaps: timing blocks duplicate edge semantics, `email` is too narrow, structured patient input has no home, asynchronous external data has no node, and sub-pathway handoff cannot be modelled.

Current state per file:
- `apps/backend/app/services/pathway/catalogue.py` — `BLOCK_TYPES` tuple with six entries; `BlockTypeEntry` carries `type`, `label`, `allowed_lane_kind_codes`, `supports_branches`, `config_schema`.
- `apps/backend/app/schemas/pathway/catalogue.py` — `PathwayBlockTypeOut` mirrors the dataclass shape; serves `/pathway-block-types`.
- `apps/backend/app/db/models/pathway/block.py` — `config` is a generic JSONB column (the one purposeful jsonb in the pathway domain). `type` is `VARCHAR(63)` validated app-side. No DB-level enum.
- `apps/backend/app/db/models/pathway/edge.py` — single nullable `delay_value_id` plus optional `source_branch_id`. UNIQUE `(source, target, source_branch_id)` with `NULLS NOT DISTINCT`.
- `apps/backend/app/services/pathway/pathway_service.py:689` — `_validate_block_config` runs `jsonschema.iter_errors`; rejects 422 with structured field path. All future block validation rides on this.
- `apps/orchestrator/src/modules/pathway/blockCatalogue.tsx` — currently only a static icon map. No config-form rendering exists; per-type inspector forms live in `BuilderDrawer.tsx`.

Stakeholders: pathway designers (need richer node vocabulary), backend (single validation point), runtime engine (needs `semantics` to dispatch behaviour), future maintainers (adding a block must touch ≤ 2 files).

## Goals / Non-Goals

**Goals:**
- Block roster matches the bladder-cancer pathway primitives (appointment, task, message, form, decision, milestone, wait, pathway_link).
- A single backend catalogue entry fully specifies a block: JSON Schema for config, ui_schema for widget hints, semantics for runtime dispatch, icon for canvas chrome, allowed lanes.
- Edge timing supports marker-anchored offsets ("3d before surgery") on top of the existing completion delay.
- DB enforces the timing-union invariant via CHECK constraints (no two timing kinds set; offset triple is all-or-none).
- `offset_direction` is a lookup table mirroring `pathway_lane_kind` — no `String + CHECK` constants in app code.
- Migration is reversible (with documented loss of timer rows) and runs in a single Alembic revision.

**Non-Goals:**
- Rendering schema-driven inspector forms. That's `pathway-config-forms`.
- Tenant-extensible event types or block types. PoC catalogues stay code-owned.
- Persisting the block catalogue in the database (it stays a Python dataclass tuple).
- `condition_expression` on edges. Decision blocks cover conditional flow; expression-gated edges are out of scope.
- Backfilling new `channel` config on existing `message` rows beyond `email` default — PoC data is re-seeded.

## Decisions

### D1 — Block catalogue carries `semantics`, `icon`, `ui_schema`

`BlockTypeEntry` (Python dataclass) gains:

```python
class BlockSemantics(str, enum.Enum):
    APPOINTMENT = "appointment"
    TASK = "task"
    MESSAGE = "message"
    FORM = "form"
    DECISION = "decision"
    MILESTONE = "milestone"
    WAIT = "wait"
    PATHWAY_LINK = "pathway_link"

@dataclass(frozen=True)
class BlockTypeEntry:
    type: str
    label: str
    semantics: BlockSemantics
    icon: str                              # lucide-react name as string
    allowed_lane_kind_codes: tuple[str, ...]
    supports_branches: bool
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any]
```

`semantics` is the runtime dispatch key. Multiple block types may share semantics in the future (e.g. two appointment subtypes) without forcing per-`type` branching.

`icon` is a lucide name string (`"clipboard-list"`), not an imported component. Frontend resolves via a small map (one place) so adding a block requires no TS edits.

`ui_schema` is an arbitrary JSON dict consumed by `pathway-config-forms`. For this change it's defined but unused at render time. Shape (validated by JSON Schema in the proposal spec):

```python
ui_schema = {
    "order": ["channel", "subject", "body"],
    "widgets": {"channel": "channel-picker"},
    "labels": {"cta_target": "Doel-URL"},
}
```

**Why dataclass and not DB table**: Catalogue is a release artefact, not user data. Code-owned avoids migrations on every catalogue tweak and keeps validation tightly coupled to the deployed app version.

### D2 — Block roster change

| type | semantics | allowed lanes | branches | notes |
|---|---|---|---|---|
| `appointment` | APPOINTMENT | caregiver | no | `title`, `attendees_patient: bool`, `mode: in_person/video/phone`, `location`, `duration_minutes`, `notes` |
| `task` | TASK | patient, caregiver | no | `title`, `assignee: patient/caregiver`, `due_offset_days`, `requires_completion: bool`, `notes` |
| `message` | MESSAGE | patient | no | `channel: email/sms/push/in_app`, `subject`, `body`, `cta_label?`, `cta_target?` |
| `form` | FORM | patient | no | `title`, `intro?`, `questions[]` (`{id, type, label, required, options?, validation?}`), `submit_label?`, `confirmation_message?` |
| `decision` | DECISION | system | yes | `question`, optional `auto_resolve: {source_block_id, field_path}` |
| `milestone` | MILESTONE | system | no | `label`, `description?`, `icon?` |
| `wait` | WAIT | system | no | `event_type` (enum from `EVENT_TYPES`), optional anchor `source_block_id`, `timeout_days?`, `on_timeout?: continue/escalate` |
| `pathway_link` | PATHWAY_LINK | system | no | `target_pathway_id: UUID`, `mode: blocking/fire_and_forget`, optional `context_mapping: {parent_path: child_path}` |

**Why drop `timer`**: `pathway_edge.delay_value_id` already expresses "wait N days". A timer block is a no-op placeholder duplicating that.

**Why rename `email` → `message`**: Onboarding/Luscii/SMS/push all share the same shape — title, body, optional CTA. Channel is config, not type.

**Why `wait` is system-lane**: It represents pathway internal state ("idle awaiting data"), not work for patient or caregiver. The event itself comes from an external system.

**Why `pathway_link.mode`**: Some sub-pathways (oncology) must complete before parent continues; others (GP-notification flow) fire-and-forget. Modelling as config keeps one block type.

### D3 — Event-type catalogue (for `wait`)

```python
EVENT_TYPES: tuple[EventTypeEntry, ...] = (
    EventTypeEntry(code="pathology_report", label="Pathologie verslag"),
    EventTypeEntry(code="scan_report",      label="Radiologie verslag"),
    EventTypeEntry(code="lab_result",       label="Lab uitslag"),
    EventTypeEntry(code="external_data",    label="Externe data"),
)
```

Code-owned tuple. `wait.config_schema` uses `enum: [code for code in EVENT_TYPES]` to constrain values. **No DB table** — event types are runtime-engine concerns and the engine ships in the same release as the catalogue.

If event types ever need to be tenant-extensible (post-PoC), we'd promote this to a lookup table the same way `pathway_lane_kind` is. Today's choice keeps the surface minimal.

### D4 — Edge timing union via flat nullable columns + CHECK

Edge timing has four kinds:

| Kind | Cols set | Meaning |
|---|---|---|
| `completion` | `delay_value_id` only | "wait N days after source completes" |
| `marker` | `time_marker_id` + `offset_value_id` + `offset_direction_code` | "N days before/after the named marker" |
| `branch` | `source_branch_id` only (existing) | edge leaves a specific decision branch, no delay |
| `immediate` | none of the above set | source completion fires target instantly |

Stored as **flat nullable columns** on `pathway_edge`:

- `time_marker_id` — FK `pathway_time_marker.id`, ondelete CASCADE (mirrors `delay_value_id`).
- `offset_value_id` — FK `pathway_timing_value.id`, ondelete CASCADE.
- `offset_direction_code` — FK `pathway_edge_offset_direction.code`, ondelete RESTRICT.

CHECK constraints:

```sql
-- exactly one timing kind: combinations of (delay, marker, branch) at most one
CHECK (num_nonnulls(delay_value_id, time_marker_id, source_branch_id) <= 1)

-- marker-anchored: all three set together or none
CHECK (
  ((time_marker_id IS NULL)
     = (offset_value_id IS NULL))
  AND
  ((time_marker_id IS NULL)
     = (offset_direction_code IS NULL))
)
```

Note: `<= 1` (not `= 1`) because `immediate` has all of `delay`, `marker`, `branch` null.

**Why flat cols, not jsonb**: Edge timing is bounded and frequently queried (engine schedules from it). FK integrity to `pathway_time_marker` / `pathway_timing_value` requires real columns; jsonb breaks referential integrity.

**Why not separate timing tables (one per kind)**: Three FK joins beat a `LEFT JOIN x 3 → choose one`. The shape is already exception-handled in service code; pushing it to the DB adds joins without isolating much.

**Why `num_nonnulls` and not the `CASE WHEN … END` sum**: Builtin since PG 9.5, simpler intent, no schema noise.

### D5 — `pathway_edge_offset_direction` lookup table

Mirrors `pathway_lane_kind`:

```python
class PathwayEdgeOffsetDirection(LookupEntity):  # whatever the lane_kind base is
    __tablename__ = "pathway_edge_offset_direction"
    code: Mapped[str]  = mapped_column(sa.String(16), primary_key=True)
    label: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    ord: Mapped[int]   = mapped_column(sa.SmallInteger, nullable=False)
```

Seed rows:

| code | label | ord |
|---|---|---|
| `before` | Voor | 10 |
| `after`  | Na   | 20 |

**Why lookup table over CHECK constraint**: Consistency with `pathway_lane_kind`. The convention already says: enumerable values with display labels live in a table. `offset_direction` matches that shape — even though it only has two rows today. A CHECK constraint would hide the (Dutch) labels and force frontend to hardcode them.

**Why `ord`**: Stable ordering in dropdowns without alphabetic flips between locales.

### D6 — API surface

Three endpoints (existing + new):

- `GET /pathway-block-types` — extends `PathwayBlockTypeOut`:
  ```json
  {
    "type": "form",
    "label": "Formulier",
    "semantics": "form",
    "icon": "clipboard-list",
    "allowed_lane_kind_codes": ["patient"],
    "supports_branches": false,
    "config_schema": { ... JSON Schema ... },
    "ui_schema": { "order": [...], "widgets": {...} }
  }
  ```
- `GET /pathway-edge-timing-kinds` — new:
  ```json
  [
    {"kind": "completion", "label": "Na voltooiing", "config_schema": {...}, "ui_schema": {...}},
    {"kind": "marker",     "label": "Rond marker",   "config_schema": {...}, "ui_schema": {...}},
    {"kind": "immediate",  "label": "Direct",        "config_schema": {...}, "ui_schema": {...}},
    {"kind": "branch",     "label": "Vanaf tak",     "config_schema": {...}, "ui_schema": {...}}
  ]
  ```
  The four entries' `config_schema` reference the same edge columns but with different required-field profiles. Frontend `SchemaForm` renders one form per kind.
- `GET /pathway-edge-offset-directions` — new:
  ```json
  [{"code":"before","label":"Voor","ord":10},{"code":"after","label":"Na","ord":20}]
  ```

All three feed `openapi-typescript` → `schema.d.ts` → typed frontend consumption.

### D7 — Validation chain

Service layer keeps the existing fence:

1. Pydantic validates wire-level shape.
2. `_ResolvedDefinition.from_payload` resolves block / edge references.
3. **Per block**: `_validate_block_config(entry.config_schema, block.config)` — existing.
4. **Per block (block-lane-snap)**: lane is in `entry.allowed_lane_kind_codes`.
5. **Per edge (NEW)**: validate timing union: at most one of `(delay_value_id, time_marker_id, source_branch_id)` is set; marker triple is all-or-none. Mirrors DB CHECK so violations surface as 422 (not 500-with-IntegrityError).
6. **Per edge (NEW)**: if `time_marker_id` is set, marker must belong to the same `pathway_version`. (Cross-version refs are already rejected for other FKs.)

New error: `EdgeTimingValidationError(edge_id, reason)` → 422 envelope.

### D8 — Migration: single Alembic revision

`pathway_block_redesign_and_edge_timing` revision:

```python
def upgrade():
    # 1. New lookup table + seed
    op.create_table('pathway_edge_offset_direction',
        sa.Column('code', sa.String(16), primary_key=True),
        sa.Column('label', sa.String(64), nullable=False),
        sa.Column('ord', sa.SmallInteger, nullable=False),
    )
    op.bulk_insert(
        sa.table('pathway_edge_offset_direction',
            sa.column('code'), sa.column('label'), sa.column('ord')),
        [{'code':'before','label':'Voor','ord':10},
         {'code':'after', 'label':'Na',  'ord':20}],
    )

    # 2. Edge timing cols
    op.add_column('pathway_edge', sa.Column('time_marker_id', PG_UUID(as_uuid=True),
                  sa.ForeignKey('pathway_time_marker.id', ondelete='CASCADE'), nullable=True))
    op.add_column('pathway_edge', sa.Column('offset_value_id', PG_UUID(as_uuid=True),
                  sa.ForeignKey('pathway_timing_value.id', ondelete='CASCADE'), nullable=True))
    op.add_column('pathway_edge', sa.Column('offset_direction_code', sa.String(16),
                  sa.ForeignKey('pathway_edge_offset_direction.code', ondelete='RESTRICT'),
                  nullable=True))

    # 3. Indexes on new FK cols
    op.create_index('ix_pathway_edge_time_marker_id',        'pathway_edge', ['time_marker_id'])
    op.create_index('ix_pathway_edge_offset_value_id',       'pathway_edge', ['offset_value_id'])
    op.create_index('ix_pathway_edge_offset_direction_code', 'pathway_edge', ['offset_direction_code'])

    # 4. CHECK constraints
    op.create_check_constraint('ck_pathway_edge_one_timing', 'pathway_edge',
        'num_nonnulls(delay_value_id, time_marker_id, source_branch_id) <= 1')
    op.create_check_constraint('ck_pathway_edge_offset_pair', 'pathway_edge',
        '((time_marker_id IS NULL) = (offset_value_id IS NULL)) '
        'AND ((time_marker_id IS NULL) = (offset_direction_code IS NULL))')

    # 5. Data migration
    op.execute("UPDATE pathway_block SET type='message' WHERE type='email'")
    op.execute("DELETE FROM pathway_block WHERE type='timer'")
    # edges from deleted timer blocks cascade via existing ondelete=CASCADE
```

```python
def downgrade():
    # Reverse data: message → email (subject/body shape unchanged); timer rows cannot be restored
    op.execute("UPDATE pathway_block SET type='email' WHERE type='message'")
    op.drop_constraint('ck_pathway_edge_offset_pair', 'pathway_edge', type_='check')
    op.drop_constraint('ck_pathway_edge_one_timing', 'pathway_edge', type_='check')
    op.drop_index('ix_pathway_edge_offset_direction_code', 'pathway_edge')
    op.drop_index('ix_pathway_edge_offset_value_id', 'pathway_edge')
    op.drop_index('ix_pathway_edge_time_marker_id', 'pathway_edge')
    op.drop_column('pathway_edge', 'offset_direction_code')
    op.drop_column('pathway_edge', 'offset_value_id')
    op.drop_column('pathway_edge', 'time_marker_id')
    op.drop_table('pathway_edge_offset_direction')
```

**PoC scale**: data migration runs in the same transaction as DDL. For prod-scale we would `ADD CONSTRAINT … NOT VALID` then `VALIDATE CONSTRAINT` separately to avoid long locks; not needed today.

**Autogen caveats**: `make-migration` will autogenerate the columns + indexes + lookup table. The two CHECK constraints and the data migration `op.execute(...)` calls must be added by hand. `/new-migration` flags suspicious autogen output and we treat anything missing as a manual addition.

**Realtime**: `pathway_block` has `__realtime_resource__ = None`; DELETE/UPDATE does not emit publication events. No subscriber churn.

### D9 — Frontend impact (minimal in this change)

- `BlockTypeIcon` resolves a lucide component from the catalogue's `icon` string instead of a hardcoded map. Tiny lookup `LUCIDE_BY_NAME` colocated with the component. Adding a block adds zero TS.
- `BlockNode` switches its preview body on `semantics`, not `type`. Eight cases. Each case is a one-line summary (e.g. `MESSAGE → block.config.subject ?? '—'`). Adding a block type with an existing semantics requires zero TS.
- `BuilderDrawer` keeps its existing per-`type` inspector switch; new types fall through to a temporary "no inspector yet" placeholder until `pathway-config-forms` ships. Documented in `tasks.md` so reviewers know it's intentional debt.
- `useCanvasHandlers` reads `allowed_lane_kind_codes[0]` (already block-lane-snap shape). No new logic.

**Why minimal**: This change owns the data model and API surface. The schema-driven form renderer is a separate ship (see `pathway-config-forms`) to keep blast radius small.

## Risks / Trade-offs

- **`condition_expression` on edges is excluded** → designers cannot express "skip if patient already submitted form X" without a decision block. **Mitigation**: decisions cover conditional flow; revisit only if real workflows show repeated decision-block-for-skip patterns.
- **`pathway_link` enables cycles** → a parent pathway could link to a child that links back. **Mitigation**: leave runtime detection to the engine; backend stores the FK, doesn't graph-validate. Document as "won't be exercised in PoC".
- **`wait.event_type` is a closed enum** → adding `genetic_panel_result` later means a backend release. **Mitigation**: acceptable for PoC; promote to lookup table when first tenant needs custom events.
- **CHECK constraint behavior on payload validation** → if app-side validation misses a case, the DB rejects with `IntegrityError`. **Mitigation**: app-side `EdgeTimingValidationError` mirrors the DB CHECK; service tests assert parity by attempting both legal and illegal combinations.
- **Reversal loses `timer` data** → `downgrade()` cannot resurrect deleted timer blocks. **Mitigation**: PoC has no production data; loss is acceptable. Documented in `downgrade()` comment.
- **Edge timing UI breaks existing builds** → frontend doesn't yet know how to render marker timing in the drawer. **Mitigation**: schema regen exposes the fields as optional; existing drawer code reads `delay_value_id` and is unaffected. Marker-aware UI is `pathway-config-forms`.
- **`ui_schema` lands without a renderer** → catalogue serves a structure no client uses yet. **Mitigation**: explicit; documented in proposal. Lets `pathway-config-forms` ship without touching the catalogue again.
- **Migration in single tx** → if production scales beyond PoC, the CHECK validation pass locks the table briefly. **Mitigation**: document the `NOT VALID` upgrade path in this design (D8).

## Migration Plan

1. Land catalogue dataclass change + new block entries + `EVENT_TYPES`. Backend unit tests pass.
2. Add Alembic revision (DDL + lookup seed + data migration). Run `moon run :reset && moon run backend:migrate && moon run backend:seed` in CI.
3. Regenerate OpenAPI: `moon run backend:openapi`. Regenerate TS: `moon run orchestrator:typegen`.
4. Add the two new GET routers and extend the block-type response shape. Backend integration tests for both endpoints.
5. Frontend: switch icon lookup to catalogue's `icon` string; switch BlockNode body on `semantics`; add temporary "no inspector yet" placeholder for new types.
6. Update `scripts/seed_pathway.py` to include `form`, `wait` blocks and one marker-anchored edge so the demo pathway exercises every primitive.
7. `/verify` clean on both apps. Playwright smoke covers dropping each new block type.

Rollback: `moon run backend:migrate -- downgrade -1` reverses (with documented loss of timer rows). Frontend revert is a single PR revert; nothing on disk persists state.

## Open Questions

- **`pathway_link.context_mapping`** — should the JSON Schema bound key/value to `field_path` strings, or stay free-form for now? Default: free-form; constrain once `pathway-config-forms` ships and we learn what authors actually wire.
- **`form.questions[].type` enum** — text / long_text / single_choice / multi_choice / scale / date / file is plausibly enough; should `signature` or `photo` be in PoC? Default: defer to a follow-up; PoC pathway uses text + single_choice + scale.
- **`wait` timeout escalation** — `on_timeout: continue/escalate` is a coarse switch. "Escalate" semantics deferred to runtime engine spec. PoC may treat both identically (log + continue) — flag in engine work.
