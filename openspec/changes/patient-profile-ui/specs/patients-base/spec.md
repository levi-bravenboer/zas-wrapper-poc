## MODIFIED Requirements

### Requirement: Orchestrator exposes a patients overview screen built on `DataTable<T>`

The orchestrator SHALL ship `/_auth/patients` as the canonical caregiver/admin patients overview, satisfying PoC feature `F4` (Patients overview). The page SHALL compose `<FilterableListPage<PatientRead>>` (introduced by `caregiver-shell`) around `<DataTable<PatientRead>>` per `apps/orchestrator/AGENTS.md` §25 (Lists & DataTable). Row click SHALL navigate `/_auth/patients/$patientId`, which renders the real `<PatientProfilePage>` (delivered by `patient-profile-ui`), NOT a placeholder.

Column shape, filter set, default sort, search, kebab actions, realtime topic, and state persistence are unchanged from the `caregiver-shell` revision of this requirement.

#### Scenario: Row click routes to the real detail page

- **WHEN** a caregiver clicks a patient row
- **THEN** the orchestrator MUST navigate to `/_auth/patients/$patientId` and the destination MUST render `<PatientProfilePage>` (sticky header + three tabs), NOT the "Detailpagina komt binnenkort" placeholder copy

#### Scenario: Detail navigation preserves caregiver visibility

- **WHEN** a caregiver clicks a row for a patient they can see in the list (predicate passes)
- **THEN** the detail page MUST render successfully; if their visibility changes between the list fetch and the detail navigation, the detail page MUST surface "Patiënt niet gevonden" rather than throw
