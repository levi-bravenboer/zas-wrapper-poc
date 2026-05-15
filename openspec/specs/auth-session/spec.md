# auth-session Specification

## Purpose
TBD - created by archiving change orchestrator-app-shell. Update Purpose after archive.
## Requirements
### Requirement: POC username/password login

The orchestrator SHALL render a `/login` route that drives its login affordances off the `GET /auth/providers` response. For each provider returned by the discovery endpoint, the screen MUST mount the strategy registered for the provider's `kind`. The PoC ships exactly one strategy, `PasswordStrategy`, used for the `password` provider; it renders the existing styled email + password form. The form's email field MUST be validated by Zod as `z.string().email().min(1).max(256)`; the password field MUST be `.min(1).max(256)`. Submission MUST call `POST /auth/login/password` through the shared `openapi-fetch` client (typed against the regenerated `schema.d.ts`) with `credentials: 'include'` and body `{ email, password }`. On success the form MUST navigate to a same-origin `?redirect=` target when present, otherwise to `/`. The form's existing visual layout and styling MUST NOT change as part of this requirement — only submit behaviour, validation, and inline error rendering are added.

#### Scenario: Successful password login navigates to default destination

- **WHEN** the user submits valid credentials and `?redirect=` is absent
- **THEN** the frontend sends `POST /auth/login/password` with `{ email, password }`, receives `200` with a `Set-Cookie: BACKEND_SESSION=...; HttpOnly; SameSite=Lax; Path=/` header
- **AND** the app writes the returned `SessionUser` into the `authKeys.me()` query cache and navigates to `/` with `replace: true`

#### Scenario: Successful password login honours same-origin redirect

- **WHEN** the user submits valid credentials and the URL carries `?redirect=/patients/abc123`
- **THEN** the app navigates to `/patients/abc123` with `replace: true` after the `200` response
- **AND** the original `/login?redirect=...` entry is removed from history

#### Scenario: Redirect to non-same-origin or malformed target is dropped

- **WHEN** `?redirect=` does not start with `/`, starts with `//`, contains `\`, OR resolves to `/login`
- **THEN** the app navigates to `/` instead and never attempts the supplied target

#### Scenario: Invalid credentials

- **WHEN** the backend responds `401`
- **THEN** the form shows the localized error "Ongeldige inloggegevens" via a `<p role="alert">` rendered below the submit button
- **AND** the password field is cleared while the email field retains its value

#### Scenario: Network or 5xx failure

- **WHEN** the request fails or returns `5xx`
- **THEN** the form shows the localized "Er ging iets mis, probeer opnieuw" error via the same `role="alert"` element and stays mounted with both fields preserved

#### Scenario: Client-side validation gates submission

- **WHEN** the email field is empty, fails `z.string().email()`, or the password field is empty
- **THEN** the submit button MUST NOT issue a network request and inline field-level errors render in the existing label slots

### Requirement: Session query

The auth module SHALL expose a `useSession()` hook that wraps a TanStack Query for `GET /auth/me`. The query key MUST be stable (`['auth','me']`). A `401` response MUST resolve the query to `null`, never to an error. The query function MUST go through the shared `openapi-fetch` client and the response MUST be parsed against the `SessionUser` Zod schema before being returned.

#### Scenario: Authed user

- **WHEN** `GET /auth/me` returns `200` with `{ id, email, display_name, tenant_id, role }`
- **THEN** `useSession()` returns `{ data: user, isPending: false }` where `user` matches the parsed `SessionUser` shape

#### Scenario: Anonymous user

- **WHEN** `GET /auth/me` returns `401`
- **THEN** `useSession()` returns `{ data: null, isPending: false }` and does NOT enter an error state

### Requirement: Logout clears client state

The auth module SHALL expose a `useLogout()` mutation that calls `POST /auth/logout` and on success resets the Query cache via `queryClient.clear()` then navigates to `/login` using the router instance. The navigation MUST happen inside the mutation's `onSuccess` callback (not inside a component effect), so triggering logout from any context produces the same outcome.

#### Scenario: Logout from authed UI

- **WHEN** an authed user triggers logout from any route
- **THEN** the frontend sends `POST /auth/logout`, clears the Query cache, and the router navigates to `/login`
- **AND** the cache is cleared before the navigation so the next render cannot read a stale user

#### Scenario: Logout when offline or backend errors

- **WHEN** `POST /auth/logout` rejects (network or 5xx)
- **THEN** the cache is NOT cleared and the user remains on the current route
- **AND** the calling UI receives the error to surface a toast

### Requirement: One-shot 401 retry

The shared API client SHALL retry a request once on `401` by re-fetching `/auth/me`. If the retry confirms no session, the client MUST NOT retry further and the calling code SHALL surface the error to its route boundary.

#### Scenario: Stale cookie revalidated

- **WHEN** a request returns `401` but the user's cookie is still valid (race after refresh)
- **THEN** the client refetches `/auth/me`, observes a valid session, and retries the original request once

#### Scenario: Genuinely unauthenticated

- **WHEN** `/auth/me` also returns `401`
- **THEN** the client does NOT retry the original request and propagates the `401` to the caller

### Requirement: Guard reads session through cache

Route guards SHALL read the current session via the shared React Query cache, not by calling `fetch` directly. The auth module MUST expose a `requireSession(queryClient)` helper that wraps `queryClient.ensureQueryData({ queryKey: authKeys.me(), queryFn: fetchSession, staleTime: 60_000 })`. `_auth.tsx` `beforeLoad` MUST consume this helper via the router context.

#### Scenario: Fresh cache skips network

- **WHEN** a user navigates between two `_auth` child routes within `staleTime`
- **THEN** the guard resolves from the cached session without firing a new `GET /auth/me`

#### Scenario: Stale cache refetches

- **WHEN** the cached session is older than `staleTime` and the user navigates to a guarded route
- **THEN** the guard refetches `/auth/me` once and proceeds with the fresh result

#### Scenario: Null session redirects

- **WHEN** `requireSession` resolves to `null` (401 from `/auth/me`)
- **THEN** the guard throws `redirect({ to: '/login', search: { redirect: <current href> } })` before the route component mounts

### Requirement: Provider discovery drives the login screen

The orchestrator SHALL expose a `useProviders()` hook that wraps a TanStack Query for `GET /auth/providers`. The query key MUST be `['auth', 'providers']` and the query MUST be cached with `staleTime: Infinity` (the provider list is deploy-time configuration). The `/login` route component MUST consume the hook and render, for each returned provider, the strategy registered in `modules/auth/providers.ts` for that provider's `kind`. The frontend MUST NOT hard-code the provider list; the list comes exclusively from the discovery endpoint.

#### Scenario: PoC renders only the password strategy

- **WHEN** `GET /auth/providers` returns a single entry with `kind: 'password'`
- **THEN** the `/login` route renders exactly the `PasswordStrategy` (the existing form) with no other affordances visible

#### Scenario: Loading state

- **WHEN** `GET /auth/providers` has not yet resolved
- **THEN** the `/login` route renders a skeleton placeholder that does not shift layout when the providers resolve

#### Scenario: Empty provider list surfaces an error

- **WHEN** `GET /auth/providers` returns `[]`
- **THEN** the `/login` route renders a localized error message ("Geen inlogmethode beschikbaar — neem contact op met de beheerder") and does NOT render any input fields

#### Scenario: Discovery failure surfaces a retry affordance

- **WHEN** `GET /auth/providers` fails with a network error or 5xx
- **THEN** the `/login` route renders a localized retry message and a button that re-runs the query; no input fields are rendered until providers resolve successfully

### Requirement: Provider strategy registry

The orchestrator SHALL expose a strategy registry in `apps/orchestrator/src/modules/auth/providers.ts` keyed by the provider `kind`. The PoC registry MUST contain exactly one entry mapping `'password'` to the `PasswordStrategy` component. The login route MUST look up strategies by `kind` and MUST NOT switch on `key` — adding a new password-shaped provider (e.g., a future `password+totp`) MUST work without route-component edits, and adding a new OIDC provider at MVP MUST require only registering an OIDC strategy and an additional discovery entry.

#### Scenario: Strategy resolved by kind

- **WHEN** the login route receives a provider with `kind: 'password'` from discovery
- **THEN** the route MUST render the `PasswordStrategy` regardless of the provider's `key` value

#### Scenario: Unknown kind logs and skips

- **WHEN** the discovery endpoint returns a provider whose `kind` has no registered strategy (e.g., `'oidc'` in PoC)
- **THEN** the route MUST log a console warning identifying the unknown kind and MUST skip rendering that provider entry (other providers still render)

### Requirement: SessionUser client shape mirrors backend

The frontend `SessionUser` Zod schema in `apps/orchestrator/src/modules/auth/schemas.ts` SHALL define exactly the fields `id` (string), `email` (string, email shape), `display_name` (string), `tenant_id` (string), and `role` (one of `'admin' | 'caregiver' | 'external'`). No additional fields and no renamed fields. The schema MUST be the single client-side source of truth and MUST be consumed by `api.ts`, `hooks.ts`, `guard.ts`, and any UI code that reads the session user.

#### Scenario: Schema parses a backend response

- **WHEN** the backend returns `{ "id": "...uuid...", "email": "caregiver@zas.local", "display_name": "Demo Caregiver", "tenant_id": "...uuid...", "role": "caregiver" }`
- **THEN** the `SessionUser` Zod schema parses the body without error and produces a strongly-typed object with those exact fields

#### Scenario: Schema rejects unknown role

- **WHEN** the backend returns `"role": "patient"`
- **THEN** the Zod parse fails and the failure propagates to the calling hook's error path

### Requirement: MSW handlers mirror the real auth contract

When the orchestrator runs with `VITE_API_MODE=mock` or under Vitest, the MSW handlers in `apps/orchestrator/src/mocks/handlers/auth.ts` SHALL implement the same request and response shapes as the real backend: `GET /auth/providers` MUST return the PoC provider list (a single `password` entry); `POST /auth/login/password` MUST accept `{ email, password }` and return the `SessionUser` shape on success; `GET /auth/me` MUST return the same `SessionUser` shape or `401`; `POST /auth/logout` MUST clear the in-memory session flag and return `204`. The handlers MUST recognise `caregiver@zas.local` + `changeme` as the happy-path credential and respond `401` for any other email or password.

#### Scenario: Mock providers match real shape

- **WHEN** a test fetches the mocked `GET /auth/providers`
- **THEN** the response body parses against the `ProviderDescriptor` shape with exactly the fields `key`, `label`, `kind`

#### Scenario: Mock login matches real shape

- **WHEN** a test posts `{ email: "caregiver@zas.local", password: "changeme" }` to the mocked `POST /auth/login/password`
- **THEN** the response body parses against the `SessionUser` Zod schema and the response carries a `Set-Cookie` header

#### Scenario: Mock rejects unknown credentials

- **WHEN** a test posts an unknown email or wrong password
- **THEN** the mocked response is `401` with an `ErrorResponse`-shaped body and no `Set-Cookie` header

