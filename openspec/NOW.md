# NOW — current focus

Single source of truth for "what is the team working on right now".
Every agent reads this file at the start of any session before
touching `openspec/changes/`. Updated whenever focus shifts.

## Active change

**`pathway-completion`** —
`openspec/changes/pathway-completion/`

This is **the leading spec for this worktree**. It folds together
everything that was still open after PR #42 (the pathway-model
redesign chain) and the dialog-driven builder rewrite. No sibling
changes; no separate chain docs. One folder, one tasks list, one
status snapshot.

Three parts, executed strictly in order:

- **Part A — Block catalogue completion** (`§A1-§A8`). Ship the 8
  urology-flow kinds. A1 `start` + A2 `end_pathway` already
  shipped on this branch. A3-A8 pending.
- **Part B — Predicate catalogue completion** (`§B1-§B3`). Add
  `if_not_done_within`, `aggregator_n_of_m`, `event(node, event_type)`
  to the `input_logic` rule set.
- **Part C — Builder dialog flow** (`§C1-§C8`). Replace the
  drag-canvas with a dialog-driven authoring flow on top of the
  frozen catalogue + predicate set. BLOCKED until Parts A + B
  complete.

Cross-Part dependencies inside Part A:
- A7 `mdo` blocked on B2 `aggregator_n_of_m`.
- A8 `informed_consent` blocked on B3 `event`.

Full task list + status snapshot live in
`openspec/changes/pathway-completion/tasks.md`. Update that file
whenever a `§` advances state.

## Completed chain (do NOT pick work from here)

**Pathway model — Redesign chain** —
`openspec/changes/CHAIN-pathway-model.md`

Parent design + slots #1 / #2 / #3 (foundations + input_logic +
runtime aggregate). Bundled in PR #42. Carry a `STATUS: FROZEN`
banner at the top. Reference for design context (D1-D10 decisions,
urology example flow) only. Any follow-up on the redesign happens
via the active change above.

## How agents should pick work

1. Read this file (NOW.md).
2. Open `openspec/changes/pathway-completion/tasks.md`.
3. Pick the topmost section whose status is **pending** and whose
   cross-Part dependencies (if any) are satisfied.
4. Verify the section still matches `openspec/scope.md` (PoC tier).
5. Implement.

## When to update NOW.md

- The active change completes → move it to the "Completed" section
  and point to the next active change.
- Focus area changes → replace the "Active change" section.
- Active work forks (rare; we generally avoid this) → list each
  forked change with its own status pointer.

## Where related background lives

- Tier ledger: `openspec/scope.md`
- Parked ideas: `openspec/backlog.md`
- MDR safety: `openspec/mdr-watchlist.md`
- Long-lived project context: `openspec/project.md`
- Workflow rules: `openspec/AGENTS.md`
- Design context for the underlying model: `openspec/changes/CHAIN-pathway-model.md` (frozen)
