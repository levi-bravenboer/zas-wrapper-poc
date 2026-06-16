## ADDED Requirements

### Requirement: Orchestrator exposes a dedicated Afspraken surface, distinct from Taken

The orchestrator SHALL render an **Afspraken** sidebar nav item and a route at `/_auth/appointments`, separate from the **Taken** nav item / `/_auth/tasks` route. The Afspraken view SHALL read the `appointment-base` API (`GET /appointments`) and present a **date-grouped master-detail rail** of scheduled appointments. It SHALL NOT render the task-inbox affordances (unread dot, mark-on-open read-state, inbox-polling). Both routes SHALL be guarded by `Role.ADMIN | Role.CAREGIVER`.

The Afspraken view SHALL be built from **domain-neutral presentation primitives** under `apps/orchestrator/src/components/rail/` (e.g. `MasterDetailRail`, `GroupedList`, `RailRow`, rail empty-states) — named for their UI role, NOT after tasks or appointments, and importing no domain types. The same primitives SHALL also back the rewritten Taken view, so the two surfaces share one layout implementation with per-domain data adapters. The appointment detail route `/_auth/appointments/$appointmentId` SHALL reuse the shared `<EntityDetailPage>` chrome and read `GET /appointments/{id}`.

#### Scenario: Shared rail primitives carry no domain coupling

- **WHEN** the `components/rail/` primitives are inspected
- **THEN** they MUST NOT import `Task`/`Appointment` types or `modules/tasks`/`modules/appointment`, and BOTH the Taken and Afspraken views MUST render through them

### Requirement: Appointment detail shows info, an attributed notes feed, and tracked attachments

The appointment detail (`/_auth/appointments/$appointmentId`) SHALL render a custom view (borrowing patient-profile UI patterns) with:

1. **Info** — date/window, kind, modality, location, status, participants, the linked patient summary, and a prominent **"Open patiënt"** action that navigates to `/_auth/patients/$patientId`. Clinical data (measurements/labs) is NOT duplicated on this view — the link is the path to it.
2. **Notes** — an attributed, chronological feed (author display name + time) backed by `appointment-collab` notes, plus an add-note box. Append-only — no edit/delete affordance.
3. **Attachments** — a list (filename, uploader, time) with an upload control (direct-to-storage via presigned PUT), per-item download (presigned GET), and a delete control shown **only on the caller's own** uploads.

#### Scenario: Notes feed is attributed and add-only

- **WHEN** a caregiver opens an appointment detail
- **THEN** existing notes MUST render with author + timestamp, an add-note box MUST be present, and there MUST be no edit/delete control on a note

#### Scenario: Attachment upload and download go direct to storage

- **WHEN** a caregiver uploads a document on the appointment detail
- **THEN** the bytes MUST transfer via the presigned PUT URL (not through the app API), the new item MUST appear with the caller as uploader, and downloading MUST use a presigned GET URL

#### Scenario: Afspraken and Taken are separate nav items

- **WHEN** a caregiver views the sidebar
- **THEN** there MUST be two distinct nav items — "Afspraken" → `/_auth/appointments` and "Taken" → `/_auth/tasks` — and neither view projects the other's data

#### Scenario: Afspraken is an agenda, not a task rail

- **WHEN** the Afspraken list renders
- **THEN** appointments MUST be grouped by date and ordered by `starts_at`, and the view MUST NOT render the task-inbox affordances (unread dot, mark-on-open, polling-as-inbox)

#### Scenario: Appointment detail reuses shared chrome

- **WHEN** a caregiver opens an appointment from the Afspraken list
- **THEN** `/_auth/appointments/$appointmentId` MUST render via `<EntityDetailPage>` and load `GET /appointments/{id}`, surfacing a "niet gevonden" empty state on 404
