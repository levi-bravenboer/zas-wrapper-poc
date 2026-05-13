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

## Quality Gates

Before claiming a task complete:

1. `uv run ruff format --check` — clean (or run `ruff format` and re-stage).
2. `uv run ruff check` — clean.
3. `uv run pytest -q` — green.
4. For new routes: hit them via `curl` or the FastAPI `/docs` Swagger UI and verify the response shape.

## External Integrations

- **HiX FHIR**: stub behind an adapter from day one. Tests run against fixtures, never the live HiX sandbox. **PoC scope:** adapter returns static fixtures only — no live calls, no resource zod validation, no pagination helpers yet. Real wiring + conventions land in a follow-on `fhir-integration` openspec change. Until then, do not invent adapter patterns; ask if a task seems to require real FHIR I/O.
- **Luscii API**: same pattern. Document the contract in `openspec/specs/` when stable.
- **MCP**: planned via the official Python SDK. Land as a separate FastAPI sub-app or standalone process once scoped.
