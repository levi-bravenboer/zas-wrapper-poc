# zas-wrapper

POC/MVP for **ZAS Telegeneeskunde** (procurement ref. 2026-0015). Reaktor Health consortium with Luscii Healthtech + NewWave Care. June demo target: SMART-on-FHIR launch from HiX → pathway composer → Holter / Rugrevalidatie end-to-end.

Full project context lives in [`openspec/project.md`](./openspec/project.md). Multi-agent coding rules live in [`AGENTS.md`](./AGENTS.md). Per-app `AGENTS.md` files override these inside their respective folders.

## Layout

```
zas-wrapper/
├── .moon/                # moonrepo workspace + toolchain
├── apps/
│   ├── orchestrator/     # React 19 + Vite 8 + TS 6 — clinician composer (native vite)
│   └── backend/          # FastAPI + uv + Python 3.13 — FHIR gateway, MCP host (docker)
├── docker-compose.yml    # dev stack: zas_db + zas_backend
├── docker-compose.test.yml # test overlay: zas_test_db + zas_backend_test
├── moon.yml              # root orchestration tasks (:up, :down, :doctor, …)
├── scripts/doctor.sh     # host preflight check
├── docs/
├── openspec/             # spec-driven change proposals + specs
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## Prerequisites

- **`docker compose` v2.22+** — `develop.watch` source-sync requires it. Verify with `docker compose version`.
- **Node** `22+` — `nvm use` picks it up from `.nvmrc`.
- **Python** `3.13` — installed automatically by `uv`.
- **uv** — `curl -LsSf https://astral.sh/uv/install.sh | sh`.
- **moon** — `curl -fsSL https://moonrepo.dev/install/moon.sh | bash`.

### macOS: install OrbStack

Replace Docker Desktop with [OrbStack](https://orbstack.dev). Bind-mount filesystem events fire near-native instead of the polled Docker-for-Mac shim; uvicorn `--reload` over docker becomes usable. Drop-in replacement, no compose-file changes.

## Quick start

```bash
moon run :doctor       # verify host has the right versions + tooling
moon run :bootstrap    # uv sync + npm install (host-side, so editor LSPs work)
moon run :up           # boots zas_db + zas_backend (docker) + vite dev (native)
```

After `:up`:

- Backend: <http://localhost:8000> (auto-reload on backend file edits via compose `watch`)
- Backend healthcheck: <http://localhost:8000/healthz>
- Vite: <http://localhost:5173>
- Postgres: `psql -h localhost -p 5432 -U zas zas` (or `moon run backend:psql`)

Teardown:

```bash
moon run :down       # stop containers, keep zas_pgdata volume
moon run :reset      # stop containers AND wipe zas_pgdata
```

## Ports

| Service | Container | Host port |
| --- | --- | --- |
| Dev Postgres | `zas_db` | `5432` |
| Test Postgres | `zas_test_db` | `5433` |
| Backend API | `zas_backend` | `8000` |
| Vite dev server | (native, host) | `5173` |

Ports are fixed (no auto-shifting). If `5432` is taken by a host Postgres (e.g. Postgres.app, `brew services postgresql`), stop the host service before `moon run :up`.

## Common commands

Onboarding:

```bash
moon run :doctor              # host preflight
moon run :bootstrap           # host deps (uv sync + npm install)
```

Lifecycle:

```bash
moon run :up                  # full stack (db + backend + vite)
moon run :down                # stop containers, keep volumes
moon run :reset               # stop + drop zas_pgdata
moon run :dev                 # docker stack only (no vite)
moon run orchestrator:dev     # vite only
```

Tests + checks:

```bash
moon run backend:test         # full pytest suite in ephemeral test_runner container
moon run backend:test -- -k <pattern>   # subset
moon run backend:lint         # native, ruff
moon run backend:format       # native, ruff --check
moon run backend:typecheck    # native, pyright
moon run orchestrator:test    # vitest
moon run :ci                  # all gates in one
```

Database:

```bash
moon run backend:psql                       # interactive psql against zas_db
moon run backend:migrate                    # alembic upgrade head
moon run backend:makemigration "<message>"  # alembic revision --autogenerate
```

## Workflow

Spec-driven via **OpenSpec**. New behavioural changes start as proposals in `openspec/changes/` (use the `/opsx:propose` slash command in Claude Code). Implementation, verification, then archive into `openspec/changes/archive/`.

## Conventions

See [`AGENTS.md`](./AGENTS.md) for coding standards, git rules, security posture, and per-app conventions. Each app also has its own `AGENTS.md` and `README.md`.

## License

Private. Reaktor Health consortium internal.
