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

Onboarding: `moon run :doctor` → `moon run :install` → `moon run :up` (run from repo root). See repo-root `README.md` for prereqs and `apps/backend/README.md` for the full per-task table.

Any new docker resource (container, volume, network, built image) MUST be prefixed `zas_`. Future changes touching `docker-compose*.yml` MUST extend this rule.

## Commands

Through moon (preferred):

```bash
moon run backend:dev                        # docker compose up backend
moon run backend:test                       # pytest in ephemeral zas_backend_test
moon run backend:test -- -k <pattern>       # passthrough args
moon run backend:test-host                  # host pytest → localhost:5433 (fast, agent-safe)
moon run backend:test-host -- <args>        # passthrough args
moon run backend:shell                      # bash inside zas_backend
moon run backend:psql                       # psql -U zas -d zas
moon run backend:migrate                    # alembic upgrade head
moon run backend:make-migration "<message>" # autogenerate revision
moon run backend:install                    # host uv sync
moon run backend:lint                       # ruff check (native)
moon run backend:format                     # ruff format --check (native)
moon run backend:typecheck                  # pyright (native)
moon run backend:openapi                    # export openapi.json (native)
```

Direct `uv` invocation is fine for host-side static checks if you need ad-hoc flags; the moon task is just a thin wrapper.

### Running tests

Always run through `moon`, never `pytest` / `docker compose` directly. Everything after `--` passes through to pytest in the ephemeral `zas_backend_test` container.

```bash
# Full suite
moon run backend:test

# Single test file
moon run backend:test -- tests/services/pathway/test_pathway_service.py

# Single test node
moon run backend:test -- tests/services/pathway/test_pathway_service.py::test_resolves_block

# Filter by keyword expression
moon run backend:test -- -k "pathway and not slow"

# One domain end-to-end
moon run backend:test -- tests/services/pathway/

# Verbose + last-failure rerun
moon run backend:test -- -vv --lf
```

The `test_runner` container rebuilds on every invocation; cold runs take longer than `pytest` on the host. That cost is intentional — agents MUST NOT bypass it by running `pytest` directly against the host or `backend:shell`.

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
├── scripts/                            # standalone operational scripts (seed_tenant, seed_all, ...)
├── tests/                              # mirrors app/ + scripts/ trees exactly
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
| `scripts/*` | `app.core.*`, `app.db.*`, `app.repositories.*`, `app.services.*`, sibling `scripts.*` | `app.api.*`, `fastapi.*` |

### Dependency injection

- **Services are classes**, not module functions. `class PathwayService: def __init__(self, repo: PathwayRepository, hix: HixClient) -> None`. Adapters and sibling services are passed in via the constructor.
- Services NEVER import `fastapi`. Wiring (`Depends`) belongs to the router layer.
- Per-domain `Annotated[Service, Depends(get_<domain>_service)]` factories live next to the service in `app/services/<domain>/deps.py` and re-export the alias from the domain's `__init__.py`. Routers import the `<Domain>ServiceDep` alias only.

### Transaction boundary

- `get_session` in `app/db/engine.py` is the **request-scoped unit of work**: it commits on a successful handler return and rolls back on any raised exception.
- Services and repositories MUST NOT call `session.commit()` themselves. Use `await session.flush()` if an INSERT-generated id is needed mid-request.
- `async with session.begin_nested()` is the escape hatch for partial-atomicity savepoints inside a service method.

### List endpoints

Paged list endpoints share one query envelope (`ListQuery` in `app/schemas/_list/list_query.py`) and one response envelope (`Page[T]` in `app/schemas/_list/page.py`). Concrete repositories subclass `BaseListRepository[T]` from `app/repositories/base.py` and declare `orderable_fields`, `filterable_fields`, and `searchable_fields` as class attributes; `await repo.list_page(query)` returns a fully-shaped `Page[T]` without hand-rolled SQL. Centralising pagination, search, ordering, and filtering here keeps every domain consistent and lets the orchestrator's typed client treat lists as one shape.

Route handlers stay thin:

```python
async def list_x(query: ListQueryParamsDep, repo: XRepoDep) -> Page[XRead]:
    return await repo.list_page(query)
```

Filters use bracket-key query strings so a single param namespace covers equality and operator forms: `filter[name]=alice`, `filter[name][contains]=al`, `filter[id][in]=...&filter[id][in]=...`. The `ListQueryParamsDep` parser maps these onto the repository's declared `filterable_fields`; unknown fields or operators raise a 422 before hitting the repo.

### Realtime

Realtime fan-out is single-pod only. `app/realtime/pubsub.py` is an in-memory async pub/sub; SSE subscribers connect to `GET /events` (cookie-auth, tenant-scoped, `include_in_schema=False` so it does not leak into the typed client). Events publish on `after_commit` — never on rollback — so subscribers see only durable state. Soft-delete emits `action="upsert"` (the row still exists with `deleted_at` set); hard delete emits `action="delete"`.

A model opts in by declaring `__realtime_resource__: ClassVar[str | None]` on the `Entity` subclass; setting it to `None` skips emission entirely (sensitive rows, audit-only tables). Multi-pod productisation is tracked as `BL-050 — Multi-pod realtime broadcaster` (tier `[mvp]`) — the in-memory bus must be replaced with a shared broker before more than one backend pod can run.

## Naming Conventions

- **Files**: snake_case. Pattern inside a domain folder is `<domain>_<layer>.py` (`pathway_router.py`, `pathway_service.py`, `pathway_repository.py`). When a single domain outgrows one file per layer, add concern-named siblings (`pathway/blocks.py`, `pathway/runtime.py`) and keep them inside the same domain folder.
- **`__init__.py`**: re-export the public API of the package. Routers expose `router`; services expose `<Domain>Service` plus its `<Domain>ServiceDep`; repositories expose `<Domain>Repository` plus its `<Domain>RepoDep`; schemas expose the request/response models. Import sites use `from app.services.pathway import PathwayService`, not the inner module path.
- **Router files**: each domain folder contains `<domain>_router.py` that exports a module-level `router = APIRouter(tags=[...])`.
- **Operation IDs**: `<verb>_<noun>[_<qualifier>]` snake_case, e.g. `get_patient_summary`, `post_auth_login`. Match these between backend and the generated orchestrator client.
- **Error codes**: `<issue-type>.<domain>.<reason>` (issue type from the FHIR `IssueType` vocabulary: `not-found`, `invalid`, `security`, `forbidden`, `conflict`, `processing`, `transient`, `informational`). Set on `AppError` subclasses defined in `app/services/errors.py`.
- **Pydantic models**: PascalCase singular (`SessionUser`, `PatientSummary`). View-model DTOs end in `Summary`, `Row`, or `View`.
- **Dependencies**: `Annotated[T, Depends(get_*)]` aliased as `<Name>Dep` (`SettingsDep`, `SessionDep`, `PathwayServiceDep`, `HixClientDep`).
- **Shared enums**: any enum referenced by both `app/db/models/*` and `app/schemas/*` (i.e. it crosses the ORM ↔ Pydantic seam) MUST live under `app/core/enums/<domain>.py` and be re-exported from `app/core/enums/__init__.py`. The module MUST be stdlib-only (no `pydantic`, no `sqlalchemy`, no `app.*` imports) so both layers can import it without breaking the layer rules. Use `enum.StrEnum`. Domain-private enums that never leave one layer stay co-located with that layer.

## Coding Rules

- **Type hints required** on all public functions, route handlers, and dependency factories.
- **Pydantic v2** models for request / response payloads. Reuse models across routes; do not duplicate field definitions.
- **Settings**: read via `SettingsDep`. Never read `os.environ` directly in route or service code.
- **Logging**: structured via `app.core.logging`. No `print()`. Never log full clinical payloads — use `log_fhir_ref(resource_type, resource_id)` for resource references.
- **Errors**: subclass `AppError` for domain-specific failures; set class-level `code`, `status_code`, `message`. Raising `HTTPException` is fine for ad-hoc cases but `AppError` is preferred when the failure has a stable code.
- **POC ONLY banner**: any module that contains throwaway scaffolding (in-memory user stores, hard-coded fixtures, demo credentials, mock issuer claims) MUST start with a `# POC ONLY` comment line explaining what would replace it. The banner makes it obvious which files need to be replaced before any non-PoC deployment — see `app/services/auth_service.py` for the canonical example.
- **Postgres-native enums**: ORM columns backed by an `enum.StrEnum` MUST map via `sa.Enum(MyEnum, name="<snake_name>", native_enum=True, create_constraint=True)` so the value set is enforced in the database. `apps/backend/alembic/env.py` MUST `import alembic_postgresql_enum  # noqa: F401` at the top — the package side-effect-registers autogen hooks that emit correct `CREATE TYPE` / `DROP TYPE` / `ALTER TYPE ADD VALUE` ops. Adding a new value to an existing enum requires a hand-edited revision (the autogen handles the boilerplate, but `ALTER TYPE ... ADD VALUE` must run outside a transaction).
- **Seed data via scripts, not Alembic**: Alembic revisions MUST contain DDL only. No `op.bulk_insert`, no `op.execute("INSERT ...")`. Every seed (bootstrap tenant, bootstrap users, fixture data) MUST be implemented as a standalone Python module under `scripts/` and invoked via `python -m scripts.<name>` / `moon run backend:<name>`. Each script exposes a `main()` entry plus an importable async helper (e.g. `seed_zas_tenant(session)`) so tests can drive the same logic without spawning subprocesses. The umbrella `scripts/seed_all.py` chains every seed in dependency order. Seeds MUST be idempotent — re-running is a no-op when rows are already present.
- **ORM base hierarchy**: every concrete model picks exactly one base from `app/db/base.py`:
  - `Entity(Base)` — `id` + `created_at` + `updated_at` + `deleted_at`. Used by root rows (`Tenant`) and rows that are not tenant-scoped.
  - `AuditableEntity(Entity)` — adds `created_by` / `updated_by` (NOT NULL, FK `users.id` `ON DELETE RESTRICT`) and `deleted_by` (nullable, same FK).
  - `TenantOwnedEntity(AuditableEntity)` — adds `tenant_id` (NOT NULL, FK `tenants.id` `ON DELETE RESTRICT`, indexed). Every hospital-owned domain (`User`, `Pathway`, `Patient`, `Task`, ...) MUST inherit `TenantOwnedEntity` — picking a lower base is a review-blocker.
  - `Tenant` itself inherits `Entity` only (NOT auditable, NOT tenant-owned) to dodge the bootstrap chicken-and-egg.
  - The bootstrap admin `User` row breaks the self-FK cycle by self-referencing (`id = created_by = updated_by = ADMIN_USER_ID`). Documented in `scripts/seed_users.py`.
- **Audit auto-fill via `session.info`**: `app/db/audit.install_audit_hooks()` registers a single `Session.before_flush` listener that reads `session.info[SESSION_ACTOR_KEY]` (`"actor"`) and stamps `tenant_id` / `created_by` / `updated_by` on new `AuditableEntity` rows (and `updated_by` on dirty ones) when the slot holds a `SessionUser`. Entry points wire the slot:
  - HTTP: `app/db/engine.get_session` writes the slot from `OptionalCurrentUserDep`.
  - Scripts: `scripts/_db.script_session(*, actor=None)` writes the slot when supplied.
  - Tests: the `session_actor` fixture (default `None`) is read by `db_session` and written to the slot.
  Callers MUST NOT set `tenant_id` / `created_by` / `updated_by` explicitly on new rows; the hook owns those fields. Setting them is reserved for the admin self-bootstrap path documented in `scripts/seed_users.py`.
- **Soft delete is the default**: every `Entity` row carries `deleted_at`. Use `BaseRepository.list()` (filters `deleted_at IS NULL` by default) over hand-rolled `select(Model)`. Use `BaseRepository.soft_delete(entity)` over `session.delete(entity)`; the latter is reserved for `hard_delete` cases where retention rules forbid keeping the row. Custom repo queries MUST add `where(Model.deleted_at.is_(None))` unless they intentionally surface soft-deleted rows.
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

## Adding a login provider (MVP path)

The auth seam is built around two Protocols. `Authenticator` (`app/services/auth/authenticator.py`) returns `AuthenticationResult` for a credential check; `LoginProvider` (`app/services/auth/providers/base.py`) owns route-shape concerns — `key`, `label`, `kind` class attributes plus an `async authenticate(*, email, password) -> SessionUser` method. `LoginProviderRegistry` returns the list of providers `GET /auth/providers` exposes to the frontend.

To add a new provider (e.g. itsme® OIDC):

1. Implement `LoginProvider` (e.g. `OidcLoginProvider`) with `kind = "oidc"` and the routes it needs.
2. Register it in `LoginProviderRegistry` next to `PasswordLoginProvider`.
3. Add the corresponding `apps/backend/app/api/routers/auth/` route(s).
4. On the frontend, add a strategy under `apps/orchestrator/src/modules/auth/providers.ts` that maps the `kind` to a component.
5. Emit `auth.login.success` / `auth.login.failure` via `app/services/auth/audit.py` so the new provider participates in the audit log.

The `external_idp` + `external_subject` columns on `users` carry IdP identifiers. Validate inbound subjects with `validate_external_subject()` before lookup — Belgian RRN values must be rejected to avoid storing identifiers covered by Wet 8 augustus 1983.

## External Integrations

- **HiX**: stub behind an adapter from day one. PoC Protocol exposes `ping()` only; FHIR verbs return at `[mvp]` via the future `hix-fhir-proxy` change.
- **Luscii API**: stub behind an adapter from day one. PoC stores the clinical care path as opaque static JSON; FHIR mapping returns at `[mvp]`.
- **MCP**: planned via the official Python SDK. Land as a separate FastAPI sub-app or standalone process once scoped.

## FHIR-Readiness Rules

FHIR rules apply at `[mvp]`; see `openspec/scope.md`. PoC keeps the adapter Protocol seam (`HixClient.ping()` only) and excludes FHIR-shaped surfaces, `fhir.resources` types, mappers, search-param objects, and `/fhir/*` routes. The full FHIR target is restored by the future `hix-fhir-proxy` change.
