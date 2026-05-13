# backend

FastAPI backend for the ZAS Telegeneeskunde POC. Acts as FHIR gateway, MCP host, and integration glue for HiX (ChipSoft) and Luscii.

Stack: **Python 3.13** + **FastAPI 0.136** (`fastapi[standard]`) + **uv** + **pytest** + **ruff** + **pyright**.

## Requirements

- `uv` — `curl -LsSf https://astral.sh/uv/install.sh | sh`. `uv` installs the pinned Python (3.13, see `.python-version`) automatically.

## Bootstrap

```bash
uv sync                       # install deps from pyproject + uv.lock
cp .env.example .env          # configure local env (CORS origins, session secret, adapter modes)
uv run fastapi dev main.py    # http://localhost:8000 with autoreload
```

Defaults boot with `BACKEND_ENV=dev`, CORS open to `http://localhost:5173`, and HiX + Luscii adapters in `stub` mode. `production` boot refuses to start if `BACKEND_SESSION_SECRET_KEY` is still the placeholder or `BACKEND_CORS_ORIGINS` is empty.

## Commands

Direct:

| Command | What it does |
| --- | --- |
| `uv sync` | install / refresh deps |
| `uv run fastapi dev main.py` | dev server with autoreload |
| `uv run fastapi run main.py` | production-style server |
| `uv run pytest -q` | tests |
| `uv run pyright` | type check |
| `uv run ruff check` | lint |
| `uv run ruff format` | format |
| `uv run python -m app.openapi` | export `openapi.json` for orchestrator typegen |

Through moon (preferred):

```bash
moon run backend:dev
moon run backend:build        # uv sync --frozen
moon run backend:test
moon run backend:lint
moon run backend:format
moon run backend:typecheck
moon run backend:openapi
```

Interactive API docs: <http://localhost:8000/docs> while `dev` is running.

## Architecture

- **`app/`** — FastAPI app package. `create_app()` factory in `app/main.py` builds the application, wires settings, logging, error handlers, CORS, adapter stubs and readiness checks.
- **`app/api/routers/`** — routers grouped by tag (`health`, `auth`, future `fhir`, `luscii`).
- **`app/core/`** — cross-cutting concerns: `settings`, `errors`, `logging`, `readiness`, `security`.
- **`app/adapters/`** — external integrations. Each vendor (HiX, Luscii) has a `protocol.py` defining the seam plus `stub.py` for the PoC.
- **`app/schemas/`** — request / response Pydantic models. Future `view/` subdir holds the FHIR view-model DTOs.
- **`app/services/`** — business logic. PoC scope keeps this small.

Capability specs are tracked in `openspec/specs/`. New work lands as an OpenSpec change first.

## FHIR Readiness

This is a PoC, but every clinical concept inside the backend is a `fhir.resources` (R4) type. The wire format is a thin view-model DTO mapped on the way out. See [`AGENTS.md`](./AGENTS.md) → "FHIR-Readiness Rules".

## Conventions

See [`AGENTS.md`](./AGENTS.md). Highlights:

- Full type hints; Pydantic v2 models for payloads.
- Format with `ruff format`, lint with `ruff check`, type-check with `pyright`.
- Treat all FHIR payloads as PHI — log resource type + id only via `log_fhir_ref(...)`.
- HiX + Luscii integrations sit behind adapters; tests use fixtures, never live sandboxes.
- POC-only scaffolding (`in-memory user store, demo passwords, ...`) is banner-marked with `# POC ONLY` so it can be ripped out wholesale before production.

## Structure

```
apps/backend/
├── app/
│   ├── adapters/             # hix / luscii integrations behind FHIR-shaped protocols
│   ├── api/                  # routers + dependency factories
│   ├── core/                 # settings, errors, logging, readiness, security
│   ├── schemas/              # request/response models (+ fhir.py placeholders)
│   ├── services/             # business logic (auth_service today)
│   ├── main.py               # create_app() factory
│   └── openapi.py            # `python -m app.openapi` exporter
├── tests/                    # mirrors app/ tree; conftest + fixtures + utils
├── main.py                   # thin entrypoint re-exporting app.main:app
├── openapi.json              # baseline schema for orchestrator typegen
├── pyproject.toml
├── uv.lock
├── .env.example
├── .python-version
├── moon.yml
├── AGENTS.md
└── README.md
```
