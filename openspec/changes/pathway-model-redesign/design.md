## Context

See `proposal.md` for the why. This file is the sparring document — it lists the open design questions and my current take per question. Each section ends with a "Decision: TBD — sparring required" line. We fill those in as we discuss; once decided, this file becomes the canonical "how" for `tasks.md`.

Existing prior art in the codebase:

- `app/db/models/pathway/block.py` — current ORM (one class, generic).
- `app/domain/pathway/blocks/_base.py` + per-kind `block.py` files — current registry pattern (data, not classes).
- `app/db/models/pathway/block_deferred_field.py` — existing deferred field row; bolted on, not first class.
- `app/domain/pathway/lanes.py` — lane kind catalogue (kept as-is).
- `app/db/models/pathway/edge.py` — current edge model (to be retired; see D2).
- `app/db/models/pathway/phase.py` — phase model (kept; phases are day buckets on the canvas).

The runtime engine doesn't exist yet beyond stubs; this redesign defines what it will consume.

## Open Design Questions

### D1 — ORM inheritance strategy: single-table vs joined

**Question.** Do we map the new class hierarchy with SQLAlchemy *single-table inheritance* (one wide table, discriminator column, nullable per-kind columns) or *joined inheritance* (a base table + per-subclass table joined on PK)?

**My current take.** Joined inheritance for the long term, single-table for the PoC migration.

- Joined keeps the per-kind columns typed + NOT NULL where the domain requires; you can't accidentally read an `AppointmentBlock.location` from a `DecisionBlock` row because the FK join enforces shape.
- Single-table is easier to migrate to and ship fast: one table, one alembic migration; queries that load "all blocks of pathway X" stay a single SELECT.
- Pathways aren't write-heavy. The join cost on read is negligible at our row counts.

**Trade-offs.**

| Choice | Pro | Con |
|---|---|---|
| Single-table | Fewer tables, simpler migration, simpler "load whole pathway" query | Nullable columns for every per-kind field; nothing in the DB enforces "DecisionBlock has no `location`" |
| Joined | Per-kind tables enforce shape at the DB level; cleaner audit trail; future kinds add a table not a column | More tables, joined SELECT to load a pathway; per-kind migrations |
| Concrete (one table per class, no base) | — | Drops the base-class contract; no thanks |

**Decision: TBD — sparring required.**

---

### D2 — Edges: retire as authored rows, derive from `input_logic`

**Question.** Do we drop the `pathway_edge` table entirely, or keep a materialised view of it for canvas / topology queries?

**My current take.** Drop the authored table. Add a derived view (materialised or plain SQL) that the canvas reads — but the source of truth is `block.input_logic`.

- Authored edges + `input_logic` would duplicate the same fact (Block B depends on Block A) in two places. They will drift.
- Canvas rendering needs an edge list; computing it on read is fast (it's just unpacking `input_logic` per block). If profiling later shows we need it materialised, we add a view; for now, compute-on-read.

**Trade-offs.**

| Choice | Pro | Con |
|---|---|---|
| Drop edges, derive | Single source of truth; no drift; matches the domain shape | Canvas read is slightly more work |
| Keep edge table, sync from input_logic via app code | Canvas read is one SELECT | Two stores must stay in sync; failure mode = stale edges |
| Keep edge table, sync via DB trigger | Canvas read is one SELECT; sync is atomic | DB triggers are hard to reason about; future changes harder |

**Decision: TBD — sparring required.**

---

### D3 — `input_logic` predicate vocabulary: closed enum or open expression language

**Question.** Is `rule` in `input_logic` a closed enum of predicates we hard-code (`if_done`, `if_complete`, `has_data`, `value_equals`, `wait_n_days`, …), or an expression language the builder writes (`block:lab.status == "done" AND block:measurement.value > 5`)?

**My current take.** Closed enum to start, with a typed-args object per rule. Expression language is a trap for an MDR-conscious project.

```python
class InputLogicRule(TypedDict):
    node: str                          # other block's slug
    predicate: PredicateKind           # closed Literal
    args: dict[str, Any]               # typed per predicate

class PredicateKind(str, Enum):
    IF_DONE = "if_done"                # other block is in state `complete`
    HAS_DATA = "has_data"              # other block has a non-null `result` field
    VALUE_EQUALS = "value_equals"      # args: { field: str, value: literal }
    VALUE_GT = "value_gt"              # args: { field: str, value: number }
    WAIT_AFTER = "wait_after"          # args: { offset: ISO8601 duration }
    DECISION_OUTPUT = "decision_output"  # args: { output_key: str }
```

- Closed enum keeps the runtime engine analysable: every predicate has known semantics, known side effects, known evaluator.
- Each predicate kind is auditable + testable in isolation.
- Adding a new predicate is a typed code change, reviewed; not an arbitrary string a builder can type.
- The MDR boundary is much easier to defend: we ship a finite set of predicates, none of which encode clinical reasoning, all of which are operational ("did the lab task complete?") not interpretive ("is the lab value pathological?").

**Trade-offs.**

| Choice | Pro | Con |
|---|---|---|
| Closed enum + typed args | Auditable, MDR-defensible, simple runtime | Adding a predicate is a code change |
| Open expression language (JSONLogic, CEL) | Flexible, no code change per rule | Hard to audit; large MDR exposure if anyone encodes clinical reasoning; runtime more complex |
| Closed enum now + escape hatch for `arbitrary_python: lambda` | Flexible escape valve | The escape valve becomes the default; same MDR exposure as open language |

**Decision: TBD — sparring required.**

---

### D4 — Deferred-field representation: typing marker vs sibling spec

**Question.** Do we mark deferred fields with a Python-level marker (`Deferred[T]` typing trick) or with a separate `DeferredFieldSpec` model attached to the block?

**My current take.** Sibling spec, owned by the block class via a class-level declaration.

```python
class AppointmentBlock(BaseBlock):
    title: str
    mode: Literal["in_person", "video", "phone"]
    location: str
    scheduled_at: datetime

    DEFERRED_FIELDS = (
        DeferredFieldSpec(
            attr="location",
            label="Locatie afspraak",
            kind="text",
            required=True,
        ),
        DeferredFieldSpec(
            attr="scheduled_at",
            label="Geplande datum",
            kind="datetime",
            required=True,
            help="Bepaald bij enrollment door zorgteam.",
        ),
    )
```

- `Deferred[T]` typing tricks make pretty class signatures but break Pydantic v2 validation, OpenAPI generation, and IDE inspection.
- Sibling spec lets the same field be deferred OR static depending on the template instance (e.g. `Appointment` for a fixed yearly check-up has `scheduled_at` hard-coded; for a video consult it's deferred at enrollment).
- The spec carries everything the builder needs to render the enrollment form: label, type, validation rule, default, help text, dependency on another deferred field.

**Trade-offs.**

| Choice | Pro | Con |
|---|---|---|
| Sibling `DeferredFieldSpec` list per class | Doesn't fight Pydantic / OpenAPI; same field can flip deferred/static per template; rich metadata | Two places to update if you add a field |
| `Deferred[T]` typing marker | Pretty signatures | Fights Pydantic v2, OpenAPI, IDE; doesn't model "same field, deferred for some templates, static for others" |
| Separate `pathway_block_deferred_field` table only (current shape) | No domain class change | Spec is invisible from the block class; nothing prevents drift |

**Decision: TBD — sparring required.**

---

### D5 — Timing model: split `TimingPolicy` (template) and `BlockExecution` (runtime)

**Question.** Confirm the split is two distinct ORM tables and two distinct domain objects, with no overlapping fields except FKs?

**My current take.** Yes, hard split.

- `TimingPolicy` is a value object on the block template. Shape: a tagged union of policies (`fixed_duration`, `wait_after`, `due_within`, `at_enrollment_picked_date`). No `started_at`. No `completed_at`. Stored either inline on the block row (single small JSONB if SQLAlchemy join cost is too high; otherwise as a few typed columns).
- `BlockExecution` is a row in `pathway_block_execution`, keyed by `(enrollment_id, block_template_id)`. Holds `scheduled_at`, `started_at`, `completed_at`, `due_at`, `state`. Owns nothing the template owns.

**Open question inside this question.** Where does the patient's chosen enrollment date live — on `BlockExecution` (per block) or on `PathwayEnrollment` (one date for the whole enrollment that policies derive their offsets from)?

- I lean towards: `PathwayEnrollment.anchor_date` is the single chosen anchor; each `BlockExecution.scheduled_at` is computed from `anchor_date + policy.offset` for blocks whose policy is relative. For blocks whose policy is `at_enrollment_picked_date`, the date is supplied as a deferred field and stored both as the `DeferredFieldValue` AND as `BlockExecution.scheduled_at`.

**Decision: TBD — sparring required.**

---

### D6 — Decision block outputs: how do downstream blocks reference branches?

**Question.** A `DecisionBlock` evaluates a predicate and routes execution to one of its outputs (XOR) or all of them (AND fan-out). How does downstream `input_logic` reference "the YES output" vs "the NO output"?

**My current take.** Decision block declares typed `outputs: tuple[str, ...]` (e.g. `("matches_criteria", "fails_criteria")`). Downstream blocks reference via:

```python
input_logic: [
    { node: "decision-criteria", predicate: "decision_output", args: { output_key: "matches_criteria" } },
]
```

- The producer block owns its output vocabulary.
- AND fan-out is the default: every output fires unless the predicate forbids it.
- XOR is a property of the `DecisionBlock` itself (`mode: "xor" | "and"`).
- A future block kind that wants exotic routing (e.g. `Subpath` returning N parallel branches) declares its own `outputs`.

**Decision: TBD — sparring required.**

---

### D7 — Lane kind ownership stays on the block, not on the lane row

**Question.** Today lanes are separate rows that the block references via FK. Is the lane still the source of truth for "this block runs on the patient lane", or is the kind a property of the block class (`AppointmentBlock.lane_kind = LANE_KIND_CAREGIVER`)?

**My current take.** Both, with the lane row constraint enforced by `allowed_lane_kinds` on the block class.

- The block class declares `allowed_lane_kinds: tuple[str, ...]`. The instance still has a `lane_id` FK so the canvas can place it in the right visual lane.
- The pathway-publish validator checks every block's `lane.kind` is in `allowed_lane_kinds`. Today's `BlockTypeEntry.allowed_lane_kind_codes` already does this; we keep the contract.
- A block like `MDOBlock` might allow `LANE_KIND_CAREGIVER` AND `LANE_KIND_EXTERNAL` (the meeting can be hosted by either side). The class declares both; the builder picks one when placing.

**Decision: TBD — sparring required.**

---

### D8 — Pathway versioning stays as-is

**Question.** Does this change touch how pathway versions / publish work?

**My current take.** No. The current `PathwayVersion` model (`draft | published`, one published at a time per pathway) is correct and doesn't need rework. New blocks attach to a version; new versions snapshot blocks; enrollment binds to a specific published version. The redesign happens *inside* a version; the version envelope is unchanged.

**Decision: TBD — sparring required.**

---

### D9 — Sequencing: one big change vs split into N

**Question.** Land this in one merge, or split?

**My current take.** Split into three:

1. **`pathway-model-foundations`** — class hierarchy + ORM mapping + read API. Old write API still accepted via compat shim. Migration moves old data into the new shape. No behaviour change visible to the builder yet.
2. **`pathway-input-logic-and-timing`** — drop the `edge` table, introduce `input_logic` + `TimingPolicy`. The builder API surfaces the new shape; the canvas reads from it. Old endpoints retired.
3. **`pathway-runtime-aggregate`** — `PathwayEnrollment` + `BlockExecution` + `DeferredFieldValue` tables. Builder unchanged; runtime engine consumes the aggregate.

Each is independently mergeable + reversible. Splitting also matches CHAIN-style dependency: you can land #1, freeze, build out #2, then #3.

**Decision: TBD — sparring required.**

---

### D10 — Migration of existing `PathwayBlock` rows

**Question.** Do we migrate existing rows (the demo Rugrevalidatie + future seeded pathways), or do we drop them and re-seed?

**My current take.** Drop + re-seed for the PoC. The currently-seeded pathways are demo content; they aren't real patient data. A one-off Alembic data migration that maps every old `(type, config)` pair into the new hierarchy is doable but throws code at a problem the seed scripts solve.

**Decision: TBD — sparring required.**

---

## Risks / Trade-offs

To be filled in once D1–D10 are decided. Key risks anticipated:

- ORM inheritance choice (D1) drives migration complexity.
- Predicate vocabulary (D3) drives MDR posture.
- Sequencing (D9) drives delivery risk.

## Migration Plan

To be filled in once D1, D9, and D10 are decided.
