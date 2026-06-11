# Tasks — pathway-block-catalogue-expansion

Worked one kind at a time. Each `§N` block lands as its own
commit. Tests + verify gate every commit.

## § 0 Preconditions

- [x] 0.1 Confirm parent `pathway-model-redesign` decisions D1-D10 still
  hold (no upstream amendments needed for catalogue expansion).
- [x] 0.2 Confirm slot #1 / #2 / #3 are merged on this branch.

## § 1 `start`

- [x] 1.1 `app/domain/pathway/blocks/start/__init__.py` + `typed.py` —
  `StartBlock(BaseBlock)` with `KIND="start"`, `TYPE_CODE="start"`,
  `LABEL`, `DESCRIPTION`, `ICON="play"`,
  `allowed_lane_kinds=(LANE_KIND_SYSTEM,)`, empty `CONFIG_SCHEMA` /
  `UI_SCHEMA`.
- [x] 1.2 Register `StartBlock` in
  `app/domain/pathway/blocks/resolver.py::BLOCK_CLASSES` (palette
  ordering: first, ahead of `AppointmentBlock`).
- [x] 1.3 Add `"start"` to
  `app/schemas/pathway/blocks.py::BlockSemanticsLiteral`.
- [x] 1.4 Add `StartBlockOut` + `StartBlockIn` + union members + lookup
  entry in `app/schemas/pathway/typed_blocks.py`.
- [x] 1.5 Engine: `RuntimeEngine.auto_fire_starts` auto-completes
  `StartBlock` executions (skip `pending`/`eligible`, set
  `state=completed`, `started_at = completed_at = now()`); follow with
  the standard eligibility pass on the remaining executions so
  downstream `if_done` rules referencing the start fire on the same
  pass.
- [x] 1.6 Publish-time validator: reject 0 or >1 `StartBlock` per
  version; reject any non-empty `input_logic` or any `timing_policy`
  on a `StartBlock`.
- [x] 1.7 Tests: domain catalogue projection, mapper round-trip,
  engine auto-complete on enrollment create, validator rejections.
- [x] 1.8 `/verify` backend; commit.

## § 2 `end-pathway`

- [x] 2.1 `app/domain/pathway/blocks/end_pathway/__init__.py` + `typed.py` —
  `EndPathwayBlock(BaseBlock)` with `KIND="end_pathway"`,
  `TYPE_CODE="end_pathway"`, `LABEL`, `DESCRIPTION`, `ICON="stop"`,
  `allowed_lane_kinds=(LANE_KIND_SYSTEM,)`, no per-kind cols, name-only
  CONFIG_SCHEMA. Wire kind is snake-case to match `pathway_link` /
  `luscii_program`.
- [x] 2.2 Register `EndPathwayBlock` in
  `app/domain/pathway/blocks/resolver.py::BLOCK_CLASSES` (appended last
  so terminal kinds sit at the end of the palette).
- [x] 2.3 Add `"end_pathway"` to
  `app/schemas/pathway/blocks.py::BlockSemanticsLiteral`.
- [x] 2.4 Add `EndPathwayBlockOut` + `EndPathwayBlockIn` + union members
  + lookup entry in `app/schemas/pathway/typed_blocks.py`.
- [x] 2.5 Publish-time validator: reject 0 `EndPathwayBlock` per
  version; reject any `timing_policy` on an `EndPathwayBlock`.
  `input_logic` allowed.
- [x] 2.6 Enrollment service: on `complete_execution` for an
  `EndPathwayBlock` template, flip `enrollment.state="active" →
  "completed"`. Idempotent on re-fire.
- [x] 2.7 Tests: catalogue projection, validator cardinality + shape,
  router fixture seeds end on system lane, snapshot resolver concept
  pathway seeds end before publish.
- [x] 2.8 `/verify` backend; commit.

## § 3 `notification`

(Not started — merge-vs-coexist with `message` decided when § 2 lands.)

## § 4 `treatment`

(Not started — variant-of-appointment-vs-new decided when § 3 lands.)

## § 5 `subpath`

(Not started — overlap with `pathway_link` decided when § 4 lands.)

## § 6 `bridge`

(Not started — overlap with `pathway_link` / `subpath` decided when
§ 5 lands.)

## § 7 `mdo`

(Not started — depends on a new `PredicateKind.n_of_m_attendees`
evaluator, decided when § 6 lands.)
