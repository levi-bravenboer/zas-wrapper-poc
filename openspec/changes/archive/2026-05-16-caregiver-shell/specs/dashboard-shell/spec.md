## MODIFIED Requirements

### Requirement: Sidebar nav inventory

The orchestrator SHALL render a single canonical sidebar inventory declared in `apps/orchestrator/src/components/nav/sidebar-items.ts`, structured into three groups in this order:

1. **Top group** (visible to all authed sessions): `Dashboard` → `/_auth/`, `Patiënten` → `/_auth/patients`, `Inbox` → `/_auth/inbox` (placeholder).
2. **Beheer group** (collapsible; visible only when `session.user.role === 'admin'`): `Gebruikers`, `Organisaties`, `Affiliaties` linked under `/_auth/admin/*`.
3. **Pinned bottom group** (visible to all authed sessions): `Instellingen` → `/_auth/settings`.

Each inventory entry SHALL carry an optional `requiresRole?: Role[]`; entries whose `requiresRole` excludes the current session role MUST be filtered out before the sidebar renders — no hidden-but-present DOM nodes. The collapsible `Beheer` group SHALL default to expanded for admins.

#### Scenario: Inventory file is the single source of truth

- **WHEN** any nav label or path needs editing
- **THEN** the edit MUST be made in `sidebar-items.ts` and MUST NOT require touching `Sidebar.tsx` to add or remove entries

#### Scenario: Caregiver renders without Beheer

- **WHEN** a caregiver session renders the sidebar
- **THEN** no DOM node under the Beheer group exists and no path beginning `/_auth/admin/` appears in the rendered nav

#### Scenario: Admin renders Beheer expanded by default

- **WHEN** an admin session renders the sidebar on first visit (no persisted collapse state)
- **THEN** the Beheer group is expanded and the three child entries are visible

### Requirement: Section placeholder pages

Each top-level nav destination SHALL be backed by a TanStack route under `apps/orchestrator/src/routes/_auth/`. Routes destined to be filled by chain specs `users-admin-ui`, `organisations-admin-ui`, `practitioner-roles-admin-ui`, `patient-profile-ui`, `care-teams-ui` MAY ship as placeholders rendering `"Komt binnenkort — wordt geleverd door <spec>"` copy with a link back to `/_auth/`. Placeholder routes MUST be deleted (or replaced) by the chain spec that owns them; no placeholder may persist after its owning spec is archived.

The previously-redirecting `_auth/index.tsx` (which redirected to `/_auth/patients`) SHALL be replaced by a real component rendering `<DashboardLanding>` (defined in capability `caregiver-shell`).

#### Scenario: Admin placeholder deep-link renders the placeholder

- **WHEN** an admin loads `/_auth/admin/users` before `users-admin-ui` ships
- **THEN** the route renders the placeholder copy and a "back to dashboard" link, and MUST NOT throw or render a 404

#### Scenario: Landing route no longer redirects

- **WHEN** an authed user loads `/_auth/`
- **THEN** the response renders `<DashboardLanding>` (KPI tiles + quick links), not a redirect to `/_auth/patients`

#### Scenario: Placeholders disappear when owning spec lands

- **WHEN** chain spec `users-admin-ui` is archived
- **THEN** `apps/orchestrator/src/routes/_auth/admin/users.tsx` MUST contain the real users-admin route, not the placeholder copy
