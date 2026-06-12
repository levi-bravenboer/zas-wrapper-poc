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
| A3 | `notification` | — | — | **DROPPED** — `MessageBlock` (slot #1) already exposes channel + subject + body + CTA. Urology-spec "notification" rebrands as a label for `message` |
| A4 | `treatment` | `TreatmentBlock` | `caregiver` | ✓ shipped (template). CONFIG: `title`, `location`, `duration_minutes`, `treatment_notes`. RESULT: `{performed_at, notes, complications}` |
| A5 | `subpath` | — | — | ✓ template shipped — bestaande `PathwayLinkBlock` (slot #1) dekt subpath; label → "Subpath", decision_output-reject getest, timing advisory gedocumenteerd. Runtime completion (nested enrollment) → volgende PR |
| A6 | `bridge` | — | — | **DEFERRED out of PoC** — cross-pathway handoff niet nodig voor demo. Geparkeerd als **BL-072** `[mvp]` |
| A7 | `mdo` | `MdoBlock` | `caregiver` | pending (template this PR). CONFIG: `topic`, `expected_attendees_note` (free-text). RUNTIME (volgende PR): leading caregiver completes; extra contributions via `contributed` events. **Geen `aggregator_n_of_m` afhankelijkheid** |
| A8 | `informed_consent` | `InformedConsentBlock` | `patient` | pending (template this PR). RESULT: `{consented, expired, signed_at, responses}`. Expiry → `state=completed` met `expired=true` — geen nieuwe terminal state. Runtime sends/ticks → volgende PR |

Per-kind decisions (cardinality, columns, validators, runtime
semantic, lane-kind invariant) live in the **Decisions log** section
below — one entry per kind, added as that section's tasks land.

### Part B — Predicate catalogue completion

Three additions to the `input_logic` rule set so the urology demo
flow can be expressed end-to-end:

- **`if_not_done_within(after_block, offset_iso)`** — SLA / timeout.
  Block becomes `eligible` only after the referenced block's
  eligibility moment + `offset_iso` (ISO 8601 duration, e.g.
  `"P14D"` or `"PT4H"`) has elapsed AND the referenced block is
  still NOT in a terminal state. ISO 8601 chosen for consistency
  with `TimingPolicy` — one duration grammar across the model.
- ~~**`aggregator_n_of_m(count, total)`**~~ — **DEFERRED out of
  PoC.** Originally for MDO ("≥ N of M attendees") but A7 now
  completes via leading caregiver direct, with no n_of_m gate.
  No other PoC flow uses it. Parked in `backlog.md` as `[mvp]`.
- **`event(after_block, event_type)`** — in-execution event
  predicate. Engine receives events through
  `EnrollmentService.record_event(execution_id, event_type, payload)`
  (new POST `/enrollments/{id}/events`) and re-runs eligibility.
  Per-kind `EVENTS` catalogue is declared **per kind as it lands**:
  e.g. `MdoBlock.EVENTS=("contributed",)` lands in §A7. Other
  kinds keep `EVENTS=()` until a real use case promotes them. The
  publish gate rejects `event(node, event_type)` rules whose
  `event_type` is not in `type(node).EVENTS`, so no kind is
  silently usable as an event source without an explicit
  declaration.

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
- `DecisionBlock` dialog: per-kind config only declares the
  `outputs` list (e.g. `["yes", "no"]`). It does NOT name
  downstream blocks. Downstream wiring lives in each downstream
  block's `input_logic.rules` via the `decision_output(decision_id,
  output_key)` predicate. Single source of truth = the typed
  envelope on the downstream block. The canvas draws the visual
  branch from the derived edges.
- Lane is derived from the kind's `allowed_lane_kinds` — picker
  only when more than one kind is allowed.
- Block (x, y) is computed by a topological-sort layout pass over
  `input_logic`. Edges are drawn from the `DerivedEdge[]`
  projection the server already returns.
- Click existing block → same dialog opens in edit mode.
- Hover block → X icon → confirm dialog ("Volgende blokken
  verwijzen er nog naar: …") → on confirm, cascade-cleanup strips
  `input_logic.rules` references on every dependent.
- Cascade-delete scope: **concept version template only.** Published
  versions are immutable. Active runtime enrollments draw from
  their published version snapshot and are never mutated by builder
  edits. The cascade walks: (a) other blocks in the same concept
  version → strip `input_logic.rules` entries whose `node` /
  `after_block` matches the deleted block; (b) `branches[]` whose
  `block_id` matches the deleted block (`DecisionBlock` outputs are
  template-level; if the deleted block IS a decision, its branches
  are removed too).
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

### A3 `notification` — DROPPED

Decision: do NOT ship a separate `notification` kind. The existing
`MessageBlock` (slot #1) already carries `channel` (email | sms |
push | in_app), `subject`, `body`, `cta_label`, `cta_target` on a
`patient` lane. The urology-flow "notification" entries are
satisfied verbatim by `MessageBlock`. Builder UI re-labels the
`message` palette tile as "Notification / Bericht" — no schema
change.

#### Reminders on a plain `MessageBlock` — compositional

`MessageBlock` is **fire-and-forget**: it sends one message and
completes. It does NOT carry reminder fields. When an author
wants reminders ("nog niet gereageerd na 3 dagen → stuur
herinnering"), they compose multiple `MessageBlock`s wired
through `timing_policy` (`WaitAfterPolicy`) and `input_logic`
gates. Visual cost is higher (N reminders = N blocks on the
canvas) but the data model stays clean — every block is one
action.

Why is `informed_consent` an exception? Its reminder fields are
ingebouwd omdat the block has a natural completion gate (patient
signs). Reminders stop automatically as soon as `consented=true`.
A compositional version would require every author to wire
`if_not_done_within(consent_block, "P3D")` gates on three extra
`MessageBlock`s — error-prone for a recurring pattern. The
inline fields are the documented escape hatch for exactly this
pattern (action + reminders + completion gate). Other
specialised "needs completion + reminders" blocks may add the
same fields case-by-case; the default for arbitrary messaging
stays compositional.

### A4 `treatment` — design locked

- Wire `kind`: `treatment`. Own class `TreatmentBlock`.
- Cardinality: 0..N per pathway version.
- Lane: `caregiver` (single allowed kind).
- Per-kind columns (`treatment_*` prefix on `pathway_block`):
  `treatment_title` (TEXT, required), `treatment_location` (TEXT,
  nullable), `treatment_duration_minutes` (INT, nullable).
- `treatment_notes` is authored at template level as a description
  / SOP free-text field (TEXT, nullable).
- Input logic: ALLOWED. Timing policy: ALLOWED
  (`FixedDurationPolicy` typically).
- Result schema (returned at completion):
  `{ performed_at: datetime, notes: str | None, complications: str | None }`.
  `RESULT_TYPE = TreatmentResult` Pydantic model.
- Runtime: standard `pending → eligible → active → completed`
  lifecycle. No special transitions.
- Validator: `treatment_title` non-empty on publish.
- Distinguishes from `AppointmentBlock` by carrying the typed
  result (appointment has no `RESULT_TYPE`) and by surfacing
  `treatment_notes` as a SOP authoring field on the dialog.

### A5 `subpath` — DROPPED + open business-logic items

Decision: do NOT ship a separate `subpath` kind. The existing
`PathwayLinkBlock` (slot #1) already carries `target_pathway_id`,
`mode` (blocking / fire_and_forget), `version_pin`, `pinned_version_id`,
`context_mapping`. The block + builder UX for nested pathways
already work end-to-end. Builder palette tile re-labels as
"Subpath / Sub-flow" if the urology naming is preferred — no
schema change.

Still open (lands as A5 sub-tasks before A5 closes):

1. **Completion semantic** when `mode=blocking`. Today the
   parent's `PathwayLinkBlock` execution does not transition to
   `completed` until something signals it. Decide: completes when
   every nested `EndPathwayBlock` fires, OR when the nested
   enrollment flips to `state=completed` (cleaner, single signal).
2. **`input_logic` rules referencing a `PathwayLinkBlock`**:
   `if_done(pathway_link)` means "nested enrollment completed".
   `decision_output(pathway_link, output_key)` — does this make
   sense? Subpaths don't have authored outputs today. Decision:
   only `if_done` allowed against a `PathwayLinkBlock`; rejects
   `decision_output` references at publish time.
3. **`timing_policy`**: should a `PathwayLinkBlock` carry a
   `FixedDurationPolicy` (expected sub-flow duration for parent
   scheduling)? Decision: ALLOWED but optional. The parent reads
   it as a hint only; actual scheduling follows the nested
   enrollment's own timing.
4. **`fire_and_forget` mode**: parent block completes immediately
   on transition to `eligible` (no wait for the nested enrollment).
   Already wired in slot #2. Confirm in tests.

### A6 `bridge` — DEFERRED out of PoC

Decision: cross-pathway handoff (urology "Cancer treatment
pathway" bridge) is out of PoC scope. Demo doesn't need it; modeling
it touches enrollment lifecycle + identity carry-over to a new
enrollment, which is non-trivial.

Action: add a `BL-NNN` entry to `openspec/backlog.md` tagged
`[mvp]` with the urology-flow source so MVP picks it up. Builder
palette does NOT surface a "bridge" tile for PoC.

### A7 `mdo` — design locked

- Wire `kind`: `mdo`. Own class `MdoBlock`.
- Cardinality: 0..N per pathway version.
- Lane: `caregiver` (single allowed kind).
- Attendees model: exactly **1 leading caregiver** + **unlimited
  extra** caregivers. Leading is the responsible chair; extras
  contribute optionally.
- Per-kind columns:
  `mdo_topic` (TEXT, required) — what the MDO is about.
  `mdo_expected_attendees_note` (TEXT, nullable) — free-text guidance
  for the leading caregiver on who to invite (e.g. "oncoloog +
  radioloog"). Not validated; advisory only.
- `leading_caregiver_id` is NOT a template field. It binds at
  runtime: defaults to `enrollment.assigned_caregiver_id`,
  overridable via a future "reassign MDO leader" action (out of
  PoC).
- Input logic: ALLOWED. Timing policy: ALLOWED.
- Result schema: `{ contributors: list[UUID], notes: str, closed_at:
  datetime }` — `contributors` is the de-duped list of caregivers
  who fired the `contributed` event (always includes the leading
  caregiver who closes).
- Class declares `EVENTS = ("contributed",)`. A caregiver firing
  `record_event(execution_id, "contributed", payload={caregiver_id})`
  appends to `result_json.contributors` without completing the
  block. (Uses §B3 `event` predicate plumbing for the receive
  endpoint only; no `event` rule needed inside the block.)
- Completion: leading caregiver calls
  `complete_execution(result={ contributors, notes, closed_at })`.
  Standard `active → completed` transition. No `n_of_m` gate
  required.
- Validator: `mdo_topic` non-empty on publish.
- **No dependency on §B2 (`aggregator_n_of_m`).** Removed from the
  cross-Part dependency list.

### A8 `informed_consent` — design locked

- Wire `kind`: `informed_consent`. Own class
  `InformedConsentBlock`.
- Cardinality: 0..N per pathway version.
- Lane: `patient` (single allowed kind).
- Two-actor lifecycle: caregiver authors + the runtime fires a
  `MessageBlock`-equivalent notification on `eligible`; patient
  receives, opens, signs.
- Per-kind columns:
  `informed_consent_questions` (JSONB, list[FormQuestion],
   defaults to single yes/no "Ik geef toestemming"),
  `informed_consent_channels` (JSONB, list[Literal["email", "sms",
   "push", "in_app"]], default `["email", "push"]`, minLength 1) —
   author picks which channels the notification + reminders use,
  `informed_consent_reminder_offset_iso` (TEXT, default `"P3D"`),
  `informed_consent_reminder_max` (INT, default `3`, range
   [0, 10]),
  `informed_consent_expires_at_iso` (TEXT, nullable, ISO duration
   from `eligible_at`).
- Input logic: ALLOWED. Timing policy: forbidden (lifecycle is
  internal — reminders + expiry use their own per-kind fields).
- Result schema: `{ consented: bool, expired: bool, signed_at:
  datetime | None, responses: dict[str, Any] | None }`.
  `consented=true` iff the patient signed the affirmative answer;
  `expired=true` iff the block timed out without a signature.
  Mutually exclusive: never both `true`.
- Runtime:
  1. On transition to `eligible`, the engine **automatically**
     fires a notification to the patient on each channel in
     `informed_consent_channels` (reuses `MessageBlock` send
     pipeline). No caregiver action required — pathway logic owns
     the trigger.
  2. Reminder scheduler ticks every
     `informed_consent_reminder_offset_iso` while
     `state == eligible` and `reminders_sent < reminder_max`. Each
     tick re-sends the notification + increments the counter.
     When `reminders_sent == reminder_max` and no
     `expires_at_iso` is set, the block stays `eligible` with no
     further reminders — patient can still sign. `reminder_max`
     is a spam-cap, NOT a lifecycle gate. Authors who want a
     hard deadline set `expires_at_iso`.
  3. Patient signs → `complete_execution(result={consented: true,
     expired: false, signed_at: now, responses})`. Standard
     `eligible|active → completed` transition.
  4. Expiry tick: when `informed_consent_expires_at_iso` elapses
     and the block is still `eligible|active`, the engine completes
     it with `result={consented: false, expired: true, signed_at:
     null, responses: null}`. **No new terminal state** — the
     state machine remains `pending|eligible|active|completed|skipped`.
     Downstream branches gate on `result_field_equals(consent_block,
     "expired", true)` to author the "no consent received" path.
- Validator: `questions` non-empty; `reminder_max` ∈ [0, 10];
  `expires_at_iso` parseable as ISO 8601 duration when set; the
  block's lane MUST be `patient`.
- Reminder scheduler implementation: piggybacks on the §B1
  re-evaluation tick scheduler. No new runtime infra.
- Does NOT require §B3 `event` for the expiry path (engine fires
  the expiry directly when computing eligibility). §B3 is still
  optionally usable for "patient signed via mobile" event-style
  webhooks at MVP.

## Scope split — this PR vs "pathway-nested-runtime" PR

Decided mid-implementation: **this PR ships template + builder-config
surface only** (typed classes, schemas, migrations, publish gates,
pure evaluators). The follow-up **"pathway-nested-runtime" PR** ships
the runtime hooks: nested-enrollment spawn + completion cascade
(A5.2/A5.5), the `record_event` endpoint + event store (B3.3/B3.4 +
A7.5), the re-evaluation tick scheduler (B1.4), and the
notification/reminder/expiry sends (A8.5). Rationale: the builder
dialog (Part C) needs every kind's authoring surface frozen, not the
runtime; and the runtime work shares one new aggregate (nested
enrollment + events + ticks) that deserves its own spec + review.

### B1–B3 — to be filled in as they land

(Pending. Each section captures the final predicate args shape,
evaluator behaviour, publish-gate checks, runtime hooks.)

### C — to be filled in as the builder ships

(Pending. Captures the auto-layout constants, the dialog state
machine, the cascade-cleanup walk, and any per-kind dialog
specialisations.)
