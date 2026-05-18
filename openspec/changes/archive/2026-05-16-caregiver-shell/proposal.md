**Tier**: chain — orchestrator-admin-ux #2

## Why

`dashboard-shell` ships a persistent sidebar with two top-level nav entries (`Patiënten`, `Instellingen`). The orchestrator-admin-ux chain layers four new top-level surfaces on top — users admin, organisations admin, practitioner-roles admin, care-teams editor inside the patient profile — and a landing/dashboard surface for caregivers landing after login. None of that fits the current sidebar shape (single flat list, no role gating, no admin section, no landing).

Two more concerns surface from the chain coordinator:

1. **Landing.** Today `/_auth` redirects to `/_auth/patients`. With users/orgs/care-teams added, "patients" is no longer the only thing a caregiver lands on. A small dashboard (counts + recent activity + quick actions) is the right home.
2. **Filterable list scaffolding.** `users-admin-ui`, `organisations-admin-ui`, `practitioner-roles-admin-ui`, and `patient-profile-ui` (#6) will all render filtered lists. `DataTable<T>` covers the table; what's missing is the *page-level* envelope: title bar, primary CTA, filter chips row, empty state. Building that as a per-surface re-roll wastes effort and produces drift. Define it once as `<FilterableListPage>` here, before any consumer ships.

This change is **#2 of the orchestrator-admin-ux chain** (`openspec/changes/CHAIN-orchestrator-admin-ux.md`). It blocks every UI surface in the chain.

## What Changes

- **Add capability `caregiver-shell`** covering:
  - Hybrid nav structure on the existing sidebar: top group `Dashboard`, `Patiënten`, `Inbox` (placeholder for #7), bottom group `Beheer` (admin-only collapsible: `Gebruikers`, `Organisaties`, `Affiliaties`), and `Instellingen` pinned at bottom.
  - Role-aware nav rendering — the `Beheer` group is rendered iff `session.user.role === 'admin'`.
  - Landing route `/_auth/` rendering `<DashboardLanding>` with KPI tiles (open care teams, patients in your subtree, recent assignments) and quick links to the four major surfaces. Today's `/_auth` redirect to `/_auth/patients` is removed.
  - `<FilterableListPage<T>>` scaffolding component at `app/components/list/FilterableListPage.tsx`: title slot, description slot, primary CTA slot, filter-chip row slot, table slot, empty-state slot. Wraps `<DataTable<T>>` underneath; surfaces compose this instead of rolling their own page shell.
  - i18n namespace `caregiver-shell` plus per-section `Beheer` keys; namespace `dashboard` for the landing page strings.
- **MODIFIES `dashboard-shell`**: nav inventory grows to the structure above, and the inventory is now role-aware. Section placeholder pages are kept for `Instellingen`; new placeholders for the four `Beheer` routes ship in this change (filled in by #3–#5).
- **MODIFIES `patients-base`**: the existing `/_auth/patients` page is refactored to compose `<FilterableListPage<PatientRead>>` instead of carrying its own page shell. No behaviour change; the table, filters, and route guard stay identical.
- **MODIFIES `app-layout`**: route group `_auth/admin/*` is registered (empty layout that just gates access through `require_role(Role.ADMIN)` and renders `<Outlet/>`). The four `Beheer` routes mount under it in their own specs.

## Capabilities

### New Capabilities

- `caregiver-shell`: hybrid nav, auth landing, role-aware admin section, shared filterable list scaffolding.

### Modified Capabilities

- `dashboard-shell`: nav inventory + role-aware rendering; landing route now serves the dashboard, not a redirect.
- `patients-base`: list page composes `<FilterableListPage>`; no behaviour change.
- `app-layout`: registers `_auth/admin/*` route group (admin-only gate).

## Impact

- **Chain prerequisites**: `practitioner-role-split` archived in `main` (typed client must speak the new shape).
- **Code**:
  - `apps/orchestrator/src/components/nav/Sidebar.tsx` — extend inventory + role gating
  - `apps/orchestrator/src/components/list/FilterableListPage.tsx` (new)
  - `apps/orchestrator/src/routes/_auth/index.tsx` — replace redirect with `<DashboardLanding>`
  - `apps/orchestrator/src/routes/_auth/admin/route.tsx` (new) — admin-only layout
  - `apps/orchestrator/src/routes/_auth/admin/users.placeholder.tsx`, `organisations.placeholder.tsx`, `practitioner-roles.placeholder.tsx` (new placeholders)
  - `apps/orchestrator/src/features/dashboard/DashboardLanding.tsx` (new)
  - `apps/orchestrator/src/i18n/en/caregiver-shell.json`, `nl/caregiver-shell.json`, `dashboard.json` (new namespaces)
  - Existing `apps/orchestrator/src/routes/_auth/patients/index.tsx` — refactor to use `<FilterableListPage>`
- **APIs**: zero new endpoints; consumes existing.
- **DB**: no schema changes.
- **Dependencies**: no new runtime deps; uses existing shadcn primitives.
- **Demo**: caregiver lands on a dashboard, sees admin nav iff admin; existing patient list looks identical but is built on the new scaffolding.
- **Chain position**: change #2 of the orchestrator-admin-ux chain.

## Risks and mitigations

- **R1 — dashboard tiles need real counts.** Implementing `Open care teams` etc. requires three small list calls (`GET /care-teams?is_open=true&count_only=true`, etc.). **Mitigation**: ship the dashboard with skeleton tiles backed by existing list endpoints' `total` field from `Page[T]`; no new endpoints. If a count is missing, render an em-dash, don't 500.
- **R2 — placeholder admin routes look like dead ends.** They will exist for a few PRs while #3–#5 land. **Mitigation**: render each placeholder with copy `Komt binnenkort — wordt geleverd door <spec-name>`; remove placeholder file in the spec that ships the real page.
- **R3 — `FilterableListPage` adopts a shape consumers later want to break.** Easy trap: over-generalise. **Mitigation**: only define slot props that two or more chain surfaces will use day-one (title, description, CTA, filters slot, table slot, empty slot). No "context", no render-props for the whole page.

## Out of scope

- Inbox surface (placeholder route + nav entry only; real inbox is post-chain).
- Realtime dashboard counts (initial render is on-demand; no WebSocket subscription).
- Permission system overhaul — role gating is the same `session.user.role === 'admin'` check used elsewhere.
- Anything UI for users/orgs/affiliations/care-teams (those are #3–#7).
