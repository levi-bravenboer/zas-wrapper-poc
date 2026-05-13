## ADDED Requirements

### Requirement: Task inbox page

The orchestrator SHALL expose `/taken` rendering an inbox of pending tasks across every enrollment the caregiver owns. Each row MUST show patient name, pathway name, task title, and a Complete action.

#### Scenario: Inbox cross-patient

- **WHEN** the caregiver has tasks across three different patients
- **THEN** the inbox renders rows for all three with patient name visible per row

### Requirement: Complete action

Clicking Complete SHALL call `POST /tasks/{id}/complete`. On success the row is removed and the pathway's `current_block_id` advances per the linear runtime in `pathway-domain`.

#### Scenario: Complete advances pathway

- **WHEN** a caregiver completes the only pending task for an enrollment
- **THEN** the inbox removes the row and a subsequent `GET /patients/{patient_id}` shows the next `current_block_id`

### Requirement: Backend task router

The backend SHALL expose `GET /tasks` returning pending tasks for the authenticated caregiver and `POST /tasks/{id}/complete` setting `status = done` and triggering runtime advance.

#### Scenario: Default filter

- **WHEN** `GET /tasks` is called with no params
- **THEN** the response contains only tasks with `status = pending` for the caller's enrollments
