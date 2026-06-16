## ADDED Requirements

### Requirement: Pathway tab shows a patient's enrollments with three step buckets

The patient detail view SHALL include a **Pathway** tab (UI label "Zorgpad"). For each active enrollment it SHALL show the **full** pathway across all horizons (near-term and far-future), rendered in three buckets: **Upcoming** (eligible but timing not elapsed — shown greyed with the ready/scheduled date, not actionable), **Next / actionable** (eligible with timing elapsed, or active — rendered with the block's caregiver action), and **Finished** (`completed`/`skipped`). Unlike the `/tasks` inbox (a near-term list windowed to ~30 days), the Zorgpad tab is not time-windowed. The tab is visible to the patient's care team.

#### Scenario: Buckets reflect runtime state

- **WHEN** a care-team caregiver opens the Pathway tab for a patient with an active enrollment
- **THEN** steps appear under Upcoming, Next/actionable, or Finished according to their execution state and timing

#### Scenario: Upcoming step is not actionable

- **WHEN** a step is eligible but its timing has not elapsed
- **THEN** it shows under Upcoming with its ready date and exposes no action control

### Requirement: Each block renders its contract-specific action

An actionable step SHALL render the caregiver action matching its block contract: `task`→Done, `appointment`→Book date then Mark performed, `treatment`→Book then Record result, `mdo`→Close + notes, `decision`→Pick branch, and fake-log blocks (`form`, `message`, `informed_consent`, `external_program`, `pathway_link`)→Advance (clearly labelled as a logged advance with no real downstream effect yet). Triggering the action sends the corresponding Temporal Update and reflects the returned state.

#### Scenario: Completing a task

- **WHEN** the caregiver clicks Done on an actionable `task` step
- **THEN** the step moves to Finished and any newly-eligible steps appear

#### Scenario: Picking a decision branch

- **WHEN** the caregiver picks an output on a `decision` step
- **THEN** the chosen branch's downstream steps appear and pruned branches' steps disappear

### Requirement: Finished steps show result summary with attribution

A finished step SHALL display its typed result summary (e.g. appointment `performed_at`, treatment notes/complications, decision branch picked, mdo notes) together with the caregiver who completed it and the timestamp.

#### Scenario: Finished treatment shows its result

- **WHEN** a caregiver views a finished `treatment` step
- **THEN** it shows performed_at, notes, complications, plus who completed it and when

### Requirement: Pathway steps also surface in the unified tasks inbox

Actionable `task`-family steps SHALL appear in the `/tasks` inbox via the `pathway` source, and appointment-backed steps via the appointment source, scoped to the caller's care-team membership — so a caregiver can work pathway steps from either the Pathway tab or the inbox.

#### Scenario: Pathway to-do appears in the inbox

- **WHEN** a `task` step is actionable for a patient on the caller's care team
- **THEN** it appears in the caller's `/tasks` inbox and completing it there advances the pathway
