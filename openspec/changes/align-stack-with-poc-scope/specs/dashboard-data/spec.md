## ADDED Requirements

### Requirement: Dashboard counts endpoint

The backend SHALL expose `GET /dashboard/summary` returning counts for the caller: `enrolled_patients`, `pending_tasks`, `active_pathways`. Counts MUST be computed live from the database — no caching in PoC.

#### Scenario: Counts reflect DB state

- **WHEN** a caregiver has 4 enrollments, 7 pending tasks, and owns 2 pathways
- **THEN** `GET /dashboard/summary` returns `{ enrolled_patients: 4, pending_tasks: 7, active_pathways: 2 }`

### Requirement: Dashboard cards bind to counts

The orchestrator dashboard SHALL render three cards bound to the counts above with one-click drill-downs: patients card → `/patienten`, tasks card → `/taken`, pathways card → `/zorgpaden`. Loading and error states MUST be handled — no static fallbacks.

#### Scenario: Card drill-down

- **WHEN** a caregiver clicks the tasks card
- **THEN** the orchestrator navigates to `/taken`

#### Scenario: Loading state

- **WHEN** the `summary` query is in flight
- **THEN** each card renders a skeleton; no zero-value flash before the response lands
