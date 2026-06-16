## Why

**Tier**: `[poc]`
**Parent**: `pathway-model-redesign` (resolved design lives there)
**Chain slot**: #2 of 3 — requires `pathway-model-foundations` archived

The parent change `pathway-model-redesign` decided to drop the authored `pathway_edge` table in favour of `block.input_logic` as the single source of truth (D2), introduce a closed-enum predicate vocabulary (D3), and split timing into a template-level `TimingPolicy` + runtime `BlockExecution` (D5). It also decided that `DecisionBlock` declares typed `outputs` and downstream blocks reference them via a `decision_output` predicate (D6).

Chain slot #1 (`pathway-model-foundations`) landed the class hierarchy and storage. This change activates connectivity + timing on the new model and retires the legacy write path.

## What Changes

### `input_logic` per block

`BaseBlock.input_logic: list[InputLogicRule]` becomes populated and authoritative. Each rule has `node`, `predicate` (closed enum), `args` (typed per predicate). Aggregator defaults to `all_of`; subclass may override.

```python
class PredicateKind(str, Enum):
    IF_DONE = "if_done"
    HAS_DATA = "has_data"
    VALUE_EQUALS = "value_equals"
    VALUE_GT = "value_gt"
    WAIT_AFTER = "wait_after"
    DECISION_OUTPUT = "decision_output"
```

No expression language. No escape hatch. Adding a predicate is a typed code change.

### Drop `pathway_edge` table

`pathway_edge` table dropped via alembic migration. Backfill: every edge row `(from_id → to_id)` becomes an entry in `to.input_logic` with `{node: from_slug, predicate: "if_done"}`. Decision-edge cases (typed branches) backfilled per `DecisionBlock.outputs` mapping.

### Canvas + topology reads compute edges on demand

Canvas API returns edges computed from `input_logic` per pathway. No materialised view yet — defer until profiling shows hotspot.

### `TimingPolicy` tagged union on block template

```python
TimingPolicy = (
    FixedDurationPolicy(duration: ISO8601Duration)
    | WaitAfterPolicy(offset: ISO8601Duration)
    | DueWithinPolicy(window: ISO8601Duration)
    | AtEnrollmentPickedDatePolicy()  # value supplied as deferred field
)
```

Stored as typed columns on `pathway_block` (discriminator + per-variant columns). Backfill from existing timing fields where present; default `WaitAfterPolicy(PT0S)` where absent.

### DecisionBlock typed outputs

`DecisionBlock.outputs: tuple[str, ...]` becomes required. `mode: Literal["xor", "and"] = "and"`. Publish-time validator enforces every downstream `decision_output` reference resolves to an actual `output_key` on the named producer.

### Retire write-compat shim from slot #1

`pathway_block_legacy` table dropped. Legacy `(type, config)` write path retired. All clients switched to typed-discriminated-union shape.

### Out of scope (chain slot #3)

- `PathwayEnrollment`, `BlockExecution`, `DeferredFieldValue` tables → slot #3
- Runtime engine consuming the aggregate → slot #3
- `anchor_date` mechanics → slot #3 (defined in design, used at runtime only)

## Impact

- Backend: `input_logic` field + predicate enum + validator; `TimingPolicy` tagged union; edge-table drop; legacy-shim retirement.
- Frontend: canvas reads switched to derived edges; builder UI authors `input_logic` instead of edges; legacy write payload removed.
- Tests: predicate evaluator unit tests; backfill correctness tests; canvas-edge derivation tests.
- Out-of-scope surfaces: runtime engine, enrollment.
