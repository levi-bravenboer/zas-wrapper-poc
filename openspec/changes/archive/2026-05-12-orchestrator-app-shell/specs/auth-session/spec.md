## ADDED Requirements

### Requirement: POC username/password login

The orchestrator SHALL render a `/login` route with a username + password form validated by Zod (non-empty, max 256 chars). Submitting MUST call `POST /auth/login` via `openapi-fetch` with `credentials: 'include'`.

#### Scenario: Successful login

- **WHEN** the user submits valid credentials
- **THEN** the frontend sends `POST /auth/login` with the JSON body, receives `200` with a `Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict` header
- **AND** the app invalidates the `session` query and redirects to the post-login destination

#### Scenario: Invalid credentials

- **WHEN** the backend responds `401`
- **THEN** the form shows the localized error "ongeldige gebruikersnaam of wachtwoord"
- **AND** the password field is cleared

#### Scenario: Network or 5xx failure

- **WHEN** the request fails or returns `5xx`
- **THEN** the form shows the localized "er ging iets mis, probeer opnieuw" error and stays mounted

### Requirement: Session query

The auth module SHALL expose a `useSession()` hook that wraps a TanStack Query for `GET /auth/me`. The query key MUST be stable (`['auth','me']`). A `401` response MUST resolve the query to `null`, never to an error.

#### Scenario: Authed user

- **WHEN** `GET /auth/me` returns `200` with `{ id, email, displayName, roles }`
- **THEN** `useSession()` returns `{ data: user, isPending: false }`

#### Scenario: Anonymous user

- **WHEN** `GET /auth/me` returns `401`
- **THEN** `useSession()` returns `{ data: null, isPending: false }` and does NOT enter an error state

### Requirement: Logout clears client state

The auth module SHALL expose a `useLogout()` mutation that calls `POST /auth/logout` and on success resets the Query cache via `queryClient.clear()` then redirects to `/login`.

#### Scenario: Logout from authed UI

- **WHEN** an authed user triggers logout
- **THEN** the frontend sends `POST /auth/logout`, clears the Query cache, and navigates to `/login`

### Requirement: One-shot 401 retry

The shared API client SHALL retry a request once on `401` by re-fetching `/auth/me`. If the retry confirms no session, the client MUST NOT retry further and the calling code SHALL surface the error to its route boundary.

#### Scenario: Stale cookie revalidated

- **WHEN** a request returns `401` but the user's cookie is still valid (race after refresh)
- **THEN** the client refetches `/auth/me`, observes a valid session, and retries the original request once

#### Scenario: Genuinely unauthenticated

- **WHEN** `/auth/me` also returns `401`
- **THEN** the client does NOT retry the original request and propagates the `401` to the caller
