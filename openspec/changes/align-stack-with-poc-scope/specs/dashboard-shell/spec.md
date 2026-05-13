## MODIFIED Requirements

### Requirement: Section placeholder pages

The non-dashboard sections (`/taken`, `/zorgpaden`, `/patienten`, `/instellingen`) SHALL render real feature surfaces per their respective capabilities (`task-inbox`, `pathway-builder`, `patients-overview`, `admin-users`). The shared placeholder component MAY be retained for unit-testing the layout but MUST NOT be rendered by the section routes in production.

The `/dashboard` route MUST render the `DashboardPage` component bound to the `dashboard-data` capability — no placeholder copy.

#### Scenario: Section route renders feature surface

- **WHEN** an authed caregiver navigates to `/taken`
- **THEN** the main area renders the task inbox per the `task-inbox` capability, not the generic placeholder

#### Scenario: Dashboard renders live counts

- **WHEN** an authed caregiver navigates to `/dashboard`
- **THEN** `DashboardPage` renders cards bound to `GET /dashboard/summary` per the `dashboard-data` capability
