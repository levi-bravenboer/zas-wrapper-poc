# AGENTS.md — apps/backend

Backend app: FHIR gateway, MCP host, integration glue for HiX / Luscii. Inherits all rules from the root `AGENTS.md`; this file overrides where it differs.

> **Before implementing any task, re-read `openspec/scope.md` to confirm in-tier** (`[poc]` for PoC work). Out-of-tier ideas go to `openspec/backlog.md`. Full openspec rules: `openspec/AGENTS.md`. FHIR rules apply at `[mvp]`; see `openspec/scope.md`.

## Stack

- Python 3.13 (managed by `uv`)
- FastAPI 0.136 (`fastapi[standard]`, includes `uvicorn` + CLI)
- Pytest 9 with FastAPI `TestClient` (via `httpx`)
- Ruff for lint + format

## Commands

Run from `apps/backend/`:

```bash
uv sync                       # install / refresh deps from pyproject + uv.lock
uv run fastapi dev main.py    # dev server with autoreload
uv run fastapi run main.py    # production-style server
uv run pytest -q              # tests
uv run ruff format            # format
uv run ruff check --fix       # lint + autofix
```

## Layout

```
apps/backend/
├── app/
│   ├── adapters/             # external integrations (hix, luscii); Protocol + stub per vendor
│   ├── api/
│   │   ├── deps.py           # dependency factories (CurrentUserDep, ...)
│   │   └── routers/          # FastAPI routers grouped by tag
│   ├── core/                 # settings, errors, logging, readiness, security
│   ├── schemas/              # Pydantic request/response models
│   │   └── view/             # orchestrator-facing DTOs
│   ├── services/             # business logic
│   ├── main.py               # create_app() factory
│   └── openapi.py            # offline OpenAPI exporter
├── main.py                   # thin entrypoint (`from app.main import app`)
├── openapi.json              # baseline schema for orchestrator typegen
├── tests/                    # mirrors app/ tree; conftest + fixtures + utils
├── pyproject.toml
├── uv.lock
├── .env.example
├── moon.yml
└── README.md
```

Keep `main.py` (repo-root level inside `apps/backend/`) as a thin re-export. All new code lands inside the `app/` package.

## Layer Rules

| Layer | May import | Must not import |
| --- | --- | --- |
| `app/api/routers/*` | `app.schemas.view.*`, `app.schemas.*`, `app.services.*`, adapters via `Depends` | `app.adapters.*` directly (without `Depends`) |
| `app/services/*` | `app.schemas.*`, `app.db.*`, `app.adapters.*` (via DI) | `fastapi.*`, `app.api.*` |
| `app/adapters/<vendor>/*` | `app.core.errors`, vendor SDK types | `app.api.*`, `app.services.*` |
| `app/core/*` | stdlib, third-party libs | `app.api.*`, `app.adapters.*`, `app.services.*` |

The seam between layers is one-directional: routers → services → adapters.

## Naming Conventions

- **Files**: snake_case, singular module names (`patient_router.py`, `auth_service.py`, `session_signer.py`).
- **Router files**: `<domain>_router.py`. Export a module-level `router = APIRouter(tags=[...])`.
- **Operation IDs**: `<verb>_<noun>[_<qualifier>]` snake_case, e.g. `get_patient_summary`, `post_auth_login`. Match these between backend and the generated orchestrator client.
- **Error codes**: `<issue-type>.<domain>.<reason>` (issue type from the FHIR `IssueType` vocabulary: `not-found`, `invalid`, `security`, `forbidden`, `conflict`, `processing`, `transient`, `informational`). Set on `AppError` subclasses.
- **Pydantic models**: PascalCase singular (`SessionUser`, `PatientSummary`). View-model DTOs end in `Summary`, `Row`, or `View`.
- **Dependencies**: `Annotated[T, Depends(get_*)]` aliased as `<Name>Dep` (`SettingsDep`, `CurrentUserDep`, `HixClientDep`).

## Coding Rules

- **Type hints required** on all public functions, route handlers, and dependency factories.
- **Pydantic v2** models for request / response payloads. Reuse models across routes; do not duplicate field definitions.
- **Settings**: read via `SettingsDep`. Never read `os.environ` directly in route or service code.
- **Logging**: structured via `app.core.logging`. No `print()`. Never log full clinical payloads — use `log_fhir_ref(resource_type, resource_id)` for resource references.
- **Errors**: subclass `AppError` for domain-specific failures; set class-level `code`, `status_code`, `message`. Raising `HTTPException` is fine for ad-hoc cases but `AppError` is preferred when the failure has a stable code.
- **POC ONLY banner**: any module that contains throwaway scaffolding (in-memory user stores, hard-coded fixtures, demo credentials, mock issuer claims) MUST start with a `# POC ONLY` comment line explaining what would replace it. The banner makes it obvious which files need to be replaced before any non-PoC deployment — see `app/services/auth_service.py` for the canonical example.
- **PHI**: treat all clinical payloads as patient data. Never log full payloads — log resource type + id only.

## Testing

- One test file per route / module under `tests/`, mirroring the source tree.
- Use FastAPI `TestClient` for integration-style tests; reach for unit tests when logic is pure.
- Fixtures with synthetic clinical data live under `tests/fixtures/`. Never commit data from real patients.
- Common fixtures (`settings`, `app`, `client`, `authed_client`) live in `tests/conftest.py`. Prefer them over hand-rolled `TestClient` setup in new tests.
- For time-sensitive code, use `freezegun.freeze_time(...)`. Wrap the smallest scope that needs the frozen clock; never leave it freezing across whole modules.
- Cookie-aware helpers live in `tests/utils/cookies.py`. `TestClient` already shares a cookie jar; reach for the helpers only when forging or clearing specific cookies.

## Quality Gates

Before claiming a task complete:

1. `uv run ruff format --check` — clean (or run `ruff format` and re-stage).
2. `uv run ruff check` — clean.
3. `uv run pytest -q` — green.
4. For new routes: hit them via `curl` or the FastAPI `/docs` Swagger UI and verify the response shape.

## External Integrations

- **HiX**: stub behind an adapter from day one. PoC Protocol exposes `ping()` only; FHIR verbs return at `[mvp]` via the future `hix-fhir-proxy` change.
- **Luscii API**: stub behind an adapter from day one. PoC stores the clinical care path as opaque static JSON; FHIR mapping returns at `[mvp]`.
- **MCP**: planned via the official Python SDK. Land as a separate FastAPI sub-app or standalone process once scoped.

## FHIR-Readiness Rules

FHIR rules apply at `[mvp]`; see `openspec/scope.md`. PoC keeps the adapter Protocol seam (`HixClient.ping()` only) and excludes FHIR-shaped surfaces, `fhir.resources` types, mappers, search-param objects, and `/fhir/*` routes. The full FHIR target is restored by the future `hix-fhir-proxy` change.
