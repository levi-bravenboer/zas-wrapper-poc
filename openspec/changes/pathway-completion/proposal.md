# Pathway completion (parent: pathway-model-redesign)

**Tier**: `[poc]`

**THE leading spec for this worktree.** Everything still open after
the pathway-model-redesign chain (PR #42, slots #1/#2/#3) lands in
this single change. No sibling changes. Order of execution lives in
the tasks list (Part A → B → C). Slots that already shipped on this
branch are marked `[x]` in `tasks.md`.

## Why one spec

The redesign chain bundled the typed `BaseBlock` hierarchy, the
typed `input_logic` set, and the runtime aggregate (slots
#1/#2/#3). Three gaps remain before the builder UX redesign is
possible:

1. **Block catalogue gap.** The urology demo flow
   (`pathway-model-redesign/example-flow-urology.md`) references
   12 kinds. Slot #1 shipped 9 of them; `start` + `end_pathway`
   shipped on this branch. Six are still on paper.
2. **Predicate catalogue gap.** Slot #2 shipped the base predicate
   set (`if_done`, `has_data`, `value_equals`, `value_gt`,
   `wait_after`, `decision_output`). The urology flow needs three
   more (`if_not_done_within`, `aggregator_n_of_m`,
   `event(node, event_type)`).
3. **Builder UX rewrite.** The drag-and-drop canvas authors edges
   that no longer exist (slot #2 §3 retired `pathway_edge`). Author
   surface must move to a dialog-driven flow on top of the
   `input_logic` rule set.

Splitting these across three change folders made the queue
discoverable but added coordination cost without buying anything.
One leading spec means: one tasks list, one place to track status,
one PR scope.

## What changes (3 parts, executed in order)

### Part A — Block catalogue completion

Ship the 8 kinds catalogued in
`pathway-model-redesign/example-flow-urology.md` (lines 72-83) on
top of the existing 9 slot-#1 kinds. Wire `kind` uses snake_case
throughout to match existing convention (`pathway_link`,
`luscii_program`).

| § | Wire `kind` | Class | Lane | Status |
| --- | --- | --- | --- | --- |
| A1 | `start` | `StartBlock` | `system` | ✓ shipped |
| A2 | `end_pathway` | `EndPathwayBlock` | `system` | ✓ shipped |
| A3 | `notification` | `NotificationBlock` | `patient` | pending |
| A4 | `treatment` | `TreatmentBlock` | `caregiver` | pending |
| A5 | `subpath` | `SubpathBlock` | `system` | pending |
| A6 | `bridge` | `BridgeBlock` | `system` | pending |
| A7 | `mdo` | `MdoBlock` | `caregiver` | pending (needs B2) |
| A8 | `informed_consent` | `InformedConsentBlock` | `patient` | pending (needs B3) |

Per-kind decisions (cardinality, columns, validators, runtime
semantic, lane-kind invariant) live in the **Decisions log** section
below — one entry per kind, added as that section's tasks land.

### Part B — Predicate catalogue completion

Three additions to the `input_logic` rule set so the urology demo
flow can be expressed end-to-end:

- **`if_not_done_within(after_block, days)`** — SLA / timeout. Block
  becomes `eligible` only after the referenced block's eligibility
  moment + `days * 24h` has elapsed AND the referenced block is
  still NOT in a terminal state.
- **`aggregator_n_of_m(count, total)`** — partial-completion
  aggregator on `InputLogic.aggregator`. Block eligible when ≥
  `count` of the rules in `InputLogic.rules` resolve true.
- **`event(after_block, event_type)`** — in-execution event
  predicate. Engine receives events through
  `EnrollmentService.record_event(execution_id, event_type, payload)`
  (new POST `/enrollments/{id}/events`) and re-runs eligibility.

### Part C — Builder dialog flow

Replace the current drag-and-drop pathway builder with a
dialog-driven flow on top of the now-frozen catalogue + predicate
set. The canvas keeps its visual job (phases × lanes overview) but
the author never drags a block, never drags an edge, and never
positions anything by hand.

Key shape:

- Bottom palette stays. Click a kind → block dialog opens.
- Dialog carries: title, phase picker, per-kind config form,
  `input_logic` rule composer (typed over already-placed blocks),
  `timing_policy` editor (when the kind permits).
- Lane is derived from the kind's `allowed_lane_kinds` — picker
  only when more than one kind is allowed.
- Block (x, y) is computed by a topological-sort layout pass over
  `input_logic`. Edges are drawn from the `DerivedEdge[]`
  projection the server already returns.
- Click existing block → same dialog opens in edit mode.
- Hover block → X icon → confirm dialog ("Volgende blokken
  verwijzen er nog naar: …") → on confirm, cascade-cleanup strips
  `input_logic.rules` references on every dependent.
- Empty lanes are hidden so the canvas stays compact. Phases keep
  the existing "+ Fase" button + per-phase rename / reorder
  controls.

One new backend check enables the cascade-cleanup safely: every
`InputLogicRule.node` must reference a block in the same version
(catches edge cases where the UI cascade missed a rule). Surfaces
as `BlockConfigError(field=…rules[i].node)` from the publish gate.

## Out of scope

- Decision-output branches authoring — handled by the existing
  decision-block inspector inside the new dialog. Not a redesign.
- Phase add / rename / reorder UX — kept identical to the current
  builder.
- Runtime engine changes beyond the three new predicates + the
  cascade-reference check.
- Auto-layout across phases (each phase × lane cell is laid out
  independently; we do not auto-position phases).
- Cardinality changes to existing kinds (e.g. allowing N decision
  blocks per phase).
- Event-source plumbing from real Luscii / HiX webhooks. PoC fires
  events from seed scripts + the manual `record_event` endpoint
  only.
- Persistence of historical events — events are not stored, only
  acted on at receive time. MVP can add an audit log.
- Merging or retiring existing `form` / `milestone` / `wait`
  (separate future proposal if at all).

## Decisions log (per kind / per predicate)

Added as each `§` lands. Each entry captures the final shape so
later sessions can answer "why did we choose X for this kind?"
without re-deriving.

### A1 `start` — landed

- Wire `kind`: `start`.
- Cardinality: exactly one per pathway version (publish-time
  validator rejects 0 or >1).
- Per-kind columns: none. `BaseBlock.name` is the only stored field.
- Lane: `system`.
- Input logic: forbidden — must be the empty aggregate.
- Timing policy: forbidden — must be `None`.
- Runtime: at enrollment create, every `StartBlock` execution skips
  `pending` / `eligible` and lands directly at `state=completed`.
  Downstream `if_done(start)` rules become eligible on the same
  eligibility pass.

### A2 `end_pathway` — landed

- Wire `kind`: `end_pathway` (snake-case; parent catalogue's
  hyphenated label is documentation-only).
- Cardinality: ≥ 1 per pathway version. Multiple terminals are
  explicitly allowed.
- Per-kind columns: none.
- Lane: `system`.
- Input logic: ALLOWED — author wires each end to its gating
  predicate.
- Timing policy: forbidden — must be `None`.
- Runtime: first reachable `EndPathwayBlock` completion flips the
  enrollment from `active` to `completed`. Idempotent on re-fire.

### A3–A8 — to be filled in as they land

(Pending. Each section follows the same shape: wire kind,
cardinality, per-kind columns, lane, input logic / timing policy
constraints, runtime semantic, validator behaviour, fixture
updates.)

### B1–B3 — to be filled in as they land

(Pending. Each section captures the final predicate args shape,
evaluator behaviour, publish-gate checks, runtime hooks.)

### C — to be filled in as the builder ships

(Pending. Captures the auto-layout constants, the dialog state
machine, the cascade-cleanup walk, and any per-kind dialog
specialisations.)
