## ADDED Requirements

### Requirement: Patient detail view exposes a Pathway tab

The patient detail tabbed profile SHALL include a **Pathway** tab alongside the existing tabs. The tab SHALL host the patient's pathway enrollments (see the `patient-pathway-tab` capability) and SHALL be visible to the patient's care team. The tab SHALL also surface the entry point to **enroll** the patient into a pathway.

#### Scenario: Pathway tab is present

- **WHEN** a care-team caregiver opens a patient's detail view
- **THEN** a Pathway tab is shown in the tab set
- **AND** selecting it renders the patient's enrollments (or an empty state with an "Enroll in pathway" action)

#### Scenario: Empty state offers enrollment

- **WHEN** the patient has no enrollments
- **THEN** the Pathway tab shows an empty state with an action to enroll the patient into a published pathway
