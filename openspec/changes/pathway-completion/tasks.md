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

### § A3 `notification` — DROPPED

Decision: do NOT ship a separate `notification` kind; the existing
`MessageBlock` covers it (channel + subject + body + CTA). Builder
palette re-labels the `message` tile as "Notification / Bericht".

- [x] A3.1 Decide: own kind vs. extension of `MessageBlock`. →
  DROP, re-label.
- [ ] A3.2 Builder palette i18n: ensure the `message` tile reads
  "Notification" / "Bericht" in the catalogue projection's `label`
  surface (no schema change). Lands as part of Part C if it's
  not already.

### § A4 `treatment`

- [x] A4.1 `app/domain/pathway/blocks/treatment/typed.py` —
  `TreatmentBlock` with `title`, `location`, `duration_minutes`,
  `treatment_notes`. Lane: `(LANE_KIND_CAREGIVER,)`.
  `ICON="stethoscope"`.
- [x] A4.2 `TreatmentResult(BaseModel)` with `performed_at:
  datetime`, `notes: str | None`, `complications: str | None`. Set
  as `TreatmentBlock.RESULT_TYPE`.
- [x] A4.3 Register in `BLOCK_CLASSES`; add `"treatment"` to
  `BlockSemanticsLiteral`; add `TreatmentBlockIn/Out`.
- [x] A4.4 Migration: nullable per-kind columns
  (`treatment_title`, `treatment_location`,
  `treatment_duration_minutes`, `treatment_notes`).
- [x] A4.5 Mapper round-trip via existing
  `<KIND>_<field>` convention (no custom code needed). Publish-time
  validator inherits via `CONFIG_SCHEMA.required=["title"]`.
- [x] A4.6 Tests: catalogue projection, class smoke, RESULT_TYPE
  round-trip.
- [x] A4.7 `/verify`; commit.

### § A5 `subpath` — DROPPED, but `PathwayLinkBlock` business-logic gaps land here

Decision: re-use `PathwayLinkBlock`. Sub-tasks close the
`input_logic` / completion / timing gaps documented in the
Decisions log entry for A5.

- [x] A5.1 Decide own kind vs reuse. → REUSE pathway_link.
- [ ] A5.2 Completion signal: parent `PathwayLinkBlock`
  execution flips `pending|eligible|active → completed` when the
  nested enrollment's `state` becomes `completed`. Implement via
  `EnrollmentService.complete_execution` hook on nested
  enrollment finalisation.
- [ ] A5.3 Publish validator: reject
  `decision_output(pathway_link_block, …)` rules — `if_done` is
  the only allowed predicate against a `PathwayLinkBlock`.
- [ ] A5.4 `timing_policy`: ALLOWED on `PathwayLinkBlock` but
  treated as advisory hint for the parent scheduler. Document in
  the class docstring; no validator change.
- [ ] A5.5 `fire_and_forget` mode: confirm parent block completes
  on `eligible` transition (no nested enrollment wait). Add
  integration test if missing.
- [ ] A5.6 Tests: blocking-mode completion fires on nested
  finalisation; decision_output reference rejected; `fire_and_forget`
  bypass.
- [ ] A5.7 Builder palette i18n: tile reads
  "Subpath / Sub-flow" (label only, no schema change).
- [ ] A5.8 `/verify`; commit.

### § A6 `bridge` — DEFERRED out of PoC

Decision: out of PoC. Park in `backlog.md` as `[mvp]`.

- [x] A6.1 Decide: PoC scope vs defer. → DEFER to MVP.
- [ ] A6.2 Add `BL-NNN` entry to `openspec/backlog.md`:
  "Cross-pathway handoff (`bridge` block) — terminal kind that
  closes current enrollment + opens a new one for the patient on
  a target pathway. Source: urology demo flow
  (`pathway-model-redesign/example-flow-urology.md`). Touches
  enrollment-lifecycle + identity carry-over. Re-evaluate at MVP."
  Tier: `[mvp]`.

### § A7 `mdo` — depends on § B3 (event)

(B3 event plumbing is needed for the `contributed` event endpoint;
B2 n_of_m dependency was removed — see Decisions log.)

- [ ] A7.1 `app/domain/pathway/blocks/mdo/typed.py` — `MdoBlock`
  with `topic: str`, `expected_attendees_note: str | None`. Lane:
  `(LANE_KIND_CAREGIVER,)`. `EVENTS = ("contributed",)`.
  `ICON="users"`.
- [ ] A7.2 `MdoResult(BaseModel)` with `contributors: list[UUID]`,
  `notes: str`, `closed_at: datetime`. Set as `RESULT_TYPE`.
- [ ] A7.3 Register in `BLOCK_CLASSES`; add `"mdo"` to
  `BlockSemanticsLiteral`; add `MdoBlockIn/Out`.
- [ ] A7.4 Migration: `mdo_topic` (TEXT) +
  `mdo_expected_attendees_note` (TEXT, nullable) on `pathway_block`.
- [ ] A7.5 Wire `contributed` event handler:
  `record_event(execution_id, "contributed", payload={caregiver_id})`
  appends to `result_json.contributors` (de-duped) without firing
  state transitions.
- [ ] A7.6 Publish validator: `topic` non-empty.
- [ ] A7.7 Tests: contribution events accumulate; leading
  caregiver completes; topic-empty rejection; non-caregiver lane
  rejection.
- [ ] A7.8 `/verify`; commit.

### § A8 `informed_consent` — depends on § B1 (re-eval tick)

(B1 `if_not_done_within` ships the re-evaluation tick scheduler
that the reminder + expiry ticks reuse. B3 dependency was removed
— see Decisions log.)

- [ ] A8.1 `app/domain/pathway/blocks/informed_consent/typed.py` —
  `InformedConsentBlock` with `questions: list[FormQuestion]`,
  `reminder_offset_iso: str = "P3D"`, `reminder_max: int = 3`,
  `expires_at_iso: str | None = None`. Lane:
  `(LANE_KIND_PATIENT,)`. `ICON="signature"`.
- [ ] A8.2 `InformedConsentResult(BaseModel)` with
  `consented: bool`, `expired: bool`, `signed_at: datetime | None`,
  `responses: dict[str, Any] | None`. `consented` + `expired`
  mutually exclusive. Set as `RESULT_TYPE`.
- [ ] A8.3 Register in `BLOCK_CLASSES`; add `"informed_consent"`
  to `BlockSemanticsLiteral`; add `InformedConsentBlockIn/Out`.
- [ ] A8.4 Migration: nullable per-kind columns
  (`informed_consent_questions`,
  `informed_consent_reminder_offset_iso`,
  `informed_consent_reminder_max`,
  `informed_consent_expires_at_iso`).
- [ ] A8.5 Runtime:
  (a) On `eligible`, fire a `MessageBlock`-equivalent notification
      (email + push) to the patient.
  (b) Reminder scheduler tick (reuses §B1 plumbing): every
      `reminder_offset_iso`, re-send notification + increment
      `reminders_sent` until cap.
  (c) Expiry tick: when `expires_at_iso` elapses and state is
      still `eligible|active`, engine auto-completes with
      `result={consented: false, expired: true, signed_at: null,
      responses: null}`. **No new terminal state.**
- [ ] A8.6 Publish validator: `questions` non-empty; `reminder_max`
  ∈ [0, 10]; `expires_at_iso` parseable as ISO 8601 duration when
  set; lane MUST be `patient` (enforced by `allowed_lane_kinds`,
  re-checked at publish).
- [ ] A8.7 Tests: catalogue projection, validator branches,
  completion on consent (consented=true), expiry transition
  (consented=false, expired=true), reminder cap respected,
  notification send on eligible.
- [ ] A8.8 `/verify`; commit.

---

## Part B — Predicate catalogue completion

Three additions to the `input_logic` rule set.

### § B1 `if_not_done_within(after_block, offset_iso)`

- [ ] B1.1 `PredicateKind.IF_NOT_DONE_WITHIN` enum entry.
- [ ] B1.2 `IfNotDoneWithinArgs(_ArgsBase)` Pydantic model with
  `after_block: UUID`, `offset_iso: str` (ISO 8601 duration).
- [ ] B1.3 Evaluator branch in `input_logic/evaluator.py`. Returns
  `True` when the referenced block's execution is NOT in
  `state in {completed, skipped}` AND now ≥
  `block.eligible_at + parse_iso_duration(offset_iso)`.
- [ ] B1.4 Engine: schedules a re-evaluation tick at the SLA
  deadline so the block becomes `eligible` automatically when the
  predicate flips. **This tick scheduler is also reused by §A8
  reminder + expiry ticks** — implement once, share.
- [ ] B1.5 Publish gate: `after_block` must reference a real
  block in the same version; `offset_iso` parses as ISO 8601
  duration (reuse the existing parser from `TimingPolicy`).
- [ ] B1.6 Tests: not-yet-expired → false; expired + still
  pending → true; expired + already completed → false;
  cross-block ref rejection; invalid ISO string rejection.
- [ ] B1.7 `/verify`; commit.

### § B2 `aggregator_n_of_m(count, total)` — DEFERRED out of PoC

Decision: no PoC consumer (MDO no longer needs it; other PoC flows
use `all_of`). Parked in `backlog.md` as `[mvp]`.

- [x] B2.1 Decide: ship vs defer. → DEFER to MVP.
- [ ] B2.2 Add `BL-NNN` entry to `openspec/backlog.md`:
  "`aggregator_n_of_m(count, total)` predicate — partial-completion
  aggregator for `InputLogic.rules`. Originally scoped for MDO
  attendees; MDO redesign (A7 in `pathway-completion`) replaced
  the gate with leading-caregiver-completes. Future MVP flows
  needing 'N of M upstream gates' will promote this back."
  Tier: `[mvp]`.

### § B3 `event(after_block, event_type)`

- [ ] B3.1 `PredicateKind.EVENT` enum entry.
- [ ] B3.2 `EventArgs(_ArgsBase)` with `after_block`, `event_type`.
- [ ] B3.3 `EnrollmentService.record_event(execution_id,
  event_type, payload)` + POST `/enrollments/{id}/events` endpoint.
  Auth: **caregiver-in-care-team only** for PoC (reuse existing
  Keto care-team scoping). Patient + external systems 401/403 —
  promoted at MVP.
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

| Part | Sections | Done / Decided | Pending implementation |
| --- | --- | --- | --- |
| A | A1-A8 | A1 ✓, A2 ✓, A3 DROPPED, A4 ✓, A6 DEFERRED, A5/A7/A8 designs locked | A5, A7 (needs B3), A8 (needs B1) |
| B | B1-B3 | B2 DEFERRED, B1/B3 designs locked | B1, B3 |
| C | C1-C8 | designs locked | C1-C8 (blocked on A + B) |

## Cross-Part dependencies (after Round-1 decisions)

- A7 `mdo` depends on **B3** `event` (`contributed` endpoint).
- A8 `informed_consent` depends on **B1** re-evaluation tick
  scheduler (reused for reminder + expiry ticks).
- A1, A2 already shipped; A3 (DROP), A6 (DEFER), B2 (DEFER) skip
  implementation entirely.

**Execution order (locked):**
**A4 → A5 → B1 → A8 → B3 → A7 → Part C.**

Rationale: ship block kinds with no predicate dependency first (A4,
A5) so the typed envelope + mapper plumbing gets exercised end-to-end
before predicates need it. Then predicates land in the order their
consumers come (B1 before A8; B3 before A7). Part C builder UX is
last, on top of a frozen catalogue.
