## ADDED Requirements

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
