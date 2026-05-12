## ADDED Requirements

### Requirement: Typed router context

The router instance SHALL be created with a typed `context` object containing at minimum `{ queryClient: QueryClient }`. The context MUST be supplied at router construction (not at `RouterProvider` mount time) so it is available inside `beforeLoad`. The router module MUST declare `interface Register { router: typeof router }` against `@tanstack/react-router` so route files get full context typing without per-route generics.

#### Scenario: Guard reads queryClient from context

- **WHEN** a route's `beforeLoad` destructures `({ context })`
- **THEN** TypeScript narrows `context.queryClient` to `QueryClient` with no `unknown` fallthrough

#### Scenario: Single router instance per app

- **WHEN** the app boots
- **THEN** `createRouter` is called exactly once and the resulting router is reused across `<RouterProvider />` and any imperative `router.navigate()` callers (e.g. `useLogout`)
