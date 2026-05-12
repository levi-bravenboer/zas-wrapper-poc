# smart-launch-stub Specification

## Purpose
TBD - created by archiving change orchestrator-app-shell. Update Purpose after archive.
## Requirements
### Requirement: SMART launch route parses query

The orchestrator SHALL expose a `/launch` route that validates SMART-on-FHIR launch params (`iss`, `launch`, `state` optional) via a Zod schema attached to the route's `validateSearch`. Invalid params MUST surface a localized error and not proceed.

#### Scenario: Valid params accepted

- **WHEN** a request hits `/launch?iss=https://hix.example/fhir&launch=abc123`
- **THEN** the route mounts, the params are typed, and the stored context is set via `useLaunchContext`'s setter

#### Scenario: Missing iss rejected

- **WHEN** a request hits `/launch?launch=abc123` without `iss`
- **THEN** the route renders a localized validation error and does NOT redirect

### Requirement: useLaunchContext hook

The `modules/smart-launch/` module SHALL export `useLaunchContext()` returning the current launch context object or `null` when no launch has occurred. The hook MUST be the only public surface for reading the launch context.

#### Scenario: No launch yet

- **WHEN** a component on a non-launch route calls `useLaunchContext()` before any `/launch` visit
- **THEN** it returns `null`

#### Scenario: After launch

- **WHEN** the `/launch` route has parsed valid params
- **THEN** `useLaunchContext()` returns `{ iss, launch, state? }`

### Requirement: exchangeAuthCode signature reserved

The module SHALL export an `exchangeAuthCode(code: string, state: string): Promise<LaunchContext>` function whose body throws `new Error('not-implemented')` for the POC. The signature MUST be stable so the real SMART change can fill it in without touching call sites.

#### Scenario: Stub throws explicitly

- **WHEN** any caller invokes `exchangeAuthCode('x','y')`
- **THEN** it throws an Error with message `'not-implemented'` and the stack points at the stub for easy grep

### Requirement: Redirect to placeholder after parsing

After successful param parse, the `/launch` route SHALL redirect to a placeholder destination (`/`) for the POC. The redirect target MUST be a single constant `LAUNCH_LANDING_PATH` so the next change can repoint it without scanning the codebase.

#### Scenario: Constant drives redirect

- **WHEN** the launch route succeeds
- **THEN** it navigates to `LAUNCH_LANDING_PATH` exported from `modules/smart-launch/constants.ts`

