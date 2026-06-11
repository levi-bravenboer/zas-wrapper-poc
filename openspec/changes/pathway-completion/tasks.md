# Tasks — pathway-completion

Worked top-down. Parts execute strictly in order: **A → B → C**.
Within a Part, sections execute in §-order unless an explicit
cross-Part dependency is noted (A7 needs B2; A8 needs B3).

Each `§` lands as its own commit. Tests + `/verify` gate every
commit. Mark a task `[x]` only after `/verify` is green.

## § 0 Preconditions

- [x] 0.1 `[poc]` tier confirmed in `openspec/scope.md`.
- [x] 0.2 Parent `pathway-model-redesign` chain (slots #1/#2/#3) on
  this branch.
- [x] 0.3 Worktree `.env.local` points at backend on port 18000
  (docker compose dev stack).

---

## Part A — Block catalogue completion

Ship the 8 urology-flow kinds on top of slot #1's 9 kinds.

### § A1 `start` — DONE

- [x] A1.1 `app/domain/pathway/blocks/start/typed.py` —
  `StartBlock(BaseBlock)` with `KIND="start"`,
  `allowed_lane_kinds=(LANE_KIND_SYSTEM,)`, empty CONFIG_SCHEMA.
- [x] A1.2 Register `StartBlock` in `BLOCK_CLASSES` (palette first).
- [x] A1.3 `"start"` in `BlockSemanticsLiteral`.
- [x] A1.4 `StartBlockOut` + `StartBlockIn` + union members +
  lookup.
- [x] A1.5 Engine: `RuntimeEngine.auto_fire_starts` auto-completes
  `StartBlock` executions at enrollment create.
- [x] A1.6 Publish validator: exactly 1 start; empty `input_logic`;
  null `timing_policy`.
- [x] A1.7 Tests: catalogue projection, mapper round-trip, engine
  auto-complete, validator rejections.
- [x] A1.8 `/verify` backend; commit.

### § A2 `end_pathway` — DONE

- [x] A2.1 `app/domain/pathway/blocks/end_pathway/typed.py`.
- [x] A2.2 Register in `BLOCK_CLASSES`.
- [x] A2.3 `"end_pathway"` in `BlockSemanticsLiteral`.
- [x] A2.4 `EndPathwayBlockOut/In` + union + lookup.
- [x] A2.5 Publish validator: ≥1 end; null `timing_policy`;
  `input_logic` allowed.
- [x] A2.6 Enrollment service: completing an `EndPathwayBlock` flips
  `enrollment.state="active" → "completed"`. Idempotent.
- [x] A2.7 Tests.
- [x] A2.8 `/verify` backend; commit.

### § A3 `notification`

(Pending. Decide merge-vs-coexist with `message` in the Decisions
log when starting this section.)

- [ ] A3.1 Decide: own kind vs. extension of `MessageBlock`.
- [ ] A3.2-A3.8 Typed class, registry, schemas, validator, runtime,
  tests, verify, commit.

### § A4 `treatment`

(Pending. Decide variant-of-appointment-vs-new kind in the
Decisions log when starting.)

- [ ] A4.1-A4.8 (same shape as A3).

### § A5 `subpath`

(Pending. Decide overlap with existing `pathway_link` — keep
distinct kind or alias.)

- [ ] A5.1-A5.8.

### § A6 `bridge`

(Pending. Decide overlap with `pathway_link` + `subpath`.)

- [ ] A6.1-A6.8.

### § A7 `mdo` — depends on § B2

(Pending. Needs `aggregator_n_of_m` shipped first.)

- [ ] A7.1 `MdoBlock` typed class with `attendees: list[UUID]`
  (caregivers expected to contribute).
- [ ] A7.2 Class declares `EVENTS = ("attendee_contributed",)`.
- [ ] A7.3 Per-kind columns + mapper round-trip.
- [ ] A7.4 Publish validator: `attendees` non-empty; lane = caregiver.
- [ ] A7.5 Wire `input_logic` template that uses
  `aggregator_n_of_m` against per-attendee `event` rules.
- [ ] A7.6 Tests: n-of-m firing, attendees < count rejection.
- [ ] A7.7 `/verify`; commit.

### § A8 `informed_consent` — depends on § B3

(Pending. Needs `event(node, event_type)` shipped first for the
expiry signal.)

- [ ] A8.1 `app/domain/pathway/blocks/informed_consent/typed.py` —
  `InformedConsentBlock` with `questions: list[FormQuestion]`,
  `reminder_offset_iso: str = "P3D"`, `reminder_max: int = 3`,
  `expires_at_iso: str | None = None`. Lane:
  `(LANE_KIND_PATIENT,)`. ICON: `signature`.
- [ ] A8.2 Register in `BLOCK_CLASSES`; add to
  `BlockSemanticsLiteral`; add `InformedConsentBlockIn/Out`.
- [ ] A8.3 Migration: nullable per-kind columns on `pathway_block`.
- [ ] A8.4 Runtime: reminder scheduler ticks every
  `reminder_offset_iso` while `state == eligible` and
  `reminders_sent < reminder_max`. Expiry tick when
  `expires_at_iso` elapses → `state=expired` (new terminal). Engine
  fans this as a `decision_output(consented=false)`-equivalent so
  downstream branches can author "no consent received" paths.
- [ ] A8.5 Publish validator: `questions` non-empty; `reminder_max`
  ∈ [0, 10]; `expires_at_iso` parseable when set.
- [ ] A8.6 Tests: catalogue projection, validator branches,
  completion on consent, expiry transitions, reminder cap.
- [ ] A8.7 `/verify`; commit.

---

## Part B — Predicate catalogue completion

Three additions to the `input_logic` rule set.

### § B1 `if_not_done_within(after_block, days)`

- [ ] B1.1 `PredicateKind.IF_NOT_DONE_WITHIN` enum entry.
- [ ] B1.2 `IfNotDoneWithinArgs(_ArgsBase)` Pydantic model with
  `after_block: UUID`, `days: int` (1..365).
- [ ] B1.3 Evaluator branch in `input_logic/evaluator.py`. Returns
  `True` when the referenced block's execution is NOT in
  `state in {completed, skipped}` AND now ≥
  `block.eligible_at + days * 24h`.
- [ ] B1.4 Engine: schedules a re-evaluation tick at the SLA
  deadline so the block becomes `eligible` automatically when the
  predicate flips.
- [ ] B1.5 Publish gate: `after_block` must reference a real block
  in the same version; `days` ∈ [1, 365].
- [ ] B1.6 Tests: not-yet-expired → false; expired + still pending
  → true; expired + already completed → false; cross-block ref
  rejection.
- [ ] B1.7 `/verify`; commit.

### § B2 `aggregator_n_of_m(count, total)`

- [ ] B2.1 Add `"n_of_m"` to `Aggregator` literal in
  `predicates.py`.
- [ ] B2.2 `InputLogic.aggregator_args: NOfMArgs | None = None`.
  `NOfMArgs(count: int, total: int)` with `1 <= count <= total`.
- [ ] B2.3 Evaluator branch for `n_of_m` — true when ≥ `count` of
  the rules in `InputLogic.rules` resolve to `True`.
- [ ] B2.4 Publish gate: `1 <= count <= total`; rejects
  `count > len(rules)`.
- [ ] B2.5 Tests: 2-of-3 with one true → false; 2-of-3 with two
  true → true; 2-of-3 with three true → true; out-of-range count
  rejected.
- [ ] B2.6 `/verify`; commit.

### § B3 `event(after_block, event_type)`

- [ ] B3.1 `PredicateKind.EVENT` enum entry.
- [ ] B3.2 `EventArgs(_ArgsBase)` with `after_block`, `event_type`.
- [ ] B3.3 `EnrollmentService.record_event(execution_id,
  event_type, payload)` + POST `/enrollments/{id}/events` endpoint.
- [ ] B3.4 Evaluator: rule true once the matching event has been
  recorded for the referenced execution.
- [ ] B3.5 Publish gate: `event_type` must be in
  `type(node).EVENTS`.
- [ ] B3.6 Tests: unknown event_type rejected; known event_type +
  matching record promotes downstream block.
- [ ] B3.7 `/verify`; commit.

---

## Part C — Builder dialog flow

Replace the drag-canvas with a dialog-driven flow on top of the
frozen catalogue + predicate set. PRE-REQUISITE: Parts A + B
complete.

### § C1 HTML prototypes

- [ ] C1.1 `prototypes/builder-dialog/v1.html` — canvas with phases
  × lanes grid, palette at bottom, click-to-open block dialog,
  hover-X delete affordance, derived edges drawn between blocks.
  Mock data for the Rugrevalidatie pathway.
- [ ] C1.2 Iterate vN.html with the user until the dialog flow +
  the layout pass feel right. Each iteration creates a new
  `vN.html`; earlier versions stay as history.

### § C2 Frontend scaffolding

- [ ] C2.1 New `apps/orchestrator/src/modules/pathway/builder/`
  package: `BuilderCanvas.tsx`, `BlockDialog.tsx`,
  `BlockPalette.tsx`, `useBuilderLayout.ts`.
- [ ] C2.2 Strip the drag-and-drop wiring from the existing canvas
  (react-flow interactivity off; nodes + edges rendered read-only).
- [ ] C2.3 Palette click → `BlockDialog` in "add" mode with the
  right catalogue entry preselected.
- [ ] C2.4 Block click → `BlockDialog` in "edit" mode, hydrated
  from the existing typed envelope.
- [ ] C2.5 Hover X icon → `ConfirmDeleteDialog` listing dependent
  blocks → on confirm dispatch the cascade-cleanup reducer action.

### § C3 Layout engine

- [ ] C3.1 `useBuilderLayout` — pure function over
  `PathwayVersionDefinition` returning `{blocks: {id, x, y}[]}` per
  the topological-sort-within-cell rule. Each (phase, lane) cell:
  DAG of `input_logic` references → topo order left-to-right;
  branches stack vertically.
- [ ] C3.2 Layout constants (`COLUMN_WIDTH`, `ROW_HEIGHT`, gutters)
  in `layout/constants.ts`.
- [ ] C3.3 Empty-lane hiding: selector that filters
  `version.lanes` to lanes referenced by at least one block.
- [ ] C3.4 Unit tests: linear chain, decision fan-out, multi-lane
  interleave, empty lane hide.

### § C4 Dialog

- [ ] C4.1 `BlockDialog` shell with `add` / `edit` modes, "Voeg
  toe" / "Opslaan" submit, cancel.
- [ ] C4.2 Phase picker (select over `version.phases`, ordered by
  `ord`).
- [ ] C4.3 Lane picker: only when
  `allowed_lane_kind_codes.length > 1`. Single-kind blocks render
  a read-only line.
- [ ] C4.4 Per-kind CONFIG_SCHEMA form (reuse existing SchemaForm).
- [ ] C4.5 `input_logic` editor — typed rule composer over the
  already-placed blocks in this version. Reuses the predicate
  shapes from Part B.
- [ ] C4.6 `timing_policy` editor — tagged-union form, hidden for
  kinds whose validator forbids it (e.g. `StartBlock`,
  `EndPathwayBlock`).
- [ ] C4.7 Validation: surface backend 422 inline against the
  matching `field` path; keep the dialog open on error.

### § C5 Cascade-delete

- [ ] C5.1 Reducer action `delete-block-cascade` that drops the
  block and walks every other block's `input_logic.rules` to strip
  references to the deleted block.
- [ ] C5.2 Confirm dialog enumerates the dependent blocks by name.
- [ ] C5.3 Unit tests: no dependents → silent, with dependents →
  surfaces names, after delete the rules are gone.

### § C6 Backend rule-reference check

- [ ] C6.1 Add `validate_input_logic_node_references(blocks)` to
  `app/domain/pathway/blocks/validators.py`. Walks every block's
  `input_logic.rules` and asserts every `node` / `after_block`
  references a block in the same version. Raises
  `InputLogicNodeUnknownError(target_block, node_id, rule_index)`.
- [ ] C6.2 Wire into `PathwayVersionService._validate_publish_blocks`
  after the existing decision-output reference check.
- [ ] C6.3 Tests: dangling reference rejected; same-version
  reference accepted.

### § C7 Fixture cleanup

- [ ] C7.1 Update the demo Rugrevalidatie seed pathway to use all
  kinds the prototype renders (start + appointment + decision +
  end_pathway minimum; richer mix to taste).
- [ ] C7.2 Remove prebaked `pathway_block.x` / `y` values from
  fixtures that hand-placed blocks; the layout engine owns them
  now.

### § C8 Verify + ship

- [ ] C8.1 `/verify` backend + orchestrator.
- [ ] C8.2 Manual run through the prototype's golden path against
  the Rugrevalidatie seed: add a `TaskBlock` gated by the Start,
  edit it, delete it, observe the canvas re-derive.
- [ ] C8.3 Commit per `§`; PR against `feat/pathway-model-redesign`.

---

## Status snapshot

| Part | Sections | Done | Pending |
| --- | --- | --- | --- |
| A | A1-A8 | A1, A2 | A3-A8 |
| B | B1-B3 | — | B1, B2, B3 |
| C | C1-C8 | — | C1-C8 (blocked on Parts A + B) |
