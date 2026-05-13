## ADDED Requirements

### Requirement: Pathway list page

The orchestrator SHALL expose `/zorgpaden` showing every saved pathway as a list with name and last-updated timestamp. A "New pathway" action MUST navigate to the composer route.

#### Scenario: List renders from backend

- **WHEN** the caregiver navigates to `/zorgpaden`
- **THEN** the page renders one row per pathway returned by `GET /pathways`
- **AND** each row links to the composer at `/zorgpaden/$pathwayId`

### Requirement: Composer skeleton

The orchestrator SHALL expose `/zorgpaden/$pathwayId` rendering a read-write view of a pathway's blocks. PoC composer surfaces blocks as a JSON-edit area inside a `dev composer` toggle; a "Save" button POSTs to the backend.

#### Scenario: Save persists changes

- **WHEN** the caregiver edits block JSON and clicks Save
- **THEN** the orchestrator calls `PUT /pathways/{id}` and reflects the server response on success
- **AND** validation failure surfaces a toast bound to `ErrorResponse.code` via i18n

### Requirement: Save-is-enrollable semantics

A saved pathway SHALL be immediately enrollable from F4. There is no publish step in PoC.

#### Scenario: Saved pathway enrollable from patients overview

- **WHEN** a pathway is saved via `PUT /pathways/{id}`
- **THEN** it appears in the enrollable-pathway list returned to F4 without any further action

### Requirement: Backend pathway router

The backend SHALL expose `GET /pathways`, `GET /pathways/{id}`, `POST /pathways`, `PUT /pathways/{id}` returning Pathway resources from `pathway-domain`. All routes require an authenticated caregiver session.

#### Scenario: Unauthorized blocked

- **WHEN** an unauthenticated request hits `GET /pathways`
- **THEN** the response is `401` with `ErrorResponse.code = "security.auth.required"`

#### Scenario: Save round-trip

- **WHEN** a caregiver POSTs a pathway and immediately GETs by id
- **THEN** the second response equals the first (modulo server-assigned `id` and timestamps)
