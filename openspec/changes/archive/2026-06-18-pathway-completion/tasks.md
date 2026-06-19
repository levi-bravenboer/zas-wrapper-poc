# Tasks — pathway-completion

Worked top-down. Parts execute strictly in order: **A → B → C**.
Within a Part, sections execute in §-order. Scope split: **this PR**
ships template + builder-config (classes, schemas, migrations,
publish gates, pure evaluators); the follow-up
**"pathway-nested-runtime" PR** ships runtime hooks (nested
enrollment spawn, event store + endpoint, tick scheduler,
notification sends). Per-§ split is marked inline.

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
- [x] A3.2 Palette label: `MessageBlock.LABEL = "Bericht"` already
  IS the NL notification term; DESCRIPTION clarified to
  "message/notification". No schema change.

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

### § A5 `subpath` — DROPPED, reuse `PathwayLinkBlock`

Decision: re-use `PathwayLinkBlock`. Sub-tasks close the
`input_logic` / completion / timing gaps documented in the
Decisions log entry for A5.

**This PR — template + builder-config only:**

- [x] A5.1 Decide own kind vs reuse. → REUSE pathway_link.
- [x] A5.3 Publish validator: reject
  `decision_output(pathway_link_block, …)` rules. **Already
  covered** by existing `validate_decision_output_references`
  which rejects "producer is a {type}, not a DecisionBlock"
  — explicit confirmation test lands here.
- [x] A5.4 `timing_policy`: ALLOWED on `PathwayLinkBlock` but
  treated as advisory hint. Documented in class docstring; no
  validator change.
- [x] A5.7 Builder palette i18n: tile reads
  "Subpath" (`LABEL` ClassVar override; ICON → `git-merge`).
- [x] A5.6a Tests: decision_output reference against pathway_link
  rejected; decision_output against actual DecisionBlock accepted.
- [x] A5.8 `/verify` backend + orchestrator; commit.

**Deferred to follow-up "pathway-nested-runtime" PR:**

- [ ] A5.2 Completion signal — parent `PathwayLinkBlock`
  execution flips on nested enrollment finalisation. Needs new
  `pathway_enrollment.parent_block_execution_id` column +
  `EnrollmentService.create_nested_enrollment` +
  cascade-up complete hook.
- [ ] A5.5 `fire_and_forget` mode runtime — parent completes on
  `eligible`, nested enrollment spawned async. Needs the same
  nested-spawn machinery as A5.2.
- [ ] A5.6b Integration tests: blocking completes on nested
  finalisation; fire_and_forget bypass.

### § A6 `bridge` — DEFERRED out of PoC

Decision: out of PoC. Park in `backlog.md` as `[mvp]`.

- [x] A6.1 Decide: PoC scope vs defer. → DEFER to MVP.
- [x] A6.2 Backlog entry added: **BL-082** in `openspec/backlog.md`
  (cross-pathway handoff `bridge` block, tier `[mvp]`).

### § A7 `mdo`

**This PR — template only:**

- [x] A7.1 `app/domain/pathway/blocks/mdo/typed.py` — `MdoBlock`
  with `topic: str`, `expected_attendees_note: str | None`. Lane:
  `(LANE_KIND_CAREGIVER,)`. `EVENTS = ("contributed",)`.
  `ICON="users"`.
- [x] A7.2 `MdoResult` with `contributors: list[UUID]`,
  `notes: str`, `closed_at: datetime`. Set as `RESULT_TYPE`.
- [x] A7.3 Registered in `BLOCK_CLASSES`; `"mdo"` in
  `BlockSemanticsLiteral`; `MdoBlockIn/Out` unions.
- [x] A7.4 Migration `m4d0b1l0ckk1`: `mdo_topic` +
  `mdo_expected_attendees_note`.
- [x] A7.6 Publish validator: `topic` required via CONFIG_SCHEMA +
  Pydantic; lane via `allowed_lane_kinds`. Event-type gate (`event`
  rules against `MdoBlock.EVENTS`) covered by §B3
  `validate_event_rules`.
- [x] A7.7a Tests: class shape, RESULT_TYPE round-trip, topic
  rejection, catalogue expected-set updates.
- [x] A7.8 `/verify`; commit. Frontend: `MdoConfig` Zod schema +
  type coverage in lockstep.

**Deferred to follow-up "pathway-nested-runtime" PR:**

- [ ] A7.5 Wire `contributed` event handler:
  `record_event(execution_id, "contributed", payload={caregiver_id})`
  appends to `result_json.contributors` (de-duped) without firing
  state transitions. Depends on B3 record_event endpoint (also
  deferred).
- [ ] A7.7b Integration tests: contribution events accumulate;
  leading caregiver completes.

### § A8 `informed_consent`

**This PR — template only:**

- [x] A8.1 `app/domain/pathway/blocks/informed_consent/typed.py` —
  `InformedConsentBlock` with `questions: list[FormQuestion]`
  (default: single yes/no "Ik geef toestemming"),
  `channels` (default `["email", "push"]`, minLength 1),
  `reminder_offset_iso: str = "P3D"`,
  `reminder_max: int = 3` (range [0, 10]),
  `expires_at_iso: str | None = None`. Lane:
  `(LANE_KIND_PATIENT,)`. `ICON="signature"`.
- [x] A8.2 `InformedConsentResult` with mutual-exclusion
  model_validator on `consented` + `expired`. Set as `RESULT_TYPE`.
- [x] A8.3 Registered in `BLOCK_CLASSES`; `"informed_consent"` in
  `BlockSemanticsLiteral`; `InformedConsentBlockIn/Out` unions.
- [x] A8.4 Migration `c0n5e4t8b1ck`: 5 nullable per-kind columns.
- [x] A8.6 Publish validator
  (`validate_informed_consent_invariants`): timing_policy
  forbidden; reminder/expiry ISO durations parse. Field-level
  constraints (questions/channels non-empty, reminder_max range)
  live on the Pydantic model. Wired into publish gate.
- [x] A8.7a Tests: defaults, timing rejection, invalid ISO
  rejections, valid expiry pass, RESULT_TYPE mutual exclusion,
  empty channels rejection, reminder_max range rejection,
  catalogue projection (expected-set updates).
- [x] A8.8 `/verify`; commit. Frontend: `InformedConsentConfig`
  Zod schema + type coverage updated in lockstep.

**Deferred to follow-up "pathway-nested-runtime" PR:**

- [ ] A8.5 Runtime:
  (a) On `eligible`, fire a `MessageBlock`-equivalent notification
      across each channel to the patient.
  (b) Reminder scheduler tick: every `reminder_offset_iso`,
      re-send notification + increment `reminders_sent` until
      cap.
  (c) Expiry tick: when `expires_at_iso` elapses and state is
      still `eligible|active`, engine auto-completes with
      `result={consented: false, expired: true, signed_at: null,
      responses: null}`.
- [ ] A8.7b Integration tests: completion on consent
  (consented=true), expiry transition (consented=false,
  expired=true), reminder cap respected, notification send on
  eligible.

---

## Part B — Predicate catalogue completion

Three additions to the `input_logic` rule set.

### § B1 `if_not_done_within(after_block, offset_iso)`

**This PR — template + evaluator (pure function):**

- [x] B1.1 `PredicateKind.IF_NOT_DONE_WITHIN` enum entry.
- [x] B1.2 `IfNotDoneWithinArgs(_ArgsBase)` Pydantic model with
  `after_block: UUID`, `offset_iso: str` (ISO 8601 duration).
- [x] B1.3 Evaluator branch in `input_logic/evaluator.py`.
  `BlockExecutionView` grew `terminal` + `sla_anchor_at`;
  `PredicateContext` grew `now`. True when NOT terminal AND
  `now >= sla_anchor_at + parse_iso_duration_timedelta(offset_iso)`.
  New `parse_iso_duration_timedelta` in `runtime/scheduling.py`
  supports sub-day windows (`PT4H`). Engine `_build_context` maps
  `scheduled_at` → `sla_anchor_at` and threads `now` through
  `evaluate_eligibility` / `complete`.
- [x] B1.5 Publish gate: `validate_if_not_done_within_rules` —
  same-version reference + parseable ISO duration; wired into
  `PathwayVersionService` publish gate as `BlockConfigError`.
- [x] B1.6 Tests: not-yet-expired → false; expired + still
  pending → true; expired + completed/skipped → false; missing
  clock/anchor → false; sub-day window; invalid ISO → false at
  eval, rejected at publish; cross-block ref rejection;
  round-trip serialisation.
- [x] B1.7 `/verify`; commit.

**Deferred to follow-up "pathway-nested-runtime" PR:**

- [ ] B1.4 Engine: schedules a re-evaluation tick at the SLA
  deadline so the block becomes `eligible` automatically when the
  predicate flips. Also reused by §A8 reminder + expiry ticks.

### § B2 `aggregator_n_of_m(count, total)` — DEFERRED out of PoC

Decision: no PoC consumer (MDO no longer needs it; other PoC flows
use `all_of`). Parked in `backlog.md` as `[mvp]`.

- [x] B2.1 Decide: ship vs defer. → DEFER to MVP.
- [x] B2.2 Backlog entry added: **BL-083** in `openspec/backlog.md`
  (`aggregator_n_of_m` predicate, tier `[mvp]`).

### § B3 `event(after_block, event_type)`

**This PR — template + publish gate:**

- [x] B3.1 `PredicateKind.EVENT` enum entry.
- [x] B3.2 `EventArgs(_ArgsBase)` with `after_block`, `event_type`.
- [x] B3.5 Publish gate: `validate_event_rules` — `event_type` must
  be in `type(producer).EVENTS` + same-version ref check. Wired
  into publish gate as `BlockConfigError`.
- [x] B3.6a Tests: declared event_type passes; undeclared
  rejected; unknown ref rejected. Evaluator branch tests:
  matches `produced["events"]` mirror shape (the contract the
  §B3.4 event store will hydrate); false without match / missing
  block; round-trip serialisation.
- [x] B3.7 `/verify`; commit.

**Deferred to follow-up "pathway-nested-runtime" PR:**

- [ ] B3.3 `EnrollmentService.record_event(execution_id,
  event_type, payload)` + POST `/enrollments/{id}/events` endpoint.
  Auth: caregiver-in-care-team only for PoC (reuse Keto
  care-team scoping).
- [ ] B3.4 Evaluator: rule true once the matching event has been
  recorded for the referenced execution. Needs an event store
  (table or in-memory + outbox). Out of template scope.
- [ ] B3.6b Integration tests: known event_type + matching record
  promotes downstream block.

---

## Part C — Builder dialog flow

Replace the drag-canvas with a dialog-driven flow on top of the
frozen catalogue + predicate set. PRE-REQUISITE: Parts A + B
complete.

### § C1 HTML prototypes

- [x] C1.1 `prototypes/builder-dialog/v1.html` — canvas with phases
  × lanes grid, palette at bottom, click-to-open block dialog,
  hover-X delete affordance. Mock data for the Rugrevalidatie
  pathway. User feedback: concept approved; final styling must
  match the current builder look.
- [ ] C1.2 Iterate vN.html with the user if needed. Each iteration
  creates a new `vN.html`; earlier versions stay as history.
  (Optional — concept already approved on v1.)

### § C2 Frontend scaffolding

- [x] C2.1 Components land in the existing `pathway/components/`
  tree (no new `builder/` package — follows current layout):
  `dialog/BlockDialog.tsx`, `dialog/InputLogicEditor.tsx`,
  `drawer/InspectorSwitch.tsx` (extracted + extended),
  `layout/computeBlockLayout.ts`.
- [x] C2.2 Drag-and-drop stripped: `nodesDraggable/Connectable`
  off, drop/connect/move handlers removed, dock is click-only,
  `useDragContext` + `dragGhost` deleted. Canvas renders the
  computed layout + hides empty lanes.
- [x] C2.3 Dock click → `BlockDialog` "add" mode (draft-based;
  block exists only after "Voeg toe").
- [x] C2.4 Block click → `BlockDialog` "edit" mode, hydrated from
  the typed envelope; "Opslaan" applies the whole draft (name,
  phase, lane, config, input_logic) in one patch.
  `BuilderDrawer` (sidebar inspector) deleted.
- [x] C2.5 Hover X icon on block nodes → `ConfirmDeleteBlockDialog`
  listing dependents → confirm dispatches the cascading
  `delete-block`. Edit-dialog delete routes through the same
  confirm.

### § C3 Layout engine

- [x] C3.1 `layout/computeBlockLayout.ts` — pure function returning
  `Map<blockId, {x, y}>`. Per (phase, lane) cell: Kahn topo pass
  over rule-level `node` references → column; per-column row
  stacking (branch fan-out vertical); cross-cell upstreams ignored
  for columns; cycle remainder lands in a trailing column (never
  dropped).
- [x] C3.2 Layout constants in `layout/constants.ts`
  (column/row gutters + cell padding); block dimensions reuse
  `canvasLayout.BLOCK_WIDTH/HEIGHT`.
- [x] C3.3 `visibleLanes(lanes, blocks)` — canvas-only filter; the
  dialog lane picker keeps the full lane list.
- [x] C3.4 Unit tests (9): linear chain, decision fan-out, fan-in
  join, multi-lane interleave, cycle fallback, independent cells,
  lane hiding ×3.

### § C4 Dialog

- [x] C4.1 `BlockDialog` shell with `add` / `edit` modes, "Voeg
  toe" / "Opslaan" submit, cancel, delete (edit mode).
- [x] C4.2 Phase picker (select over `version.phases`, sorted by
  `ord`).
- [x] C4.3 Lane: NO field in the dialog (user decision
  2026-06-12) — the lane is derived from the kind's
  `allowed_lane_kinds`; first allowed lane wins for multi-kind
  blocks. Edit mode keeps the block's existing lane.
- [x] C4.4 Per-kind config form via extracted `InspectorSwitch` —
  reuses all existing inspectors + new Treatment / Mdo /
  InformedConsent inspectors; `start` / `end_pathway` render a
  "no settings" note.
- [x] C4.5 `input_logic` editor (`InputLogicEditor`) — typed rule
  composer over already-placed blocks: if_done / decision_output /
  if_not_done_within / event + aggregator (all_of / any_of).
  Non-composer rules (wait_after markers) render read-only.
  Hidden for `start` (input_logic forbidden).
- [x] C4.6 `timing_policy` editor (`TimingPolicyEditor`) —
  tagged-union form (geen / fixed_duration / wait_after /
  due_within / at_enrollment_picked_date + ISO veld). Hidden for
  `start` / `end_pathway` / `informed_consent` (publish gate
  forbids timing there).
- [x] C4.7 Validation: draft-side Zod parse gates submit;
  `replacePathway` parses 422 `details.{field, reason}` and the
  autosave failure toast names the offending field path. Full
  in-dialog inline mapping deliberately NOT built — saves are
  debounced + optimistic (dialog closes before the PUT resolves);
  synchronous submit-saves is a UX decision parked for the
  nested-runtime PR.

### § C5 Cascade-delete

- [x] C5.1 Cascade lives in the existing `delete-block` reducer case
  (no separate action — every delete cascades):
  `cascadeDeleteBlock(version, blockId)` strips dependent
  `input_logic.rules`, drops the block's `branches[]`, drops
  derived edges. Exported for tests; `dependentBlocks()` feeds the
  confirm dialog.
- [x] C5.2 `ConfirmDeleteBlockDialog` enumerates dependents by name
  + icon; copy switches to "Verwijderen + opschonen" when
  dependents exist.
- [x] C5.3 Unit tests (8): dependents listing, self-reference
  exclusion, rule stripping, untouched-reference identity,
  branch + edge cleanup.

### § C6 Backend rule-reference check

- [x] C6.1 `validate_input_logic_node_references(blocks)` in
  `validators.py`. Walks every rule's `node`; `wait_after` exempt
  (references a marker, not a block). Raises
  `InputLogicNodeUnknownError(target_block, node_id, rule_index)`.
- [x] C6.2 Wired into `PathwayVersionService._validate_publish_blocks`
  as `BlockConfigError(blocks[<id>].input_logic.rules[i].node)`.
- [x] C6.3 Tests: dangling reference rejected; same-version
  accepted; wait_after marker rule skipped.

### § C7 Fixture cleanup

- [x] C7.1 Rugrevalidatie seed covers start + appointment +
  treatment (Operatie upgraded from milestone) + wait + decision +
  milestone + end_pathway.
- [x] C7.2 Authored `x` / `y` in fixtures are now harmless
  placeholders — the § C3 layout pass ignores them on render.
  Left in place (the wire shape still carries them).

### § C8 Verify + ship

- [x] C8.1 `/verify` backend (820 passed) + orchestrator
  (522 passed, lint clean apart from pre-existing ts-nocheck).
  Caught + fixed: treatment `notes` field double-prefix column bug
  surfaced by the seed-all script test.
- [x] C8.2 Manual run through the golden path against the
  Rugrevalidatie seed: add a `TaskBlock` gated by the Start, edit
  it, delete it, observe the canvas re-derive. Smoke run
  2026-06-14: add → autosave PUT 200, edit → save PUT 200, delete
  → cascade confirm → PUT 200, canvas re-derives via Kahn pass.
  Round 1 surfaced two blockers in the dirty configSchemas work
  (Zod parse rejected `null` on optional per-kind fields, and the
  autosave payload echoed those `null`s back to a strict BE
  CONFIG_SCHEMA). Fixed in this commit: `.nullable().optional()`
  added across Appointment/Task/Milestone/Form/Treatment/Message/
  Decision/Wait/PathwayLink/ExternalProgram/Start/EndPathway/
  Mdo/InformedConsent configs; `stripNullEntries` added to
  `useAutosavePathway.buildPayload` so the PUT never echoes
  `null` per-kind columns; round-trip tests added.
- [x] C8.3 Committed per `§` on `feat/pathway-model-redesign`.

---

## Status snapshot

| Part | Sections | Done / Decided | Pending (this PR) | Deferred (next PR) |
| --- | --- | --- | --- | --- |
| A | A1-A8 | ALL template work ✓ (A1, A2, A3 drop, A4, A5, A6 defer BL-082, A7, A8) | — | A5.2/A5.5, A7.5, A8.5 runtime |
| B | B1-B3 | B1 ✓, B2 ✓ (defer, BL-083), B3 ✓ | — | B1.4 tick, B3.3/B3.4 endpoint+store |
| C | C1-C8 | designs locked, v1.html prototype done (C1.1) | C2-C8 — **UNBLOCKED**, catalogue + predicates frozen | — |

## Cross-Part dependencies

**Within this PR (template scope) there are NO cross-Part
dependencies** — every § ships classes, schemas, migrations,
publish gates, and pure evaluators independently.

The runtime-level dependencies (A7.5 needs B3.3 endpoint; A8.5
needs B1.4 tick scheduler) move with their tasks to the follow-up
"pathway-nested-runtime" PR.

**Execution order this PR (locked):**
**A4 ✓ → A5 ✓ → B1 → A8 → B3 → A7 → Part C.**

Rationale: block kinds with no predicate dependency first so the
typed envelope + mapper plumbing gets exercised end-to-end. Then
predicates in consumer order. Part C builder UX last, on top of a
frozen catalogue.
