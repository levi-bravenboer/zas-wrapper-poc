## MODIFIED Requirements

### Requirement: Landing route renders dashboard with KPI tiles and quick links

The orchestrator SHALL render at `/_auth/` (replacing the prior redirect to `/_auth/patients`) a data-backed dashboard composed of KPI tiles and drill-down list panels. The route file SHALL carry `// surface-opt-out: app-only`, MUST NOT call `defineFeature`, and MUST NOT be migrated through `gen:feature` (catalogue: `dashboard` is app-only by intent).

KPI counts SHALL be fetched via existing list endpoints, each tile fetching independently. The `Actieve patiënten` and `Open taken` counts SHALL read `Page.total` from a `page_size=1` request. The `Afspraken` count SHALL be the number of today/upcoming appointments derived from `GET /appointments`, so the tile agrees with the "Afspraken" panel. A fetch failure on any individual tile SHALL render an em-dash (`—`) for that count, never throw or render an error boundary.

- KPI tiles: `Actieve patiënten` (count from `GET /patients`), `Open taken` (count of pending tasks from `GET /tasks`, status-filtered to the open/pending state), `Afspraken` (count of today/upcoming appointments from `GET /appointments`). There SHALL be no `messages` tile (no messaging domain exists in the PoC) and no `care-teams` tile.
- Drill-down panel "Mijn taken" (primary): the caller's pending tasks sorted by deadline ascending (overdue first), capped at 5; each row SHALL be a router link that opens the referenced patient (or the task detail when the task has no patient); a "bekijk alles" link SHALL point to `/_auth/tasks` (the inbox surface; no `/_auth/inbox` route exists).
- Drill-down panel "Afspraken": today/upcoming appointments sorted by start ascending, capped at 5; each row SHALL be a router link to the appointment's drill-down target; a "bekijk alles" link SHALL point to the appointments surface.

There SHALL be no "recente patiënten" list panel, no "patients needing attention" card, and no quick-action buttons on the landing dashboard (out of PoC scope for F2).

Each drill-down panel SHALL render an empty state when its source returns no rows and a quiet inline failure state on fetch error, keeping the rest of the dashboard interactive (no shared error boundary, no throw). The KPI count for `Open taken` SHALL use the same pending filter as the "Mijn taken" panel so the number and the list agree.

#### Scenario: Landing renders live KPI counts

- **WHEN** a caregiver loads `/_auth/`
- **THEN** the page renders the three KPI tiles (`Actieve patiënten`, `Open taken`, `Afspraken`) — patients and pending tasks from `Page.total` of `GET /patients` and the pending-filtered `GET /tasks`, and appointments from the today/upcoming count over `GET /appointments`
- **AND** no `messages` tile is rendered

#### Scenario: KPI tile fetch failure renders em-dash

- **WHEN** the request backing any single KPI tile (e.g. `GET /tasks?...&page_size=1`) returns a non-2xx response
- **THEN** that tile MUST render `—` in place of a number; the other tiles and both drill-down panels MUST stay interactive

#### Scenario: Task panel drills down on click

- **WHEN** a caregiver clicks a row in the "Mijn taken" panel
- **THEN** the router navigates to the referenced patient/task detail
- **AND** the panel shows at most 5 pending tasks ordered by deadline ascending

#### Scenario: Appointment panel drills down on click

- **WHEN** a caregiver clicks a row in the "Afspraken" panel
- **THEN** the router navigates to that appointment's drill-down target
- **AND** the panel shows at most 5 today/upcoming appointments ordered by start ascending

#### Scenario: Panel degrades quietly when its source fails

- **WHEN** the tasks request backing the "Mijn taken" panel fails
- **THEN** the panel renders a quiet inline failure state, the "Afspraken" panel and all KPI tiles remain interactive, and no error boundary is triggered

#### Scenario: Empty panel renders an empty state

- **WHEN** the caller has no pending tasks
- **THEN** the "Mijn taken" panel renders its empty state rather than skeleton rows
