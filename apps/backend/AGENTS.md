# AGENTS.md — apps/backend

Backend app: FHIR gateway, MCP host, integration glue for HiX / Luscii. Inherits all rules from the root `AGENTS.md`; this file overrides where it differs.

> **Before implementing any task, re-read `openspec/scope.md` to confirm in-tier** (`[poc]` for PoC work). Out-of-tier ideas go to `openspec/backlog.md`. Full openspec rules: `openspec/AGENTS.md`. FHIR rules apply at `[mvp]`; see `openspec/scope.md`.

## Stack

- Python 3.13 (managed by `uv`)
- FastAPI 0.136 (`fastapi[standard]`, includes `uvicorn` + CLI)
- Pytest 9 with FastAPI `TestClient` (via `httpx`)
- Ruff for lint + format

## Local runtime

The backend runs in docker via compose during dev/test; static checks (lint, format, typecheck) run on the host via `uv`. The boundary is deliberate:

- **In container (`zas_backend`)**: dev server, tests, alembic, psql. Compose `develop.watch` syncs source from host. Auto-migrate on entrypoint.
- **On host (via `uv`)**: ruff, pyright, openapi exporter — anything an editor LSP also calls. Editor / CLI / CI parity matters here.

Onboarding: `moon run :doctor` → `moon run :bootstrap` → `moon run :up` (run from repo root). See repo-root `README.md` for prereqs and `apps/backend/README.md` for the full per-task table.

Any new docker resource (container, volume, network, built image) MUST be prefixed `zas_`. Future changes touching `docker-compose*.yml` MUST extend this rule.

## Commands

Through moon (preferred):

```bash
moon run backend:dev                        # docker compose up backend
moon run backend:test                       # pytest in ephemeral zas_backend_test
moon run backend:test -- -k <pattern>       # passthrough args
moon run backend:shell                      # bash inside zas_backend
moon run backend:psql                       # psql -U zas -d zas
moon run backend:migrate                    # alembic upgrade head
moon run backend:makemigration "<message>"  # autogenerate revision
moon run backend:install                    # host uv sync
moon run backend:lint                       # ruff check (native)
moon run backend:format                     # ruff format --check (native)
moon run backend:typecheck                  # pyright (native)
moon run backend:openapi                    # export openapi.json (native)
```

Direct `uv` invocation is fine for host-side static checks if you need ad-hoc flags; the moon task is just a thin wrapper.

## Layout

Layer-by-type at the top, **domain split inside every layer**. Every feature owns a folder under each layer it touches; a domain MAY skip layers it does not need.

```
apps/backend/
├── app/
│   ├── adapters/                       # external integrations (hix, luscii); Protocol + stub per vendor
│   ├── api/
│   │   ├── deps.py                     # cross-cutting `SessionDep`, `SettingsDep` aliases only
│   │   └── routers/
│   │       ├── system_router.py        # health / readiness (single file — no domain folder needed)
│   │       └── <domain>/
│   │           └── <domain>_router.py  # one APIRouter per domain
│   ├── services/
│   │   ├── errors.py                   # shared `AppError` subclasses live flat
│   │   └── <domain>/
│   │       └── <domain>_service.py     # one service class per domain
│   ├── repositories/
│   │   ├── base.py                     # `BaseRepository[T]` generic
│   │   └── <domain>/
│   │       └── <domain>_repository.py  # one repository class per domain
│   ├── schemas/
│   │   ├── health/health.py            # health/readiness DTOs (system-router only)
│   │   └── <domain>/<domain>.py        # request/response Pydantic models per domain
│   ├── db/
│   │   ├── base.py                     # `class Base(DeclarativeBase)`
│   │   ├── engine.py                   # engine + session factory + `get_session` (auto-commit/rollback)
│   │   └── models/
│   │       ├── __init__.py             # imports every domain submodule so alembic autogenerate sees them
│   │       └── <domain>/<domain>.py    # ORM models per domain
│   ├── core/                           # settings, errors, logging, readiness  (cross-cutting infra only)
│   ├── main.py                         # create_app() factory
│   └── openapi.py                      # offline OpenAPI exporter
├── main.py                             # thin entrypoint (`from app.main import app`)
├── alembic.ini  alembic/               # async env wired to settings.database_url
├── openapi.json                        # baseline schema for orchestrator typegen
├── tests/                              # mirrors app/ tree exactly
├── pyproject.toml  uv.lock  .env.example  moon.yml  README.md
```

Keep `main.py` (repo-root level inside `apps/backend/`) as a thin re-export. All new code lands inside the `app/` package.

### Domain split policy

- Every domain folder is a Python package (`__init__.py` re-exports the public API — see *Naming Conventions*).
- A domain MAY skip layers (e.g. `auth` owns service + schema + router but reuses the `user` model and repository; `dashboard` reads aggregates and may have no model or repository).
- Add a folder when the domain has at least one file. Do not pre-create empty domain folders.
- Cross-domain calls between services are allowed; cross-domain calls between repositories are not (compose at the service layer).

## Layer Rules

The seam is one-directional: `router → service → repository → db.models`. Adapters plug in at the service layer via constructor DI. Repositories never see services, schemas, or HTTP.

| Layer | May import | Must not import |
| --- | --- | --- |
| `app/api/routers/<domain>/*` | `app.api.deps`, `app.schemas.<domain>.*`, `app.services.<domain>.*` (via `Depends`), `app.services.errors` | `app.repositories.*`, `app.db.*`, `sqlalchemy.*`, `app.adapters.*` directly |
| `app/services/<domain>/*` | `app.repositories.<any>.*`, `app.services.<any>.*`, `app.schemas.*`, `app.adapters.<vendor>.protocol`, `app.services.errors` | `fastapi.*`, `app.api.*`, `sqlalchemy.*`, raw `session.execute` |
| `app/repositories/<domain>/*` | `app.repositories.base`, `app.db.*`, `sqlalchemy.*` | `app.services.*`, `app.api.*`, `app.schemas.*`, `app.adapters.*` |
| `app/db/models/<domain>/*` | `app.db.base`, `sqlalchemy.*`, stdlib | `app.services.*`, `app.api.*`, `app.schemas.*`, `app.repositories.*` |
| `app/schemas/<domain>/*` | `pydantic`, stdlib, sibling schema modules | `app.db.*`, `app.services.*`, `app.api.*`, `app.repositories.*` |
| `app/adapters/<vendor>/*` | `app.core.errors`, vendor SDK types | `app.api.*`, `app.services.*`, `app.repositories.*` |
| `app/core/*` | stdlib, third-party libs | `app.api.*`, `app.adapters.*`, `app.services.*`, `app.repositories.*`, `app.db.*` |

### Dependency injection

- **Services are classes**, not module functions. `class PathwayService: def __init__(self, repo: PathwayRepository, hix: HixClient) -> None`. Adapters and sibling services are passed in via the constructor.
- Services NEVER import `fastapi`. Wiring (`Depends`) belongs to the router layer.
- Per-domain `Annotated[Service, Depends(get_<domain>_service)]` factories live next to the service in `app/services/<domain>/deps.py` and re-export the alias from the domain's `__init__.py`. Routers import the `<Domain>ServiceDep` alias only.

### Transaction boundary

- `get_session` in `app/db/engine.py` is the **request-scoped unit of work**: it commits on a successful handler return and rolls back on any raised exception.
- Services and repositories MUST NOT call `session.commit()` themselves. Use `await session.flush()` if an INSERT-generated id is needed mid-request.
- `async with session.begin_nested()` is the escape hatch for partial-atomicity savepoints inside a service method.

## Naming Conventions

- **Files**: snake_case. Pattern inside a domain folder is `<domain>_<layer>.py` (`pathway_router.py`, `pathway_service.py`, `pathway_repository.py`). When a single domain outgrows one file per layer, add concern-named siblings (`pathway/blocks.py`, `pathway/runtime.py`) and keep them inside the same domain folder.
- **`__init__.py`**: re-export the public API of the package. Routers expose `router`; services expose `<Domain>Service` plus its `<Domain>ServiceDep`; repositories expose `<Domain>Repository` plus its `<Domain>RepoDep`; schemas expose the request/response models. Import sites use `from app.services.pathway import PathwayService`, not the inner module path.
- **Router files**: each domain folder contains `<domain>_router.py` that exports a module-level `router = APIRouter(tags=[...])`.
- **Operation IDs**: `<verb>_<noun>[_<qualifier>]` snake_case, e.g. `get_patient_summary`, `post_auth_login`. Match these between backend and the generated orchestrator client.
- **Error codes**: `<issue-type>.<domain>.<reason>` (issue type from the FHIR `IssueType` vocabulary: `not-found`, `invalid`, `security`, `forbidden`, `conflict`, `processing`, `transient`, `informational`). Set on `AppError` subclasses defined in `app/services/errors.py`.
- **Pydantic models**: PascalCase singular (`SessionUser`, `PatientSummary`). View-model DTOs end in `Summary`, `Row`, or `View`.
- **Dependencies**: `Annotated[T, Depends(get_*)]` aliased as `<Name>Dep` (`SettingsDep`, `SessionDep`, `PathwayServiceDep`, `HixClientDep`).

## Coding Rules

- **Type hints required** on all public functions, route handlers, and dependency factories.
- **Pydantic v2** models for request / response payloads. Reuse models across routes; do not duplicate field definitions.
- **Settings**: read via `SettingsDep`. Never read `os.environ` directly in route or service code.
- **Logging**: structured via `app.core.logging`. No `print()`. Never log full clinical payloads — use `log_fhir_ref(resource_type, resource_id)` for resource references.
- **Errors**: subclass `AppError` for domain-specific failures; set class-level `code`, `status_code`, `message`. Raising `HTTPException` is fine for ad-hoc cases but `AppError` is preferred when the failure has a stable code.
- **POC ONLY banner**: any module that contains throwaway scaffolding (in-memory user stores, hard-coded fixtures, demo credentials, mock issuer claims) MUST start with a `# POC ONLY` comment line explaining what would replace it. The banner makes it obvious which files need to be replaced before any non-PoC deployment — see `app/services/auth_service.py` for the canonical example.
- **PHI**: treat all clinical payloads as patient data. Never log full payloads — log resource type + id only.

## Testing

- **Mirror src tree exactly**: `tests/services/pathway/test_pathway_service.py` mirrors `app/services/pathway/pathway_service.py`, etc. Running `pytest tests/services/pathway/` exercises one domain end-to-end.
- Conftest cascades: shared fixtures in `tests/conftest.py`, layer-shared in `tests/services/conftest.py`, domain-shared in `tests/services/pathway/conftest.py`.
- Use FastAPI `TestClient` for router-layer tests; service tests get the `db_session` fixture and exercise the real session; repository tests assert SQL behaviour against the live `zas_test_db` Postgres container (tmpfs, recreated per compose run). Override DI with `app.dependency_overrides` when a router test needs to stub a service.
- Fixtures with synthetic clinical data live under `tests/fixtures/`. Never commit data from real patients.
- Common fixtures (`settings`, `app`, `client`, `db_session`) live in `tests/conftest.py`. Prefer them over hand-rolled `TestClient` setup in new tests.
- For time-sensitive code, use `freezegun.freeze_time(...)`. Wrap the smallest scope that needs the frozen clock; never leave it freezing across whole modules.

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
