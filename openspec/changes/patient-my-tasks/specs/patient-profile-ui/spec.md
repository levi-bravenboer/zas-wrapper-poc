## MODIFIED Requirements

### Requirement: Patient detail view mounts the my-tasks panel above the tabs

The patient detail view body SHALL mount the my-tasks panel (see the `patient-task-panel` capability) **between the pathway timeline and the detail tabs**. The panel SHALL only occupy space when it has content (see `patient-task-panel` — hidden when empty), so the layout collapses to timeline-then-tabs when the caregiver has no open tasks for the patient.

#### Scenario: Panel sits between timeline and tabs

- **WHEN** a caregiver with open tasks for the patient opens that patient's detail view
- **THEN** the my-tasks panel is rendered after the pathway timeline and before the detail tabs

#### Scenario: Layout collapses when the panel is empty

- **WHEN** the caregiver has no open tasks for the patient
- **THEN** the body shows the pathway timeline immediately followed by the detail tabs, with no gap or placeholder where the panel would be
