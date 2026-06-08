## Context

See `proposal.md` for the why. This file held open design questions during sparring; decisions are now resolved inline. It becomes the canonical "how" for the three child changes (`pathway-model-foundations`, `pathway-input-logic-and-timing`, `pathway-runtime-aggregate`).

Existing prior art in the codebase:

- `app/db/models/pathway/block.py` — current ORM (one class, generic).
- `app/domain/pathway/blocks/_base.py` + per-kind `block.py` files — current registry pattern (data, not classes).
- `app/db/models/pathway/block_deferred_field.py` — existing deferred field row; bolted on, not first class.
- `app/domain/pathway/lanes.py` — lane kind catalogue (kept as-is).
- `app/db/models/pathway/edge.py` — current edge model (to be retired; see D2).
- `app/db/models/pathway/phase.py` — phase model (kept; phases are day buckets on the canvas).

The runtime engine doesn't exist yet beyond stubs; this redesign defines what it will consume.

## Resolved Design Decisions

### D1 — ORM inheritance strategy

**Decision: single-table inheritance.**

One wide `pathway_block` table with a discriminator column and nullable per-kind columns. PoC stage; pathways aren't write-heavy; "load whole pathway" stays a single SELECT. DB-level shape enforcement (NOT NULL per kind) is deferred — domain layer + Pydantic v2 carry the contract.

If joined inheritance becomes valuable later, the migration path is per-kind table extraction; not planned for the PoC.

### D2 — Edges: drop authored rows, derive on read

**Decision: drop `pathway_edge` table. `block.input_logic` is the single source of truth; canvas computes the edge list on read.**

Materialised view deferred until profiling shows it's needed. Migration drops the `pathway_edge` table and rewrites any consumer (canvas API, topology queries) to compute edges from `input_logic`.

### D3 — `input_logic` predicate vocabulary

**Decision: closed enum + typed args.**

```python
class PredicateKind(str, Enum):
    IF_DONE = "if_done"
    HAS_DATA = "has_data"
    VALUE_EQUALS = "value_equals"
    VALUE_GT = "value_gt"
    WAIT_AFTER = "wait_after"
    DECISION_OUTPUT = "decision_output"

class InputLogicRule(TypedDict):
    node: str
    predicate: PredicateKind
    args: dict[str, Any]  # typed per predicate via discriminated union
```

No expression language. No `arbitrary_python` escape hatch. New predicates land via typed code change + review. MDR posture: all predicates are operational, none encode clinical reasoning.

### D4 — Deferred-field representation

**Decision: sibling `DeferredFieldSpec` list per block class.**

```python
class AppointmentBlock(BaseBlock):
    location: str
    scheduled_at: datetime

    DEFERRED_FIELDS = (
        DeferredFieldSpec(attr="location", label="Locatie afspraak", kind="text", required=True),
        DeferredFieldSpec(attr="scheduled_at", label="Geplande datum", kind="datetime", required=True),
    )
```

Plays nice with Pydantic v2 + OpenAPI codegen (`openapi-sync`). Same field can flip deferred/static per template instance. Spec carries form-render metadata (label, kind, help, dep).

`Deferred[T]` typing markers rejected — break Pydantic v2 validation + OpenAPI generation.

### D5 — Timing model split

**Decision: hard split.**

- `TimingPolicy` — value object on the block template. Tagged union: `fixed_duration`, `wait_after`, `due_within`, `at_enrollment_picked_date`. No `started_at` / `completed_at`. Stored inline on block row (typed columns, not JSONB).
- `BlockExecution` — row in `pathway_block_execution`, keyed by `(enrollment_id, block_template_id)`. Holds `scheduled_at`, `started_at`, `completed_at`, `due_at`, `state`.

`PathwayEnrollment.anchor_date` is the single anchor for the enrollment. Relative policies derive `BlockExecution.scheduled_at` from `anchor_date + policy.offset`. `at_enrollment_picked_date` blocks: deferred field value stored on `DeferredFieldValue` AND mirrored to `BlockExecution.scheduled_at` at enrollment time. Controlled duplication; never recomputed.

### D6 — Decision block outputs

**Decision: producer block declares typed `outputs: tuple[str, ...]`; downstream references via `decision_output` predicate.**

```python
class DecisionBlock(BaseBlock):
    mode: Literal["xor", "and"] = "and"
    outputs: tuple[str, ...]  # e.g. ("matches_criteria", "fails_criteria")
```

Downstream:

```python
input_logic = [
    {"node": "decision-criteria", "predicate": "decision_output", "args": {"output_key": "matches_criteria"}},
]
```

Publish-time validator enforces every `output_key` exists on the named producer. AND fan-out is default; XOR is `mode="xor"` on the producer. Other branching kinds (`Subpath`, future) declare their own `outputs` — uniform mechanism.

### D7 — Lane kind ownership

**Decision: class-level `allowed_lane_kinds` + instance `lane_id` FK.**

```python
class MDOBlock(BaseBlock):
    allowed_lane_kinds = (LANE_KIND_CAREGIVER, LANE_KIND_EXTERNAL)
```

Instance retains `lane_id` for canvas placement. Publish-time validator enforces `lane.kind ∈ allowed_lane_kinds`. Mirrors current `BlockTypeEntry.allowed_lane_kind_codes` contract; moves source from registry data to class attribute.

### D8 — Pathway versioning

**Decision: untouched.**

`PathwayVersion` (`draft | published`, one published per pathway, enrollment FK to version) stays. Redesign happens inside a version; envelope unchanged.

### D9 — Sequencing

**Decision: split into 3 sequential changes.**

1. `pathway-model-foundations` — `BaseBlock` hierarchy, single-table ORM mapping, read API. Write API kept on compat shim. No behaviour change visible to builder.
2. `pathway-input-logic-and-timing` — drop `pathway_edge`, introduce `input_logic` + `TimingPolicy`. Builder API surfaces new shape; canvas reads from `input_logic`. Old write endpoints retired.
3. `pathway-runtime-aggregate` — `PathwayEnrollment`, `BlockExecution`, `DeferredFieldValue` tables. Runtime engine consumes aggregate.

Merge order strict. Drafting may run in parallel in separate worktrees. CHAIN.md updated when these changes are proposed.

### D10 — Migration of existing rows

**Decision: drop + manual recreation.**

Alembic drops the old `pathway_block` / `pathway_edge` / `pathway_block_deferred_field` tables. Demo pathways (Rugrevalidatie etc.) recreated manually via the builder UI after #2 ships. No seed script in scope for this redesign; if reproducibility is needed later, capture as a follow-up change once the new model is stable.

## Risks / Trade-offs

- **D1 single-table → no DB-level per-kind enforcement.** Mitigation: Pydantic v2 + domain validation. Risk: a bad write that bypasses the domain layer corrupts a block row. Backstop: contract tests on the API layer that every mutation goes through the typed block class.
- **D2 derive-on-read → canvas read cost grows with pathway size.** Mitigation: pathways stay small (< ~200 blocks). If profiling shows hotspot, add materialised view in a follow-up.
- **D3 closed enum → adding a predicate is a code change.** Accepted. MDR posture is the win.
- **D5 duplicated `scheduled_at`.** Mitigation: only written at enrollment; never recomputed. Audit: integration test that asserts `DeferredFieldValue.value == BlockExecution.scheduled_at` for `at_enrollment_picked_date` blocks.
- **D9 sequencing → builder team blocked on writes between #1 and #2.** Mitigation: compat shim in #1 keeps the old write API alive against the new model. Builder team can keep shipping.
- **D10 manual recreation → no CI reproducibility for demo content.** Accepted for PoC. Re-seed script is a follow-up.

## Migration Plan

Per-change migration outline (full Alembic revisions land inside each child change):

### #1 `pathway-model-foundations`

- New `pathway_block` table with discriminator + per-kind nullable columns. Old `pathway_block` renamed to `pathway_block_legacy` (read-only during transition).
- Data migration: legacy `(type, config)` rows mapped into the new typed columns via per-kind transformer functions. PoC scope: cover only the block kinds present in demo seeds.
- Read API switched to the new table; write API stays on `pathway_block_legacy` via compat shim until #2.

### #2 `pathway-input-logic-and-timing`

- Drop `pathway_edge` table. Backfill `input_logic` on every block row from the dropped edges (`(from_id → to_id)` becomes `{node: from_slug, predicate: "if_done"}` per default). Manual review for decision-edge cases.
- Add `timing_policy` columns to `pathway_block` (tagged union via discriminator). Backfill from existing timing fields where present; default `fixed_duration` of legacy duration where set, else `wait_after` zero.
- Retire `pathway_block_legacy` and the compat shim.

### #3 `pathway-runtime-aggregate`

- New tables: `pathway_enrollment`, `pathway_block_execution`, `pathway_deferred_field_value`.
- No data migration — runtime aggregate didn't exist before. Future enrollments only.

## Vocabulary

- **block ≡ node** — domain says block, builder UI/API surfaces as node. Canonical: block.
- **template** — author-time shape on a `PathwayVersion`.
- **execution** — runtime state per enrollment.
- **anchor_date** — enrollment-level reference date that relative `TimingPolicy` offsets compute from.
