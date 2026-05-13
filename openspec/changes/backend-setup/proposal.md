## Why

`apps/backend/` is a minimal FastAPI scaffold today: a single `main.py` exposing `/` and `/health`, no settings layer, no CORS, no auth endpoints, no adapter pattern, no error model. The orchestrator app-shell change already assumes three auth routes (`POST /auth/login`, `GET /auth/me`, `POST /auth/logout`) returning a cookie session, plus a stable `/openapi.json` for typegen. Without those, the frontend stays glued to MSW handlers and HiX/Luscii integration has no place to land.

This change establishes the canonical backend layout, settings, CORS, auth stub, error model, logging conventions, adapter pattern, health/readiness, OpenAPI metadata, and test infrastructure in one pass — so every following backend change (real SMART handshake, HiX FHIR proxy, Luscii integration, MCP host) drops into a known shape.

## What Changes

- Adopt the `app/` package layout now, ahead of the `~150 line` threshold in `apps/backend/AGENTS.md`. `main.py` becomes a thin entrypoint that re-exports `app.main:app`. Internal layout: `app/api/routers/` per domain, `app/core/` for cross-cutting (settings, logging, security), `app/schemas/` for shared Pydantic models, `app/services/` for use-cases, `app/adapters/` for external systems (HiX, Luscii).
- Adopt **`pydantic-settings`** for env config. All env reads go through a single `Settings` object loaded from `.env` + `os.environ`. No direct `os.environ` in route or service code.
- Wire **CORS** for the orchestrator dev origin (`http://localhost:5173`) and a configurable production origin list via `Settings.cors_origins`. `credentials: true` because the orchestrator depends on cookie auth.
- Ship the **auth stub**: `POST /auth/login` (username + password), `GET /auth/me` (current session), `POST /auth/logout` (clear cookie). Backed by an in-memory user store with one demo clinician. Session = signed itsdangerous cookie. Replaces nothing today, but is the contract the orchestrator already codes against.
- Introduce a **standard error model** (`ErrorResponse { code, message, details? }`) and a global exception handler. `HTTPException` and `RequestValidationError` are mapped to this shape. The orchestrator's `client.ts` middleware can then surface uniform errors. **`code` values are namespaced `<fhir-issue-type>.<domain>.<reason>`** (e.g. `security.auth.invalid_credentials`, `not-found.fhir.patient`) so a later mechanical mapper to FHIR `OperationOutcome.issue` is one split-on-dot away.
- Adopt **structured logging** via the stdlib `logging` module, configured in `app.core.logging`. JSON logs in production, human-readable in dev. PHI guard: a small helper `log_fhir_ref(resource_type, id)` is the only sanctioned way to mention FHIR resources in logs.
- Scaffold **external-system adapters** as Python `Protocol`s under `app/adapters/`: `HixClient`, `LusciiClient`. Each has a stub in-memory implementation registered as a FastAPI dependency. Real implementations land in later proposals behind the same Protocol — route code never changes. **HiX adapter exposes FHIR verbs** (`read`, `search`, `create`) returning [`fhir.resources`](https://pypi.org/project/fhir.resources/) R4 types, because HiX is FHIR-native. **Luscii adapter exposes vendor methods** paired with a sibling `mappers.py` that translates vendor payloads into `fhir.resources` types before they cross the service boundary.
- Adopt **`fhir.resources` (R4) as the canonical internal model** for any clinical concept. Service code, mappers, adapters, and tests exchange `fhir.resources` types — never bespoke Pydantic clones of FHIR shapes. View-model DTOs for the orchestrator live under `app/schemas/view/` and are built by pure functions in `app/fhir/mappers/`. This makes a later "expose raw `/fhir/*` endpoints" change additive (new routes, same mappers in reverse) instead of structural.
- Split health into **`/health` (liveness)** and **`/ready` (readiness)**. Liveness is unconditional; readiness pings each registered adapter's `ping()` and returns 503 if any fail. POC stubs always succeed.
- Tighten **OpenAPI metadata**: tagged routers (`auth`, `health`, `fhir`, `luscii`), `operation_id` set per route for clean orchestrator typegen, response models declared on every route, `servers` populated from `Settings.public_url`.
- Establish the **testing foundation**: `tests/` mirrors `app/` (`tests/api/`, `tests/core/`, `tests/adapters/`), a `conftest.py` with a `client: TestClient` fixture, a `tests/fixtures/` directory for synthetic FHIR payloads, and a `tests/utils/` helper for cookie-auth in tests. **No real patient data** — never, anywhere.
- Add **moon tasks**: `backend:typecheck` (`uv run pyright` once installed), `backend:openapi` (`uv run python -m app.openapi` writing `apps/backend/openapi.json` for orchestrator typegen consumption when the dev server isn't running).
- Update **`apps/backend/AGENTS.md`** and the backend `README.md` with the new layout, commands, and per-layer rules.

## Layer Rules

| Layer | Allowed imports from | Forbidden imports from |
| --- | --- | --- |
| `app/api/routers/*` | `app.schemas`, `app.services`, `app.core`, `app.adapters` (only via `Depends`) | other routers, infra libraries directly |
| `app/services/*` | `app.schemas`, `app.core`, `app.adapters` | `fastapi.*` (services are framework-agnostic) |
| `app/adapters/*` | `app.schemas`, `app.core`, external SDKs (`httpx`, vendor SDKs) | `app.api`, `app.services` |
| `app/core/*` | stdlib, third-party libs | `app.api`, `app.services`, `app.adapters` |
| `app/schemas/*` | `pydantic`, stdlib | everything else |

Enforced socially today; promotable to `ruff` `flake8-tidy-imports` `banned-module-level-imports` once the surface grows.

## Naming Conventions

Backend follows PEP 8. Where it overlaps with frontend, the wire format wins (HTTP payloads use the casing the backend emits).

| Thing | Convention | Example |
| --- | --- | --- |
| Module / file | `snake_case.py` | `auth_router.py`, `hix_client.py` |
| Package folder | `snake_case` | `app/api/routers/` |
| Class | `PascalCase` | `SessionUser`, `HixClient` |
| Function / method / variable | `snake_case` | `fetch_session`, `current_user` |
| Constant | `SCREAMING_SNAKE_CASE` | `SESSION_COOKIE_NAME` |
| Pydantic model | `PascalCase`, no suffix | `LoginRequest`, `SessionUser`, `ErrorResponse` |
| Router file | `<domain>_router.py` exporting `router = APIRouter(...)` | `auth_router.py` |
| Service file | `<domain>_service.py` | `auth_service.py` |
| Adapter Protocol | `<Vendor>Client` Protocol + `<Vendor>StubClient` concrete | `class HixClient(Protocol)` / `class HixStubClient` |
| Settings field | `snake_case` | `cors_origins`, `session_secret_key` |
| Env var | `SCREAMING_SNAKE_CASE`, app-prefixed | `BACKEND_SESSION_SECRET_KEY` |
| Tag (OpenAPI) | lowercase singular | `auth`, `health`, `fhir`, `luscii` |
| Operation ID | `snake_case` verb + noun, unique | `login_user`, `get_current_user`, `logout_user` |
| Test file | `test_<unit>.py` mirroring source path | `tests/api/test_auth_router.py` |
| Test function | `test_<sentence_case_separated_by_underscores>` | `test_returns_401_when_password_is_invalid` |
| Fixture | `snake_case` noun | `client`, `authed_client`, `hix_stub` |

## Coding Rules

### Python

- **Type hints required** on every public function, route handler, dependency, and adapter method. `Any` only with a one-line `# reason:` comment.
- **Pydantic v2** models for every request body and response body. Reuse models across routes; do not duplicate field definitions inline.
- **Settings through `Settings`** only. No `os.environ.get(...)` in route or service code.
- **No `print()`**. Use the `logging` module via `app.core.logging`.
- **No raw SQL today** — no DB in scope. When DB lands, SQLAlchemy 2.0 async + alembic, behind `app/repositories/`.
- **`async def` for I/O routes**; sync `def` for pure CPU work. Don't mix `requests`-style blocking calls into async paths.
- **Errors**: raise `HTTPException(status_code, detail=ErrorResponse(...))`-shaped responses via the global handler (handler wraps `HTTPException.detail` into the standard model). Custom domain errors subclass `AppError` in `app.core.errors`.
- **No silent broad `except Exception`**; if you catch, log with context and re-raise or convert to a typed `AppError`.

### FastAPI

- **One `APIRouter` per domain**, mounted in `app/api/__init__.py`. Routers carry their own `prefix`, `tags`, and `responses` defaults.
- **Dependencies (`Depends`)** for cross-cutting concerns: current user, adapter clients, settings. No direct instantiation in route code.
- **`response_model` set on every route.** Even when it's a `dict[str, str]` — make it `HealthResponse`. Generates stable types for the orchestrator.
- **`operation_id` set on every route.** TanStack Query keys + `openapi-typescript` names hinge on this; auto-generated IDs are unstable across refactors.
- **No business logic in routers.** Routers parse, delegate to a service, format the response.

### Logging + PHI

- **Never log full FHIR payloads.** Use `log_fhir_ref(resource_type, id)` — emits `resource_type=Patient resource_id=abc123` and nothing more.
- **Never log session cookies, tokens, or passwords.** Lint-enforced by a `ruff` custom rule once feasible; reviewer-enforced until then.
- **Log structured fields**, not f-strings: `logger.info("auth.login.success", extra={"user_id": user.id})`.

### Testing

- **One test file per source module**, mirroring the tree.
- **`TestClient` fixture** for any route test. Bare `TestClient(app)` in test bodies forbidden.
- **`authed_client` fixture** logs in once per test, returns a `TestClient` with the session cookie set. Use it for routes that require auth.
- **Synthetic FHIR fixtures** from `tests/fixtures/` only. No payloads copied from real systems.
- **No mocking the unit under test.** Mock collaborators: adapter Protocols swapped to stubs via dependency overrides, time via `freezegun`, randomness via injected seeds.
- **Assert on response shape and status**, not on mock invocations.

## Capabilities

### New Capabilities

- `app-layout`: `app/` package, factory function `create_app()`, router auto-mount, thin `main.py` entrypoint, lifespan hook.
- `settings-config`: `pydantic-settings` Settings class, `.env` loading, settings as a FastAPI dependency, env documentation in `.env.example`.
- `cors`: configurable origin list, credentials enabled, dev origin (`http://localhost:5173`) wired by default.
- `auth-stub`: `/auth/login`, `/auth/me`, `/auth/logout`. Signed cookie session via `itsdangerous`. In-memory single demo user. Replaces nothing real, but is the contract the orchestrator already codes against.
- `errors-logging`: `ErrorResponse` model, global exception handlers for `HTTPException`, `RequestValidationError`, custom `AppError`. Structured logging via `app.core.logging`. PHI guard helper.
- `health-readiness`: `/health` (always 200) and `/ready` (probes adapters). Both return typed models.
- `external-adapters`: `HixClient` + `LusciiClient` as `Protocol`s with in-memory stubs, registered via `Depends`. Stub `ping()` for readiness probe.
- `openapi-contract`: tagged routers, `operation_id` per route, `response_model` per route, `servers` from settings, `apps/backend/openapi.json` regenerable via moon task.
- `testing-foundation`: `tests/` mirrors `app/`, `conftest.py` with `client` + `authed_client` fixtures, `tests/fixtures/` synthetic data, dependency override pattern for adapter stubs.
- `fhir-ready-domain`: `fhir.resources` (R4) as the canonical internal model, `app/fhir/` package with `mappers/` (FHIR ↔ view-model), `search.py` (typed search filters), `codes.py` (OperationOutcome issue-type vocabulary). View-model DTOs under `app/schemas/view/`. FHIR-shaped Reference objects across module boundaries. `ErrorResponse.code` namespaced under FHIR `IssueType`. Pagination shape Bundle-compatible. Adapter Protocols FHIR-verb-shaped when the source is FHIR.

### Modified Capabilities

None — `openspec/specs/` is empty for the backend today.

## Impact

- **Code**: `apps/backend/main.py` becomes ~5 lines; new tree under `apps/backend/app/`. ~6 new routes (auth × 3, health × 2, root). New tests covering each.
- **Dependencies added** (`apps/backend/pyproject.toml`):
  - Runtime: `pydantic-settings`, `itsdangerous`, `fhir.resources` (R4).
  - Dev: `pyright`, `freezegun`.
  - Existing `fastapi[standard]`, `pytest`, `httpx`, `ruff` stay.
- **Explicitly out of scope** (separate later changes): real SMART-on-FHIR handshake, real HiX FHIR proxy, real Luscii API integration, real IdP (eHealth / itsme / eID / CSAM), database persistence, MCP host, observability stack (OpenTelemetry, Sentry), `/fhir/*` raw-FHIR endpoints, `CapabilityStatement`, FHIR search-param URL parsing, `If-Match` / `ETag` versioning, `$operation` endpoints, full Bundle wire format on PoC routes. The architecture from `fhir-ready-domain` makes each of those additive instead of structural.
- **Tooling**: moon `backend:typecheck`, `backend:openapi` added. `apps/backend/AGENTS.md` and `apps/backend/README.md` updated. `.env.example` committed.
- **Frontend**: unblocks `apps/orchestrator` from MSW-only auth — `client.GET('/auth/me')` against `http://localhost:8000` works end-to-end after this change.
- **Docs**: backend AGENTS.md grows a "layer rules" section and a "naming + coding rules" section mirroring the orchestrator's, so cross-stack reviewers find the same scaffolding both sides.
