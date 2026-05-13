## ADDED Requirements

### Requirement: Patients list page

The orchestrator SHALL expose `/patienten` rendering one row per enrolled patient. Each row MUST show display name, pathway name, current step, and a status (`active` | `completed`). Clicking a row navigates to the patient detail route at `/patienten/$patientId`.

#### Scenario: Row navigates to detail

- **WHEN** the caregiver clicks a row
- **THEN** the orchestrator navigates to `/patienten/$patientId` for that patient

### Requirement: Pathway and status filters

The list SHALL expose two filters: pathway (single select, all pathways the caregiver has enrollments under) and status (`active` | `completed` | `all`). Filters MUST be reflected in the URL query string so the view is shareable and back-navigable.

#### Scenario: Filter persists across reload

- **WHEN** the caregiver selects a pathway filter and reloads the page
- **THEN** the filter survives the reload via the URL search params

### Requirement: Backend patients router

The backend SHALL expose `GET /patients` accepting query params `pathway_id?`, `status?` returning enrolled patients with their current enrollment. Unauthenticated requests are rejected with `security.auth.required`.

#### Scenario: Filter by pathway

- **WHEN** `GET /patients?pathway_id=p1` is called
- **THEN** the response contains only patients with an active enrollment in pathway `p1`

#### Scenario: Filter by status

- **WHEN** `GET /patients?status=completed` is called
- **THEN** the response contains only patients whose enrollment is completed
