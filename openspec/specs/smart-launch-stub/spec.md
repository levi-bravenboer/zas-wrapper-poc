# smart-launch-stub Specification

## Purpose
TBD - created by archiving change orchestrator-app-shell. Update Purpose after archive.
## Requirements
### Requirement: SMART launch route parses query

The orchestrator SHALL expose a `/launch` route that validates SMART-on-FHIR launch params (`iss`, `launch`, `state?`, plus a non-SMART `surface=smart|embed` and `return=<path>`) via a Zod schema attached to the route's `validateSearch`. Invalid params MUST surface a localized error and not proceed. The `surface` value MUST default to `smart` when absent.

#### Scenario: Valid params accepted

- **WHEN** a request hits `/launch?iss=https://hix.example/fhir&launch=abc123&surface=embed&return=/embed/tasks`
- **THEN** the route mounts, params are typed, the PKCE handshake starts, and after token exchange the user is redirected to `/embed/tasks`

#### Scenario: Missing iss rejected

- **WHEN** a request hits `/launch?launch=abc123` without `iss`
- **THEN** the route renders a localized validation error and does NOT redirect

#### Scenario: Surface defaults to smart

- **WHEN** a request hits `/launch?iss=...&launch=...` without `surface`
- **THEN** the launch flow proceeds with `surface=smart` and the eventual redirect targets `/s/`

### Requirement: useLaunchContext hook

The `platform/smart/` module SHALL export `useLaunchContext()` returning the current launch context object or `null` when no launch has occurred. The returned object MUST include at minimum `{ iss, launch, surface, returnPath }` and, after token exchange, `{ client, ctx, token }` so consumers (e.g. `SmartProvider`) can read the active SMART client. The hook MUST be the only public surface for reading the launch context.

#### Scenario: No launch yet

- **WHEN** a component on a non-launch route calls `useLaunchContext()` before any `/launch` visit
- **THEN** it returns `null`

#### Scenario: After token exchange

- **WHEN** the `/launch/callback` route has completed the PKCE exchange
- **THEN** `useLaunchContext()` returns `{ iss, launch, surface, returnPath, client, ctx, token }`

### Requirement: exchangeAuthCode signature reserved

The module SHALL export `exchangeAuthCode(code: string, state: string): Promise<LaunchContext>` that performs the OAuth 2.0 PKCE token exchange against the FHIR server's `token_endpoint`, retrieves the SMART context (`patient`, `encounter`, `user`, `fhirUser`, `scope`, `expires_in`), and returns the populated `LaunchContext`. Tokens MUST be held in the in-memory SMART store; PKCE state MUST be cleared from `sessionStorage` after a successful or failed exchange.

#### Scenario: Successful exchange populates context

- **WHEN** `exchangeAuthCode(code, state)` is called with valid code and verifier
- **THEN** the function resolves with a `LaunchContext` whose `client`, `ctx`, and `token` are populated
- **AND** subsequent `useSmart()` reads observe the same values

#### Scenario: Exchange clears PKCE state

- **WHEN** `exchangeAuthCode` resolves or rejects
- **THEN** any `sessionStorage` keys under the `smart-pkce` namespace are removed

#### Scenario: Failed exchange surfaces error

- **WHEN** the FHIR token endpoint returns a non-2xx response
- **THEN** the promise rejects with a typed `SmartExchangeError` and the launch route renders the localized error UI

### Requirement: Redirect to placeholder after parsing

After a successful token exchange, the `/launch/callback` route SHALL redirect to `${SURFACES[surface].basePath}${returnPath}` where `surface` and `returnPath` come from the launch context. When no `returnPath` was provided the redirect MUST target `${SURFACES[surface].basePath}/` (the surface's index route).

#### Scenario: Embed launch lands in embed surface

- **WHEN** the launch context has `surface='embed'` and `returnPath='/embed/tasks'`
- **THEN** the callback navigates to `/embed/tasks`

#### Scenario: Smart launch defaults to index

- **WHEN** the launch context has `surface='smart'` and no `returnPath`
- **THEN** the callback navigates to `/s/`

### Requirement: /launch/callback route handles PKCE return

The orchestrator SHALL add a `/launch/callback` route file under `routes/launch.callback.tsx` that:

- Validates `code`, `state`, and `error?` via Zod.
- Invokes `exchangeAuthCode(code, state)`.
- Stores the resulting `LaunchContext` in the in-memory SMART store.
- Redirects to the surface-aware destination defined by the `Redirect to placeholder after parsing` requirement.

The route MUST NOT render UI in the steady state; it MUST show only a localized "Bezig met inloggen…" indicator while the exchange is pending.

#### Scenario: Callback completes flow

- **WHEN** the EPD redirects the browser to `/launch/callback?code=abc&state=xyz`
- **THEN** the route exchanges the code, stores the context, and navigates to the surface-aware destination

#### Scenario: Callback surfaces provider error

- **WHEN** the EPD redirects with `?error=access_denied`
- **THEN** the route renders a localized error UI with a "Probeer opnieuw" action and does NOT call `exchangeAuthCode`

