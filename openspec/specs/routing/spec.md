# routing Specification

## Purpose
TBD - created by archiving change orchestrator-app-shell. Update Purpose after archive.
## Requirements
### Requirement: File-based TanStack Router

The orchestrator SHALL use `@tanstack/react-router` with the Vite plugin generating a route tree from `src/routes/`. Route files MUST default-export a route via `createFileRoute`. The generated `routeTree.gen.ts` MUST be git-ignored and produced on dev/build.

#### Scenario: Route added by file creation

- **WHEN** a developer creates `src/routes/dashboard.tsx` exporting `createFileRoute('/dashboard')({ component: Dashboard })`
- **THEN** navigating to `/dashboard` renders the `Dashboard` component without any manual route registration

#### Scenario: Routetree is generated, not committed

- **WHEN** the repo is cloned fresh and `moon run orchestrator:dev` starts
- **THEN** `src/routeTree.gen.ts` is produced by the Vite plugin
- **AND** the file is listed in `.gitignore`

### Requirement: Type-safe search params

Route search parameters SHALL be validated with Zod schemas attached to the route via `validateSearch`. Consumers MUST read params through the typed `useSearch` hook, never from `window.location`.

#### Scenario: Invalid search param rejected

- **WHEN** a user navigates to `/launch?iss=&launch=abc` and the schema requires a non-empty `iss`
- **THEN** the router throws a validation error caught by the route's error boundary

#### Scenario: Typed search exposed to component

- **WHEN** a route declares `validateSearch: z.object({ tab: z.enum(['a','b']).default('a') })`
- **THEN** `useSearch({ from: '...' })` returns `{ tab: 'a' | 'b' }` without manual narrowing

### Requirement: Authenticated route guard

Routes under `src/routes/_auth/` SHALL require an active session. The guard MUST call `useSession()` in a `beforeLoad`, and redirect unauthenticated users to `/login` with the original URL preserved as a `redirect` search param.

#### Scenario: Unauthenticated user hits guarded route

- **WHEN** a user with no session opens `/dashboard`
- **THEN** the router redirects to `/login?redirect=%2Fdashboard`

#### Scenario: Login restores intended destination

- **WHEN** a user logs in successfully from `/login?redirect=%2Fdashboard`
- **THEN** the app navigates to `/dashboard` after the `useSession` query resolves with a user

### Requirement: Typed router context

The router instance SHALL be created with a typed `context` object containing at minimum `{ queryClient: QueryClient }`. The context MUST be supplied at router construction (not at `RouterProvider` mount time) so it is available inside `beforeLoad`. The router module MUST declare `interface Register { router: typeof router }` against `@tanstack/react-router` so route files get full context typing without per-route generics.

#### Scenario: Guard reads queryClient from context

- **WHEN** a route's `beforeLoad` destructures `({ context })`
- **THEN** TypeScript narrows `context.queryClient` to `QueryClient` with no `unknown` fallthrough

#### Scenario: Single router instance per app

- **WHEN** the app boots
- **THEN** `createRouter` is called exactly once and the resulting router is reused across `<RouterProvider />` and any imperative `router.navigate()` callers (e.g. `useLogout`)

### Requirement: Authed section routes

The `_auth` segment SHALL host five sibling section routes — `/dashboard`, `/taken`, `/zorgpaden`, `/patienten`, `/instellingen` — each as its own file under `src/routes/_auth/`. All five MUST inherit the guard from `_auth.tsx` and the shared layout from `AppLayout`. Route paths MUST stay in lowercase Dutch (no English aliases).

#### Scenario: Section route inherits guard

- **WHEN** an unauthenticated user opens `/patienten`
- **THEN** the `_auth` guard redirects to `/login?redirect=%2Fpatienten`

#### Scenario: Section route inherits layout

- **WHEN** an authed user opens `/zorgpaden`
- **THEN** the rendered tree is `AppLayout` → section content
- **AND** the sidebar is present in the DOM

### Requirement: Authed root redirects to dashboard

The `/` path SHALL redirect authed users to `/dashboard` rather than rendering content. The redirect MUST happen in `beforeLoad` of `_auth/index.tsx` so it occurs before any component renders. Unauthenticated visitors to `/` MUST still fall through the guard to `/login` per the existing rule.

#### Scenario: Authed user hits root

- **WHEN** an authed user opens `/`
- **THEN** the router replaces the URL with `/dashboard` before mounting any page component

#### Scenario: Unauthenticated user hits root

- **WHEN** a user with no session opens `/`
- **THEN** the `_auth` guard wins first and redirects to `/login?redirect=%2F`

