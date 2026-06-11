# backend

FastAPI backend for the ZAS Telegeneeskunde POC. Acts as FHIR gateway, MCP host, and integration glue for HiX (ChipSoft) and Luscii.

Stack: **Python 3.13** + **FastAPI 0.136** (`fastapi[standard]`) + **uv** + **pytest** + **ruff** + **pyright**.

## Requirements

- `uv` — `curl -LsSf https://astral.sh/uv/install.sh | sh`. Installs the pinned Python (3.13) automatically.
- `docker compose` v2.22+ — used by `moon run backend:dev` / `:test`. See repo-root README for OrbStack install on macOS.

## Bootstrap

The backend runs in docker under the `zas_backend` container during dev. The host needs `uv` installed only so editor LSPs (Pylance, ruff-lsp) and the native static-check tasks work.

```bash
# From repo root:
moon run :doctor              # verify host prereqs (compose v2.22+, node, python, uv, moon)
moon run :install             # uv sync + pnpm install (host-side)
moon run :up                  # boots zas_db + zas_backend + vite
```

Defaults inside `zas_backend`: `BACKEND_ENV=dev`, CORS open to `http://localhost:5173`, HiX adapter in `stub` mode, Luscii live iff `BACKEND_LUSCII_API_TOKEN` is set in `apps/backend/.env` (compose loads that file via `env_file`; unset ⇒ Luscii endpoints answer 503 `not_configured`), log level `INFO`. `production` boot refuses to start if `BACKEND_SESSION_SECRET_KEY` is the placeholder or `BACKEND_CORS_ORIGINS` is empty.

Host-side env defaults live in `.env.example` and assume the dev DB on `localhost:5434` (host port; container-internal stays `5432`). Inside the container, compose overrides `BACKEND_DATABASE_URL` to `postgresql+asyncpg://zas:zas@db:5432/zas`.

`scripts/seed_users` reads `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` and `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` for the demo accounts. Both fall back to `"changeme"` with a `WARNING` log line when unset — set them via `.env` before sharing the PoC.

## Auto-migrate on boot

`zas_backend`'s entrypoint runs `alembic upgrade head` then `python -m scripts.seed_all` before uvicorn starts. A broken revision or a failing seed halts boot — uvicorn never binds its container-internal `:8000` (host `:18000`), and `moon run :up` exits non-zero with the error in the compose log. Run `moon run backend:make-migration "<msg>"` then `moon run backend:migrate` to add new revisions manually. The test runner overrides ENTRYPOINT to skip seeds — `zas_backend_test` boots straight into pytest.

## Ports

| Container | Host port | Purpose |
| --- | --- | --- |
| `zas_db` | `5434` | dev Postgres |
| `zas_test_db` | `5433` | test Postgres (tmpfs, ephemeral) |
| `zas_backend` | `18000` | FastAPI |

Fixed mappings. Dev DB binds host `5434` (not Postgres default `5432`) so it coexists with other local Postgres instances. Container-internal port is `5432`; only the host-side mapping changes.

## Commands

Through moon (preferred):

```bash
moon run backend:dev                        # docker compose up (just the backend service)
moon run backend:test-host                  # host pytest → localhost:5433 (fast, agent-default)
moon run backend:test-host -- -k <pattern>  # subset (args pass through to pytest)
moon run backend:test                       # full pytest suite in ephemeral test_runner container
moon run backend:test -- -k <pattern>       # container variant (args pass through to pytest)
moon run backend:shell                      # bash inside zas_backend
moon run backend:psql                       # interactive psql against zas_db
moon run backend:migrate                    # alembic upgrade head
moon run backend:make-migration "<message>" # alembic revision --autogenerate
moon run backend:seed-tenant                # python -m scripts.seed_tenant
moon run backend:seed-users                 # python -m scripts.seed_users (admin + caregiver)
moon run backend:seed                       # python -m scripts.seed_all
moon run backend:install                    # host uv sync (idempotent)
```

Seed data is owned by standalone scripts under `scripts/` — alembic revisions
are schema-only. The dev entrypoint chains `alembic upgrade head && python -m
scripts.seed_all` so a fresh `moon run :up` produces a fully-seeded DB. For
prod, run the same chain after `alembic upgrade head`: `python -m
scripts.seed_all`. Each script is idempotent — re-running is a no-op once
rows exist.

Native (run on host via `uv` — no docker round-trip; editor LSPs invoke the same binaries):

```bash
moon run backend:lint                       # ruff check
moon run backend:format                     # ruff format --check
moon run backend:typecheck                  # pyright
moon run backend:openapi                    # export openapi.json
```

Interactive API docs: <http://localhost:18000/docs> while `:up` is running.

## Architecture

- **`app/`** — FastAPI app package. `create_app()` factory in `app/main.py` builds the application, wires settings, logging, error handlers, CORS, adapter stubs and readiness checks.
- **`app/api/routers/`** — routers grouped by tag (`health`, `auth`, `patients` incl. Luscii link/data, future `fhir`).
- **`app/core/`** — cross-cutting concerns: `settings`, `errors`, `logging`, `readiness`, `security`.
- **`app/adapters/`** — external integrations. Each vendor has a `protocol.py` defining the seam; HiX ships a `stub.py` for the PoC, Luscii a live `http_client.py` (token-presence-driven).
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
├── scripts/                  # standalone operational scripts (seed_tenant, seed_all, ...)
├── tests/                    # mirrors app/ + scripts/ trees; conftest + fixtures + utils
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
