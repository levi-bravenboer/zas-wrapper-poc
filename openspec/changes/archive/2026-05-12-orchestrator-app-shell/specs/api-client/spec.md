## ADDED Requirements

### Requirement: Typed OpenAPI client

The orchestrator SHALL consume the FastAPI backend through `openapi-fetch` typed against `src/lib/api/schema.d.ts`, generated from `apps/backend`'s `/openapi.json` by `openapi-typescript`. All HTTP calls outside dev tooling MUST go through this client.

#### Scenario: Typed call to backend

- **WHEN** a module calls `client.GET('/auth/me')`
- **THEN** TypeScript infers the response body as the schema-defined type and rejects unknown paths at compile time

#### Scenario: Schema drift fails the build

- **WHEN** the backend renames a field that the frontend uses, and `schema.d.ts` is regenerated
- **THEN** `moon run orchestrator:typecheck` fails on the now-missing property

### Requirement: Typegen task

A moon task `orchestrator:typegen` SHALL regenerate `src/lib/api/schema.d.ts` from a running backend at `http://localhost:8000/openapi.json` (configurable via env). The generated file MUST be committed so fresh clones build offline.

#### Scenario: Local regeneration

- **WHEN** a developer runs `moon run orchestrator:typegen` against a running backend
- **THEN** `src/lib/api/schema.d.ts` is rewritten with the latest schema and the diff is reviewable

#### Scenario: Offline build

- **WHEN** a contributor clones the repo with the backend not running and runs `moon run orchestrator:build`
- **THEN** the build succeeds using the committed `schema.d.ts`

### Requirement: Shared fetch client with credentials

`src/lib/api/client.ts` SHALL export a single `client` instance configured with `baseUrl` from `import.meta.env.VITE_API_BASE_URL` and `credentials: 'include'` for cookie-based auth. The client MUST set `Accept: application/json` on every request.

#### Scenario: Cookie sent on every call

- **WHEN** any module issues a request through the shared client
- **THEN** the browser includes the session cookie due to `credentials: 'include'`

#### Scenario: Base URL configurable

- **WHEN** `VITE_API_BASE_URL` is set to `https://api.example.com`
- **THEN** the client targets that origin without any other code change

### Requirement: Module-owned query keys and hooks

Each module SHALL define its own TanStack Query hooks in `modules/<name>/hooks.ts` and query keys in `modules/<name>/keys.ts`. A `createQueryKeys` helper SHOULD be used to keep keys typed. Cross-module hook reuse is forbidden — promote shared code to `lib/`.

#### Scenario: Module exposes a typed hook

- **WHEN** the `auth` module exposes `useSession`
- **THEN** the hook lives at `src/modules/auth/hooks.ts` and uses the key `authKeys.me()` from `src/modules/auth/keys.ts`

#### Scenario: Lint blocks cross-module hook import

- **WHEN** code in `modules/pathway` imports `useSession` from `modules/auth/hooks`
- **THEN** ESLint `no-restricted-paths` flags the import as an error
