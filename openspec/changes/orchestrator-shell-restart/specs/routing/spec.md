## MODIFIED Requirements

### Requirement: Authed section routes

The `_auth` segment SHALL host exactly one section route in PoC: `/dashboard`, implemented as `src/routes/_auth/dashboard.tsx`. The route MUST inherit the guard from `_auth.tsx` and the shared layout from `Shell`. The previously specified siblings (`/taken`, `/zorgpaden`, `/patienten`, `/instellingen`) are removed from this requirement; each MUST be reintroduced through its own OpenSpec change at the time its feature work begins. Route paths added in the future MUST stay in lowercase Dutch (no English aliases).

#### Scenario: Single section route in PoC

- **WHEN** the generated `routeTree.gen.ts` is read
- **THEN** the only route file under `src/routes/_auth/` (besides `_auth.tsx` and `index.tsx`) is `dashboard.tsx`

#### Scenario: Dashboard inherits guard and shell

- **WHEN** an unauthenticated user opens `/dashboard`
- **THEN** the `_auth` guard redirects to `/login?redirect=%2Fdashboard`

- **WHEN** an authed user opens `/dashboard`
- **THEN** the rendered tree is `Shell` → Dashboard content
- **AND** the sidebar is present in the DOM

#### Scenario: Reintroducing a dropped route requires a change

- **WHEN** a PR adds `src/routes/_auth/patienten.tsx`
- **THEN** an OpenSpec change naming the new route MUST exist before the file is merged

## ADDED Requirements

### Requirement: Breadcrumb data via route staticData

Routes that render below depth 2 (root + auth wrap + content) SHALL declare their breadcrumb label as either `staticData: { breadcrumb: string }` on the route definition, or as a `crumb` field returned from the route's loader. The `PageHeader` component reads these and auto-renders the crumb path. Routes MUST NOT pass a `breadcrumb` prop to `PageHeader` manually — the path is derived from route matches only.

#### Scenario: staticData crumb surfaces

- **WHEN** a route declares `staticData: { breadcrumb: 'Patiënt' }`
- **THEN** the crumb segment for that match reads "Patiënt" in the rendered breadcrumb

#### Scenario: Loader crumb surfaces

- **WHEN** a route's loader returns `{ crumb: 'De Smet, J.' }`
- **THEN** the crumb segment for that match reads "De Smet, J."

#### Scenario: Missing crumb is skipped, not derived from URL

- **WHEN** a route has neither `staticData.breadcrumb` nor a loader `crumb`
- **THEN** the breadcrumb skips that segment (no URL slug, no `_auth` literal, no fallback string)
