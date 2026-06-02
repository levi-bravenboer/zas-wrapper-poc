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

The `_auth` segment SHALL host clinical section routes generated from the feature registry (e.g. `/dashboard`, `/tasks`, `/pathways`, `/patients`, `/settings`). Each section MUST be one file under `apps/orchestrator/src/routes/_auth/` whose body is a single `renderFeature(spec)` call (with the exception of `/dashboard` which MAY remain hand-written until it is migrated to a feature module). All `_auth` section routes MUST inherit the guard from `_auth.tsx` and the `AppShell` layout. Route file names and route IDs MUST use English identifiers (kebab-case). Dutch text MUST live only in i18n values.

#### Scenario: Section route inherits guard

- **WHEN** an unauthenticated user opens `/patients`
- **THEN** the `_auth` guard redirects to `/login?redirect=%2Fpatients`

#### Scenario: Section route inherits layout

- **WHEN** an authed user opens `/pathways`
- **THEN** the rendered tree is `AppShell` → section content
- **AND** the sidebar is present in the DOM

#### Scenario: English identifiers enforced

- **WHEN** a contributor adds `routes/_auth/taken.tsx`
- **THEN** lint or codegen rejects the filename because the registry resolves feature paths to English ids

### Requirement: Authed root redirects to dashboard

The `/` path SHALL redirect authed users to `/dashboard` rather than rendering content. The redirect MUST happen in `beforeLoad` of `_auth/index.tsx` so it occurs before any component renders. Unauthenticated visitors to `/` MUST still fall through the guard to `/login` per the existing rule.

#### Scenario: Authed user hits root

- **WHEN** an authed user opens `/`
- **THEN** the router replaces the URL with `/dashboard` before mounting any page component

#### Scenario: Unauthenticated user hits root

- **WHEN** a user with no session opens `/`
- **THEN** the `_auth` guard wins first and redirects to `/login?redirect=%2F`

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

### Requirement: Login route PoC behaviour

The `/login` route SHALL be implemented at `src/routes/login.tsx` and render the Minimal Login Layout defined in the `design-system` delta (aurora background, centered column, ZAS mark, email + password inputs, single primary teal CTA, no card chrome, no remember-me, no forgot-password). In this change the submit handler MUST NOT validate inputs, MUST NOT call an auth endpoint, and MUST navigate to `/` via TanStack Router unconditionally — the handler exists only so the screen can be built and end-to-end navigated. The real wiring (frontend field validation, `useLogin` mutation against the hard-coded user table, cookie-session round-trip, `?redirect=` honouring, failure-state rendering) is explicitly out of scope here and is tracked on the `[poc]` roadmap under `BL-035` (F1 user + auth domain). The `/login` route MUST NOT be reachable on the `embed` surface — HiX provides its own authentication context for embedded use.

#### Scenario: Submit navigates without validating

- **WHEN** an unauthenticated user opens `/login`, leaves both fields empty, and clicks the primary CTA
- **THEN** the router navigates to `/`
- **AND** no network request is issued to an auth endpoint
- **AND** no validation error is rendered

#### Scenario: Login uses minimal layout

- **WHEN** the login route renders
- **THEN** no `Card` element wraps the form
- **AND** the aurora layer is visible behind the form
- **AND** no "Wachtwoord vergeten" or "Onthoud mij" element is present

#### Scenario: Login unreachable on embed surface

- **WHEN** a user opens `/embed/login` or any `/login` variant under the embed base path
- **THEN** the route does not resolve (404 or surface redirect)
- **AND** the embed surface does not register a `/login` route file

#### Scenario: Validation is a follow-up change

- **WHEN** a future PR adds input validation, credential exchange, or a redirect target to the login submit handler
- **THEN** that PR MUST be backed by `BL-035` (F1 user + auth domain) or a successor OpenSpec change that updates this requirement

### Requirement: Surface-prefixed route segments

The orchestrator SHALL host clinical pages under three surface segments matching the surface registry: `routes/_auth/<id>.tsx`, `routes/_smart/<id>.tsx`, and `routes/_embed/<id>.tsx`. The `_smart` segment MUST be guarded by a SMART context guard and wrap content in `SmartShell`; the `_embed` segment MUST wrap content in `EmbedShell`; the `_auth` segment continues to wrap content in `AppShell`. Each `<id>.tsx` file MUST exist if and only if the corresponding feature's `surfaces` array includes that surface.

#### Scenario: Embed route renders without sidebar

- **WHEN** a SMART-authenticated user opens `/embed/tasks`
- **THEN** the route renders `EmbedShell → renderFeature(tasksFeature)` with no `Sidebar` element

#### Scenario: Smart route requires SMART context

- **WHEN** a user opens `/s/tasks` without a SMART token in memory
- **THEN** the `_smart` guard redirects to `/launch?surface=smart&return=/s/tasks`

#### Scenario: Route file presence matches feature surfaces

- **WHEN** `tasksFeature.surfaces = ['app', 'embed']`
- **THEN** `routes/_auth/tasks.tsx` and `routes/_embed/tasks.tsx` exist
- **AND** `routes/_smart/tasks.tsx` does NOT exist

### Requirement: Route stubs derived from feature registry

Every route file under `routes/_auth/<id>.tsx`, `routes/_smart/<id>.tsx`, and `routes/_embed/<id>.tsx` for an embeddable feature SHALL contain only a `createFileRoute` call whose `component` is `renderFeature(spec)`. The stub MUST be produced by `pnpm gen:feature` and MUST NOT be hand-edited beyond import additions emitted by the generator. The router MUST resolve the feature's `path` from the spec; hand-typing a path string different from `spec.path` is forbidden.

#### Scenario: Stub body is one line

- **WHEN** a generated route stub for `tasks` under `_embed` is opened
- **THEN** its `Route` export consists of `createFileRoute('/_embed/tasks')({ component: renderFeature(tasksFeature) })` and no additional logic

#### Scenario: Hand-edited stub flagged by lint

- **WHEN** a stub file has any code other than the imports and the `Route` export
- **THEN** a custom eslint rule reports a violation pointing to the file

