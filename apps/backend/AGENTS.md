# AGENTS.md — apps/backend

Backend app: FHIR gateway, MCP host, integration glue for HiX / Luscii. Inherits all rules from the root `AGENTS.md`; this file overrides where it differs.

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

Current shape (small surface):

```
apps/backend/
├── main.py            # FastAPI app entry — routes inline while the API is small
├── pyproject.toml     # deps + tool config (pytest pythonpath, ruff)
├── tests/
│   └── test_health.py
└── uv.lock
```

When the API grows beyond ~150 lines or two domains:

- Convert to `app/` package with `app/__init__.py` exposing `app` and `app/routers/*` per domain.
- Move shared dependencies (FHIR client, settings, db) into `app/core/`.
- Keep `main.py` as a thin entrypoint.

Discuss the move in an OpenSpec proposal — do not split silently.

## Conventions

- **Type hints required** on all public functions and route handlers.
- **Pydantic v2** models for request / response payloads. Reuse models across routes; do not duplicate field definitions.
- **Settings**: use `pydantic-settings` once env config is needed. Do not read `os.environ` directly in route code.
- **Logging**: standard `logging` module via `app.core.logging` (when introduced). No `print()` in committed code.
- **PHI**: treat all FHIR payloads as patient data. Never log full payloads — log resource type + id only.

## Testing

- One test file per route / module under `tests/`, mirroring the source tree.
- Use FastAPI `TestClient` for integration-style tests; reach for unit tests when logic is pure.
- Fixtures with real-looking FHIR data live under `tests/fixtures/`. Never commit data from real patients.
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

- **HiX FHIR**: stub behind an adapter from day one. Tests run against fixtures, never the live HiX sandbox. Adapter Protocol exposes FHIR verbs (`read`, `search`, `create`) returning `fhir.resources` (R4) types.
- **Luscii API**: stub behind an adapter from day one. Protocol stays vendor-shaped; a sibling `mappers.py` translates payloads to `fhir.resources` types before the service layer sees them.
- **MCP**: planned via the official Python SDK. Land as a separate FastAPI sub-app or standalone process once scoped.

## FHIR-Readiness Rules

This is a PoC, **but every clinical concept inside the backend is a `fhir.resources` (R4) type**. The wire format the orchestrator sees is a thinner view-model DTO. The seam between them is `app/fhir/mappers/`. These rules make the future "expose `/fhir/*` raw-FHIR endpoints" change a feature add, not a rewrite.

### Library

- **Canonical model**: [`fhir.resources`](https://pypi.org/project/fhir.resources/) R4, Pydantic v2. Used in adapters, services, mappers, and test fixtures.
- **Do not** define bespoke Pydantic models that duplicate a FHIR resource shape (no `class Patient(BaseModel)` in `app/schemas/`). The existing FHIR class is the source of truth.

### Package layout

```
app/
  fhir/
    __init__.py       # re-exports only
    mappers/          # one module per FHIR resource; pure functions
      patient.py      # to_summary(Patient) -> PatientSummary, ...
      observation.py
    search.py         # typed search-param Pydantic models (PatientSearch, ObservationSearch, ...)
    codes.py          # OperationOutcome IssueType vocabulary + `code(issue, domain, reason)` helper
  schemas/
    view/             # orchestrator-facing DTOs (PatientSummary, ObservationRow, ...)
    fhir.py           # convenience re-exports from `fhir.resources` for type hints
  adapters/
    hix/
      protocol.py     # FHIR-verb Protocol (read / search / create)
      stub.py
    luscii/
      protocol.py     # vendor-shaped Protocol (get_pathway, get_episode, ...)
      mappers.py      # vendor payload -> fhir.resources types
      stub.py
```

### Layer rules

| Layer | May import | Must not import |
| --- | --- | --- |
| `app/api/routers/*` | `app.schemas.view.*`, `app.fhir.mappers.*`, `app.services.*`, adapters via `Depends` | `fhir.resources` directly except through `app.schemas.fhir` re-exports |
| `app/services/*` | `fhir.resources`, `app.fhir.*`, `app.adapters` (via DI) | `app.schemas.view.*` (services emit FHIR resources; routes map to DTOs) |
| `app/fhir/mappers/*` | `fhir.resources`, `app.schemas.view.*` | `fastapi.*`, `app.services.*`, `app.adapters.*` |
| `app/adapters/<vendor>/mappers.py` | `fhir.resources`, vendor SDK types | `app.api.*`, `app.services.*` |

### Wire-format rules

- **Today**: non-`/fhir/*` routes return view-model DTOs built by a mapper. Never return a `fhir.resources` type from a route.
- **Tomorrow**: a future `fhir-endpoints` change adds `/fhir/<ResourceType>/<id>` routes returning the `fhir.resources` resource directly. Existing routes stay untouched.

### References + IDs

- **In domain code**: FHIR `Reference` objects everywhere — `obs.subject = Reference(reference="Patient/abc-123")`. Plain string IDs do not cross module boundaries.
- **In view-model DTOs**: plain IDs are allowed but the field name SHALL preserve resource type (`patient_id: str`, not `subject: str`).
- **In URL paths**: orchestrator routes use plain IDs (`/patients/{patient_id}`). The `/fhir/*` routes (future) use FHIR-shaped references (`/fhir/Patient/{id}`).

### Meta

When constructing a resource internally, populate `Meta.versionId` and `Meta.lastUpdated` if the source provides them. Stubs may set `versionId="1"` and a fixed-clock `lastUpdated`. Absence is OK when there is genuinely no source value; fabricated values are not.

### Error codes

`ErrorResponse.code` is namespaced `<fhir-issue-type>.<domain>.<reason>`. The first segment MUST be a FHIR `IssueType` (`not-found`, `invalid`, `security`, `forbidden`, `conflict`, `processing`, `transient`, `informational`). Examples:

- `security.auth.invalid_credentials`
- `not-found.fhir.patient`
- `invalid.validation.body`
- `transient.luscii.unavailable`

Use `app.fhir.codes.code(issue_type, domain, reason)` to build the string — never hand-format it inline.

### Pagination

List endpoints SHALL return `Page[T] { entries: T[], total: int, next_cursor: str | None }`. `next_cursor` is opaque. Adapters may use offsets, page tokens, or FHIR `Bundle.link[next].url` under the hood — that detail does NOT leak through the route.

### Search

Service-layer search APIs take typed Pydantic filter objects (`PatientSearch`, `ObservationSearch`, ...) defined in `app/fhir/search.py`. Routes parse query parameters into a filter object and pass it through. Adapters translate the filter into the source-specific shape.

### Reviewer checklist

When reviewing a PR that touches clinical code, confirm:

- [ ] Internal data type is `fhir.resources.*`, not a bespoke Pydantic clone.
- [ ] Mapper is a pure function in `app/fhir/mappers/<resource>.py`.
- [ ] References use `fhir.resources.reference.Reference`, not plain strings.
- [ ] `Meta` fields populated where a source value exists.
- [ ] Error codes formed via `app.fhir.codes.code(...)`.
- [ ] List endpoints return `Page[T]`, cursor opaque.
- [ ] Search params land via a typed `<Resource>Search` filter object.

### Out of scope (additive later)

- `/fhir/*` raw-FHIR endpoints
- `CapabilityStatement`
- FHIR search-param URL parsing
- `If-Match` / `ETag` versioning
- `$operation` endpoints
- Full Bundle wire format on PoC routes

Each of these is a feature-add behind the existing `app/fhir/` seam — no restructure expected.
