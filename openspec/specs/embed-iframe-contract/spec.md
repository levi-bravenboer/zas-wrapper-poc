# embed-iframe-contract Specification

## Purpose
TBD - created by archiving change multi-surface-feature-framework. Update Purpose after archive.
## Requirements
### Requirement: Embed surface served with frame-ancestors CSP

Responses serving `/embed/**` HTML SHALL include a `Content-Security-Policy` header with `frame-ancestors <hix-origin>` where `<hix-origin>` is resolved at deploy time from `EMBED_FRAME_ANCESTORS` environment variable. The header MUST NOT include `X-Frame-Options: DENY`. Multiple allowed origins MUST be space-separated within the single directive.

#### Scenario: Header present in embed response

- **WHEN** a request to `/embed/tasks` is served
- **THEN** the response carries `Content-Security-Policy: frame-ancestors https://hix.example.org`
- **AND** no `X-Frame-Options` header is present

#### Scenario: Non-embed routes unaffected

- **WHEN** a request to `/dashboard` is served
- **THEN** no `frame-ancestors` directive is applied

### Requirement: SMART tokens stored only in memory

In the `embed` surface, SMART access tokens and refresh tokens MUST live in an in-memory store (e.g. a Zustand store kept in `platform/smart/`). They MUST NOT be written to `localStorage`. PKCE state and verifier MAY be stored in `sessionStorage` for the duration of the authorization round-trip and MUST be cleared immediately after token exchange.

#### Scenario: Reload re-launches

- **WHEN** the user reloads `/embed/tasks` after the iframe was previously authenticated
- **THEN** the in-memory token is gone, `SmartProvider` re-triggers the launch flow with `surface=embed`

#### Scenario: PKCE state cleared after exchange

- **WHEN** `/launch/callback` completes the token exchange successfully
- **THEN** any `sessionStorage` keys under the `smart-pkce` namespace are removed

### Requirement: Host postMessage protocol

The platform SHALL provide a typed host bridge module at `@/platform/embed/host` with messages:

- Outbound from app to host: `{ type: 'ready' }`, `{ type: 'resize', height: number }`, `{ type: 'navigate', path: string }`, `{ type: 'close' }`, `{ type: 'error', code: string, message: string }`.
- Inbound from host to app: `{ type: 'theme', payload: ThemeTokens }`, `{ type: 'context-update', payload: SmartContextPatch }`.

Every inbound message MUST be rejected unless `event.origin` matches `EMBED_HOST_ORIGIN` env var. Outbound messages MUST target `window.parent` with the same origin string.

#### Scenario: Origin verified inbound

- **WHEN** a `postMessage` arrives from origin `https://attacker.example`
- **THEN** the handler ignores it and logs to the no-op reporter

#### Scenario: Ready message sent on mount

- **WHEN** `EmbedShell` mounts
- **THEN** `postMessage({ type: 'ready' }, EMBED_HOST_ORIGIN)` is sent to `window.parent`

#### Scenario: Resize observer drives resize message

- **WHEN** the embed content height changes
- **THEN** a `{ type: 'resize', height }` message is sent, throttled to once per animation frame

### Requirement: Embed surface uses memory history when host swallows URL

`EmbedShell` SHALL detect when running inside an iframe (`window !== window.parent`) and configure the router with `createMemoryHistory` rather than the default browser history. Internal navigation MUST emit a `navigate` host message so the EPD can update its own breadcrumb if desired.

#### Scenario: Memory history used in iframe

- **WHEN** `EmbedShell` mounts inside an iframe
- **THEN** `createRouter` is called with `history: createMemoryHistory(...)`

#### Scenario: Navigate message emitted

- **WHEN** the user clicks a link inside the embed that routes to `/embed/patients/123`
- **THEN** the embed sends `postMessage({ type: 'navigate', path: '/embed/patients/123' }, EMBED_HOST_ORIGIN)`

### Requirement: Embed bundle isolation

The Vite config SHALL emit a separate chunk that contains the embed shell, SMART provider, FHIR utilities, and embeddable feature modules. The embed chunk MUST NOT include React Query devtools, TanStack Router devtools, the orchestrator sidebar/topbar, or any orchestrator-only feature.

#### Scenario: Embed chunk excludes devtools

- **WHEN** the production bundle for `/embed/*` is inspected
- **THEN** no `@tanstack/react-query-devtools` or `@tanstack/react-router-devtools` symbols are present

#### Scenario: Embed chunk excludes sidebar

- **WHEN** the production bundle for `/embed/*` is inspected
- **THEN** the `Sidebar` component is not part of the chunk

