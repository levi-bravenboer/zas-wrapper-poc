## MODIFIED Requirements

### Requirement: Pathway tab shows a patient's enrollments with three step buckets

The patient detail view SHALL include a **Pathway** tab (UI label "Zorgpad"). It SHALL show **only active enrollments** (completed/cancelled enrollments drop off the tab in this version). For each active enrollment it SHALL show the **full** pathway across all horizons (near-term and far-future), classified into three buckets — **Upcoming** (eligible but timing not elapsed — shown light/greyed with the ready/scheduled date, not actionable), **Next / actionable** (eligible with timing elapsed, or active — highlighted and rendered with the block's caregiver action), and **Finished** (`completed`/`skipped` — dimmed with a completion marker). Unlike the `/tasks` inbox (a near-term list windowed to ~30 days), the Zorgpad tab is not time-windowed. The tab is visible to the patient's care team.

The enrollment SHALL be summarised in a **compact glance banner** (rendered above the patient tabs) that lets a caregiver see, at a glance, **what just happened, where the patient is now, and what is next** — while the full runtime graph, dates, results, and step controls live in the separate Zorgpad detail tab (the runtime canvas). The banner keeps a small, fixed footprint regardless of pathway size or shape (freely-built pathways vary widely):

- A header line shows the enrollment status, pathway name, current phase, and an "X of N done" progress indication.
- Below it, a **bounded trail window** shows the ordered steps within a fixed number of steps on each side of the current one — the recent finished steps, the current step, and the next steps — as a horizontal stepper. Steps outside the window collapse into a leading "+N done" pill and a trailing "+N to go" pill, so a long pathway renders in the same footprint as a short one (which shows entirely, without pills).
- Each node reuses the **patient runtime visual language** established by the detail tab's runtime canvas — block-type icon + runtime-state colour (not lane accent). Node styling distinguishes state — finished (calm, success), current (the single highlighted node; flagged when overdue), upcoming (muted) — so the current position is the focal point. The banner derives its state from the same `deriveBlockStatus` the runtime canvas uses, so the two surfaces always agree.

#### Scenario: Buckets reflect runtime state

- **WHEN** a care-team caregiver opens the Pathway tab for a patient with an active enrollment
- **THEN** steps appear under Upcoming, Next/actionable, or Finished according to their execution state and timing

#### Scenario: Upcoming step is not actionable

- **WHEN** a step is eligible but its timing has not elapsed
- **THEN** it shows under Upcoming with its ready date and exposes no action control

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
