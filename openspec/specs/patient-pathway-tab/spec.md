# patient-pathway-tab Specification

## Purpose
TBD - created by archiving change patient-pathway-visuals. Update Purpose after archive.
## Requirements
### Requirement: Pathway summary banner shows a patient's enrollment at a glance

For each **active** enrollment (completed/cancelled drop off), the patient detail view SHALL render a **compact, read-only glance banner above the tabs** that lets a caregiver see, at a glance, **what just happened, where the patient is now, and what is next**. It is a summary only — the full runtime graph, all dates, results, and the step controls live in the separate Zorgpad detail tab (the runtime canvas); the banner exposes no caregiver actions. The banner keeps a small, fixed footprint regardless of pathway size or shape (freely-built pathways vary widely):

- A header line shows the enrollment status, pathway name, current phase, and an "X of N done" progress indication.
- Below it, a **bounded trail window** shows the ordered steps within a fixed number of steps on each side of the current one — the recent finished steps, the current step, and the next steps — as a horizontal stepper. Steps outside the window collapse into a leading "+N done" pill and a trailing "+N to go" pill, so a long pathway renders in the same footprint as a short one (which shows entirely, without pills).
- Each node reuses the **patient runtime visual language** established by the detail tab's runtime canvas — block-type icon + runtime-state colour (not lane accent). Node styling distinguishes state — finished (calm, success), current (the single highlighted node; flagged when overdue), upcoming (muted) — so the current position is the focal point. The banner derives its state from the same `deriveBlockStatus` the runtime canvas uses, so the two surfaces always agree.

#### Scenario: Banner reflects runtime state

- **WHEN** a care-team caregiver views the summary banner for a patient with an active enrollment
- **THEN** each step reads as finished, current, or upcoming according to its execution state and timing (derived from the same runtime status as the detail tab)

#### Scenario: Banner is read-only

- **WHEN** a caregiver views any step in the banner
- **THEN** it exposes no action control; step controls live only in the Zorgpad detail tab

#### Scenario: Banner shows a trail window around the current step

- **WHEN** a caregiver views the Zorgpad glance banner for an active enrollment
- **THEN** it shows a horizontal trail of the recent finished steps, the current step, and the next steps, plus a header line with the current phase and "X of N done"
- **AND** each node uses the patient runtime visual language (block-type icon + runtime-state colour, matching the detail tab's runtime canvas), with the current step as the single highlighted node

#### Scenario: Long pathway stays compact via end pills

- **WHEN** the enrollment's pathway has more steps than fit the window (large, branched, or parallel)
- **THEN** steps before the window collapse into a "+N done" pill and steps after into a "+N to go" pill, keeping the same compact footprint
- **AND** the full graph, dates, results, and editing are reached via the separate Zorgpad detail tab

#### Scenario: Short pathway shows in full

- **WHEN** the enrollment's pathway fits within the window
- **THEN** all its steps render in the trail with no overflow pills

