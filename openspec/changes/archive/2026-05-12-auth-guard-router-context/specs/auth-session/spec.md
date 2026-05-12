## ADDED Requirements

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

## MODIFIED Requirements

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
