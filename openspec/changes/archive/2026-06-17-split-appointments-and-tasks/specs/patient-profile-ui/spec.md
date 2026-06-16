## MODIFIED Requirements

### Requirement: Patient detail route renders header + adjacent care-team card + clinical tab strip

The orchestrator patient profile at `/_auth/patients/$patientId` SHALL render, in addition to the existing `Metingen` and `Labresultaten` tabs, an **Afspraken** tab listing the patient's appointments. The tab SHALL read the `appointment-base` patient-keyed query and present two relations: **Over patiënt** (appointments where the patient is the subject / `patient_id`) and **Met patiënt** (appointments the patient attends via `appointment_patient_attendees`). Each entry links to the appointment detail (`/_auth/appointments/$appointmentId`).

The tab order SHALL be `Metingen`, `Labresultaten`, `Afspraken`. The route stays guarded by `Role.ADMIN | Role.CAREGIVER` and honours `require_patient_access` (a caregiver outside the patient's visibility predicate receives the existing "Patiënt niet gevonden" empty state).

#### Scenario: Afspraken tab lists about + with appointments

- **WHEN** a caregiver opens a patient profile for a patient who is the subject of one appointment and an attendee of another
- **THEN** the Afspraken tab MUST list both, the first under "Over patiënt" and the second under "Met patiënt"

#### Scenario: Afspraken tab entries link to appointment detail

- **WHEN** the caregiver clicks an appointment in the patient's Afspraken tab
- **THEN** navigation MUST go to `/_auth/appointments/$appointmentId` (the shared appointment detail), not a patient-scoped duplicate
