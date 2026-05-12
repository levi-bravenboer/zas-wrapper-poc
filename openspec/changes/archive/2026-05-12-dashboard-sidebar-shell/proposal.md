## Why

Authed landing today is a placeholder card with no chrome. Clinicians need a persistent sidebar to move between work surfaces (Dashboard, Taken, Zorgpaden, Mijn patiënten, Instellingen) without losing context. June demo flow requires this scaffolding before pathway composer can land.

## What Changes

- Add a persistent left sidebar layout for all authenticated routes
- Add five nav entries with Dutch labels: Dashboard, Taken, Zorgpaden, Mijn patiënten, Instellingen
- Add Lucide icons per entry (Home, ListTodo, Workflow, Users, Settings)
- Highlight the active nav item based on current route match
- Replace `_auth/index.tsx` placeholder with a real Dashboard page route at `/dashboard`; redirect `/` → `/dashboard` for authed users
- Add placeholder route stubs for `/taken`, `/zorgpaden`, `/patienten`, `/instellingen` under the auth guard
- Add i18n keys (namespace `nav`) for every label
- Add a `Sidebar` component under `src/components/layout/` (cross-module → lives in `components/`, not `modules/`)
- Add tests: sidebar renders all items, active state reflects current route, nav redirects work

## Capabilities

### New Capabilities

- `dashboard-shell`: Persistent authed layout (sidebar + main content area) and the route surfaces it hosts (dashboard + section placeholders).

### Modified Capabilities

- `routing`: The `_auth` segment now mounts a shared sidebar layout instead of a bare passthrough, and adds five child routes (`/dashboard`, `/taken`, `/zorgpaden`, `/patienten`, `/instellingen`) with `/` redirecting to `/dashboard`.
- `i18n`: Adds a new `nav` translation namespace covering all sidebar labels.

## Impact

- **Code**: `src/routes/_auth.tsx`, `src/routes/_auth/index.tsx`, new `_auth/dashboard.tsx`, `_auth/taken.tsx`, `_auth/zorgpaden.tsx`, `_auth/patienten.tsx`, `_auth/instellingen.tsx`. New `src/components/layout/Sidebar.tsx`, `AppLayout.tsx`.
- **i18n**: New `src/lib/i18n/locales/nl/nav.json`; namespace registered in `i18n/index.ts`.
- **Tests**: New unit tests for `Sidebar`, integration test for layout active-state, update existing smoke E2E to land on `/dashboard`.
- **Dependencies**: `lucide-react` already installed; no new runtime deps.
- **Docs**: Update `apps/orchestrator/README.md` route table + `apps/orchestrator/AGENTS.md` folder rules to note `components/layout/`.
