## ADDED Requirements

### Requirement: Appointments expose a first-class caller-scoped read API

The backend SHALL expose `GET /appointments` (list → `Page[AppointmentRead]`) and `GET /appointments/{appointment_id}` (read-one → `AppointmentRead`). These replace the appointment data previously reachable only through the removed `/tasks` aggregator.

Guards are layered:
- **List** is internal: guarded by `Role.ADMIN | Role.CAREGIVER`. Visibility reuses the aggregator predicate — an appointment is visible to a caregiver when the caller holds an active `appointment_participant` row for it (any role); admins see all appointments in their tenant. The list defaults to the booked-status window (`status = 'booked'`, `starts_at` within the next 30 days) ordered by `starts_at asc`.
- **Read-one** is access-based, NOT a fixed role set: it honours `require_patient_access` for the appointment's patient, which admits internal staff with visibility AND external grant-holders (e.g. a referring GP). Outside that access → `404 Not Found` (existence hiding). This is what lets external collaborators open an appointment to read/add notes.

#### Scenario: Caregiver lists only their appointments

- **WHEN** a caregiver calls `GET /appointments`
- **THEN** the response MUST contain only appointments for which the caregiver has an active participant row, ordered by `starts_at asc`

#### Scenario: Admin sees tenant-wide appointments

- **WHEN** an admin calls `GET /appointments`
- **THEN** the response MUST contain all non-deleted booked-window appointments in the admin's tenant

#### Scenario: Detail hides existence outside visibility

- **WHEN** a caregiver requests `GET /appointments/{id}` for an appointment they do not participate in (or whose patient they cannot access)
- **THEN** the response MUST be `404 Not Found`, indistinguishable from a missing id

#### Scenario: No write routes ship

- **WHEN** the appointment router is inspected
- **THEN** only `GET` routes exist — create/reschedule/cancel are out of scope for this change

### Requirement: A patient may attend an appointment whose subject is another patient

The backend SHALL persist an `appointment_patient_attendees` table (`appointment_id` FK `appointments.id` ON DELETE CASCADE, `patient_id` FK `patients.id` ON DELETE RESTRICT, plus inherited `Entity` columns) so a patient can be an *attendee* of an appointment whose subject (`appointments.patient_id`) is a different patient. This distinguishes appointments **about** a patient (subject) from appointments **with** a patient (attendee).

A patient-keyed read SHALL return both relations for a given patient: appointments where `patient_id == <patient>` (about) and appointments the patient attends via `appointment_patient_attendees` (with), each labelled by relation.

#### Scenario: Attendee table created by migration

- **WHEN** a fresh database is migrated to head
- **THEN** an `appointment_patient_attendees` table exists linking `appointment_id` ↔ `patient_id`

#### Scenario: Patient-keyed query unions about + with

- **WHEN** the patient appointment query runs for a patient who is the subject of appointment A and an attendee of appointment B (subject = another patient)
- **THEN** the result MUST include both A (relation `about`) and B (relation `with`)
