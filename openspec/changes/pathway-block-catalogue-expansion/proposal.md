# Pathway block catalogue expansion (parent: pathway-model-redesign)

**Tier**: `[poc]`

Scopes the 7 future kinds catalogued in
`pathway-model-redesign/example-flow-urology.md` (lines 72-83) into
production. Stacks after slots #1 / #2 / #3 — assumes the typed
`BaseBlock` hierarchy + `input_logic` + runtime aggregate are already
in place.

## Why

Slot #1 explicitly deferred 7 kinds named in the parent catalogue
(`start`, `subpath`, `treatment`, `mdo`, `bridge`, `end-pathway`,
`notification`) so the foundations PR stayed reviewable. With the
foundations merged, those kinds are now blocking real pathway
authoring (urology, oncology flows reference `start` /
`end-pathway` semantics; multi-disciplinair overleg cannot be modelled
without `mdo`).

## Kinds in scope

| Wire `kind` | Class | Lane | Per-kind cols | Runtime semantic |
| --- | --- | --- | --- | --- |
| `start` | `StartBlock` | `system` | none | 0..1 per version; auto-transitions `pending → eligible → completed` at enrollment create. Empty `input_logic` + `timing_policy` enforced |
| `end-pathway` | `EndPathwayBlock` | `system` | none | terminal; completion transitions the enrollment to `state=completed` |
| `notification` | `NotificationBlock` | `patient` | TBD vs existing `message` merge | TBD |
| `treatment` | `TreatmentBlock` | `caregiver` | TBD vs existing `appointment` merge | TBD |
| `subpath` | `SubpathBlock` | `system` | TBD vs existing `pathway_link` overlap | TBD |
| `bridge` | `BridgeBlock` | `system` | TBD vs `pathway_link` + `subpath` | TBD |
| `mdo` | `MdoBlock` | `caregiver` | attendee list | new `PredicateKind.n_of_m_attendees` evaluator |

Each kind is decided one at a time during implementation; rows marked
TBD get resolved in the per-kind proposal note below as we land them.

## Out of scope (still)

- Merging or retiring existing `form` / `milestone` / `wait` (separate
  proposal if at all).
- Cardinality changes to existing kinds (e.g. allowing N decision
  blocks per phase).
- Versioning of the catalogue itself (every BLOCK_CATALOGUE entry stays
  a derived projection of `BaseBlock` subclasses).

## Decisions log (per kind)

Filled in as each kind lands.

### `start` — landed in this PR

- Wire `kind`: `start` (matches parent catalogue verbatim).
- Cardinality: 0..1 per pathway version. Publish-time validator
  rejects 0 or >1 in the same version (D-CAT-S1).
- Per-kind columns: none. `BaseBlock.name` is the only stored field.
- Lane: `system` (canvas position only; semantically the caregiver
  triggers the start by enrolling the patient).
- Input logic: forbidden — must be the empty aggregate. Publish-time
  validator rejects any non-empty `input_logic` on a `StartBlock`
  (D-CAT-S2).
- Timing policy: forbidden — must be `None`. Publish-time validator
  rejects any `timing_policy` on a `StartBlock` (D-CAT-S3).
- Runtime: at enrollment create, every `StartBlock` execution skips
  `pending` / `eligible` and lands directly at `state=completed` with
  `started_at = completed_at = now()`. Downstream blocks whose
  `input_logic.rules` reference the start with the `if_done` predicate
  become eligible on the same eligibility pass that runs at enrollment
  create (D-CAT-S4).
- Frontend: no custom node component — generic `BlockNode` picks it
  up via the catalogue's `Play` icon hint.
