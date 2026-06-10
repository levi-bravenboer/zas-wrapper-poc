# Change Chain — Pathway Model Redesign

Parent: `pathway-model-redesign` (design only — no implementation tasks).

OpenSpec has no native cross-change dependency field, so the order below is the source of truth. Each child change depends on **all** prior children being archived (or at minimum applied + tests green on the integration branch).

## Order

```
1. pathway-model-foundations
     └─ requires: pathway-model-redesign (parent, design only)
     └─ adds:    BaseBlock hierarchy, single-table inheritance, typed read API
     └─ keeps:   write API on compat shim until #2

2. pathway-input-logic-and-timing
     └─ requires: pathway-model-foundations (this chain)
     └─ drops:   pathway_edge table, write-compat shim, pathway_block_legacy
     └─ adds:    input_logic + TimingPolicy + DecisionBlock.outputs

3. pathway-runtime-aggregate
     └─ requires: pathway-input-logic-and-timing (this chain)
     └─ adds:    pathway_enrollment + pathway_block_execution + pathway_deferred_field_value
     └─ adds:    minimal runtime engine + /enrollments API surface
```

## Why this order

- **Foundations first**: introduces the typed class hierarchy without changing builder behaviour. Compat shim keeps the legacy write API alive so the builder team can keep shipping. Risk concentrated in the migration.
- **input_logic + timing second**: requires the new class hierarchy to attach `input_logic` and `timing_policy` to. Drops the edge table only after every block can carry its own input rules. Retires the compat shim now that builder authors typed payloads.
- **Runtime aggregate third**: requires `input_logic` to evaluate eligibility and `TimingPolicy` to compute `scheduled_at`. Independent of builder UI; can land in parallel with builder polish on #2 once #2 is frozen.

## Concurrency rule

The three changes MUST merge sequentially on `main`. They MAY be drafted in parallel in separate worktrees, but apply / merge order is strictly chain order. If a downstream change needs a tweak to an upstream spec, the change goes in the upstream proposal — never in the downstream one.

## Decisions reference

All design decisions live in `pathway-model-redesign/design.md` (D1–D10). Each child change links back to the relevant D# in its proposal.

## Tracking

| # | Change | Worktree | Status |
| --- | --- | --- | --- |
| — | `pathway-model-redesign` (parent) | `.worktrees/feat-pathway-model-redesign/` | proposal in review (PR #42) |
| 1 | `pathway-model-foundations` | `.worktrees/feat-pathway-model-redesign/` | ready-to-apply (26 / 26 tasks complete; registry retire landed in PR #42) |
| 2 | `pathway-input-logic-and-timing` | `.worktrees/feat-pathway-input-logic-and-timing/` | ready-to-apply (§1-§6 + §8 done; §7.2/§7.3 deferred to backfill fixture follow-up; merges after slot #1) |
| 3 | `pathway-runtime-aggregate` | TBD | draft |

Update this file whenever a change advances state (draft → in-review → applied → archived).
