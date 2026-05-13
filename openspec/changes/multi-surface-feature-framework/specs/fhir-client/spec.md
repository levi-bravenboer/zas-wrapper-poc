## ADDED Requirements

### Requirement: SmartProvider exposes FHIR client and context

The orchestrator SHALL provide a `SmartProvider` at `@/platform/smart/SmartProvider` that wraps a SMART-on-FHIR client. The provider MUST expose `{ client, ctx, token }` via a context where:

- `client` is a `fhirclient`-backed client instance.
- `ctx` is the parsed SMART context `{ patient?, encounter?, user? }`.
- `token` is the access token returned by `fhirclient.oauth2.ready()`.

The provider MUST throw a typed `SmartTokenMissingError` on mount when no token is available. The route boundary is responsible for translating the error into a re-launch redirect.

#### Scenario: Provider supplies client and ctx to subtree

- **WHEN** a SMART launch has completed and `SmartProvider` mounts
- **THEN** subtree consumers receive the populated `{ client, ctx, token }` via the `FhirDeps` context

#### Scenario: Provider throws on missing token

- **WHEN** `SmartProvider` mounts and no launch context exists in memory
- **THEN** it throws `SmartTokenMissingError('SMART token missing — relaunch required')`

### Requirement: SMART hooks for context

The platform SHALL expose `useLaunchContext()` returning the in-memory launch state (`{ iss, launch, surface, returnPath, client, token, ctx } | null`). The hook MUST be a thin selector over the launch store and MUST not throw — consumers branch on `null` themselves.

#### Scenario: useLaunchContext returns populated launch state

- **WHEN** `useLaunchContext()` is called after a successful `exchangeAuthCode()`
- **THEN** the hook returns the populated `LaunchContext` including `client`, `token`, and `ctx`

#### Scenario: useLaunchContext returns null before launch

- **WHEN** `useLaunchContext()` is called before any launch has happened
- **THEN** the hook returns `null`

### Requirement: PoC FHIR adapters return stub data

For the PoC, feature FHIR adapters (e.g. `fhirTasksPort`) SHALL return static stub data and MUST NOT call `client.request(...)` directly inside pages. Resource-level zod validation, pagination helpers (`fhirPager`), and the FHIR query/mutation wrappers (`useFhirQuery`/`useFhirMutation`) are explicitly out of scope for this change and are deferred to a follow-on FHIR-integration change once real EPD wiring is scheduled.

#### Scenario: Stub adapter satisfies the port contract

- **WHEN** `tasksFeature` mounts under `SmartShell` or `EmbedShell` with a populated `FhirDeps`
- **THEN** `fhirTasksPort.list()` returns the static stub rows and the page renders without hitting any FHIR endpoint
