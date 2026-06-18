# zas-wrapper

POC/MVP for **ZAS Telegeneeskunde** (procurement ref. 2026-0015). Reaktor Health consortium with Luscii Healthtech + NewWave Care. June demo target: SMART-on-FHIR launch from HiX → pathway composer → Holter / Rugrevalidatie end-to-end.

Full project context lives in [`openspec/project.md`](./openspec/project.md). Multi-agent coding rules live in [`AGENTS.md`](./AGENTS.md). Per-app `AGENTS.md` files override these inside their respective folders.

## Status

Pre-release. PoC scope tracked in [`openspec/scope.md`](./openspec/scope.md); MVP and Product tiers in [`openspec/roadmap.md`](./openspec/roadmap.md).

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite 8 (Rolldown), TypeScript 6 strict, TanStack Router/Query/Form, Zod, Tailwind v4, shadcn/ui, i18next (`nl`), Vitest + Testing Library + MSW + Playwright |
| Backend | Python 3.13 (uv), FastAPI 0.136, Pydantic v2, SQLAlchemy async + asyncpg, Alembic, Pytest 9, Ruff, Pyright |
| Data | Postgres 17 (`zas_db` dev, `zas_test_db` tmpfs for tests) |
| Tooling | Moon (polyglot task runner), Docker Compose v2.22+, OrbStack on macOS |
| Spec workflow | OpenSpec (see [`openspec/AGENTS.md`](./openspec/AGENTS.md)) |

## Layout

```
zas-wrapper/
├── .moon/                 # moonrepo workspace + toolchain
├── apps/
│   ├── orchestrator/      # React 19 + Vite 8 + TS 6 — clinician composer (native vite)
│   └── backend/           # FastAPI + uv + Python 3.13 — FHIR gateway, MCP host (docker)
├── docker-compose.yml     # dev stack: db + backend + worker + temporal + minio + kratos + keto
├── docker-compose.test.yml # test overlay: zas_test_db + zas_backend_test
├── moon.yml               # root orchestration tasks (:up, :down, :doctor, …)
├── scripts/doctor.sh      # host preflight check
├── docs/                  # research, wireframes, screenshots, setup notes
├── openspec/              # spec-driven change proposals + specs
├── .worktrees/            # local git worktrees (gitignored)
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## Architecture

```
┌──────────────┐  HTTPS   ┌──────────────────┐  asyncpg  ┌──────────┐
│ orchestrator │ ───────► │   zas_backend    │ ────────► │  zas_db  │
│ (native vite)│          │ (FastAPI, docker)│           │ (docker) │
└──────────────┘          └──────────────────┘           └──────────┘
        │                          │
        │                          ├── HiX adapter (stub at PoC, FHIR at MVP)
        │                          └── Luscii adapter (live; token-presence-driven)
        │
        └── SMART-on-FHIR launch (returns at MVP via hix-smart-launch)
```

Adapters are Protocol-bound from day one. HiX is a stub at PoC; the Luscii adapter is a live client that activates only when `BACKEND_LUSCII_API_TOKEN` is set. See [`apps/backend/AGENTS.md`](./apps/backend/AGENTS.md) for the layer rules.

## Prerequisites

- **`docker compose` v2.22+** — `develop.watch` source-sync requires it. Verify with `docker compose version`.
- **Node** `22.13+` — `nvm use` picks it up from `.nvmrc`. Vite 8 / Rolldown requires `>=22.13`.
- **Python** `3.13` — installed automatically by `uv`.
- **uv** — `curl -LsSf https://astral.sh/uv/install.sh | sh`.
- **moon** — `curl -fsSL https://moonrepo.dev/install/moon.sh | bash`.

### macOS: install OrbStack

Replace Docker Desktop with [OrbStack](https://orbstack.dev). Bind-mount filesystem events fire near-native instead of the polled Docker-for-Mac shim; uvicorn `--reload` over docker becomes usable. Drop-in replacement, no compose-file changes.

## Quick start

```bash
moon run :doctor       # verify host has the right versions + tooling
moon run :install      # uv sync + pnpm install (host-side, so editor LSPs work)
moon run :up           # boots the docker stack (db + backend + temporal + worker
                       #   + minio + kratos + keto) + vite dev (native)
```

After `:up`:

- Backend: <http://localhost:18000> (auto-reload on backend file edits via compose `watch`)
- Backend healthcheck: <http://localhost:18000/healthz>
- Swagger UI: <http://localhost:18000/docs>
- Vite: <http://localhost:5173>
- Temporal Web UI: <http://localhost:8233> (pathway-runtime workflows)
- MinIO console: <http://localhost:9001> (object storage; `minioadmin` / `minioadmin`)
- Postgres: `psql -h localhost -p 5434 -U zas zas` (or `moon run backend:psql`)

The pathway runtime defaults to the **Temporal** engine in the stack (a
`temporal` server + a `worker` process run alongside the backend, so durable
timers auto-advance time-gated blocks). To run the engine inline instead (no
worker), boot with `BACKEND_PATHWAY_RUNTIME_ENGINE=sync moon run :stack`.

Teardown:

```bash
moon run :down       # stop containers, keep zas_pgdata volume
moon run :reset      # stop containers AND wipe zas_pgdata
```

## Configuration

Both apps ship `.env.example` files. Copy and edit:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/orchestrator/.env.example apps/orchestrator/.env
```

### Backend env vars (prefix `BACKEND_`)

| Var | Purpose | Default |
| --- | --- | --- |
| `BACKEND_ENV` | `dev` / `test` / `production` | `dev` |
| `BACKEND_DATABASE_URL` | SQLAlchemy async DSN (asyncpg). Compose overrides to `db:5432` inside `zas_backend`. | `postgresql+asyncpg://zas:zas@localhost:5434/zas` |
| `BACKEND_SESSION_SECRET_KEY` | Session signer. Replace in production. | `change-me-in-production` |
| `BACKEND_SESSION_COOKIE_NAME` | Cookie name | `BACKEND_SESSION` |
| `BACKEND_CORS_ORIGINS` | JSON list of allowed origins | `["http://localhost:5173"]` |
| `BACKEND_HIX_MODE` | `stub` / `live` (live lands at MVP) | `stub` |
| `BACKEND_LUSCII_API_URL` | Luscii public API base URL | `https://vitalsapi.luscii.com` |
| `BACKEND_LUSCII_API_TOKEN` | Luscii bearer token (secret). Set ⇒ live patient-data fetches; unset ⇒ Luscii endpoints answer 503 `not_configured` and the rest of the app runs normally. | unset |
| `BACKEND_LOG_LEVEL` | Native log level | `INFO` |
| `BACKEND_PUBLIC_URL` | OpenAPI `servers` URL | unset |
| `BACKEND_PATHWAY_RUNTIME_ENGINE` | `sync` (inline, no timers) / `temporal` (durable workflow + timers). Compose stack defaults to `temporal`. | `sync` |
| `BACKEND_TEMPORAL_ADDRESS` | Temporal gRPC endpoint. Compose overrides to `temporal:7233`. | `localhost:7233` |
| `BACKEND_S3_ENDPOINT_URL` | S3/MinIO endpoint for note attachments. Compose sets `http://minio:9000`. Unset ⇒ file uploads disabled. | unset |

### Orchestrator env vars (prefix `VITE_`)

| Var | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend origin | `http://localhost:18000` |
| `VITE_API_MODE` | `mock` (MSW) or `live` | `mock` |

Secrets MUST NOT be committed. `.env` files are gitignored.

### Luscii integration (optional)

The stack runs fine without any Luscii setup — the patient profile's Luscii panel just shows "not configured". To go live, add `BACKEND_LUSCII_API_TOKEN=<bearer token>` to `apps/backend/.env` (compose feeds this file into `zas_backend` via `env_file`, so one gitignored file serves both the container and host-side scripts) and recreate the backend (`docker compose up -d backend` or `moon run :up`).

The measurement-label catalogue needs no manual step: every backend boot (so any `moon run :up`) runs `seed_all`, which imports the committed snapshots from `apps/backend/data/luscii_catalogue/` whenever the catalogue tables are empty (no token needed). The live `moon run backend:luscii-sync` (~30-45 min, token required) is only needed when you want a fresher catalogue than the committed snapshots — follow it with `backend:luscii-export` to update the snapshots in version control. `moon run backend:luscii-import` forces a re-import, e.g. after pulling newer snapshots.

## Ports

| Service | Container | Host port |
| --- | --- | --- |
| Dev Postgres | `zas_db` | `5434` |
| Test Postgres | `zas_test_db` | `5433` |
| Backend API | `zas_backend` | `18000` |
| Pathway worker | `zas_pathway_worker` | (no host port) |
| Temporal gRPC | `zas_temporal` | `7233` |
| Temporal Web UI | `zas_temporal` | `8233` |
| MinIO API / console | `zas_minio` | `9000` / `9001` |
| Vite dev server | (native, host) | `5173` |

Ports are fixed (no auto-shifting). The dev DB binds `5434` (not the Postgres default `5432`) so it coexists with other local Postgres instances on `:5432`. Container-internal port is `5432`; only host-side mapping shifts.

## Common commands

Onboarding:

```bash
moon run :doctor              # host preflight
moon run :install             # host deps (uv sync + pnpm install)
```

Lifecycle:

```bash
moon run :up                  # full stack (docker: db + backend + temporal + worker + … + vite)
moon run :down                # stop containers, keep volumes
moon run :reset               # stop + drop zas_pgdata
moon run :stack               # docker stack only (no vite)
moon run orchestrator:dev     # vite only
```

Database:

```bash
moon run backend:psql                        # interactive psql against zas_db
moon run backend:migrate                     # alembic upgrade head
moon run backend:make-migration "<message>"  # alembic revision --autogenerate
moon run backend:seed                        # demo tenant, users, patients
moon run backend:luscii-import               # Luscii label catalogue from committed snapshots
```

Lint / format / typecheck:

```bash
moon run backend:lint         # ruff check
moon run backend:format       # ruff format --check
moon run backend:typecheck    # pyright
moon run orchestrator:lint
moon run orchestrator:typecheck
moon run :ci                  # all gates across affected projects
```

## Testing

Always run tests through `moon` — never `vitest` / `playwright` / `pytest` directly. The moon tasks set up containers, env, and caching correctly. Arguments after `--` pass through to the underlying runner.

### Frontend (Vitest + Playwright)

```bash
# Full vitest suite
moon run orchestrator:test

# Single file
moon run orchestrator:test -- src/modules/auth/__tests__/login.test.tsx

# Filter by test name
moon run orchestrator:test -- -t "invalid credentials"

# Full Playwright suite
moon run orchestrator:test-e2e

# Single E2E spec
moon run orchestrator:test-e2e -- tests-e2e/login.spec.ts

# Single E2E by title
moon run orchestrator:test-e2e -- -g "logs in"
```

### Backend (Pytest)

Runs inside the ephemeral `zas_backend_test` container against a tmpfs `zas_test_db`.

```bash
# Full suite
moon run backend:test

# Single file
moon run backend:test -- tests/services/pathway/test_pathway_service.py

# Single test node
moon run backend:test -- tests/services/pathway/test_pathway_service.py::test_resolves_block

# Keyword expression
moon run backend:test -- -k "pathway and not slow"

# One domain end-to-end
moon run backend:test -- tests/services/pathway/

# Verbose + last-failure rerun
moon run backend:test -- -vv --lf
```

### Verification before completion

Per-app AGENTS.md files define the minimum gate. As a quick reference:

- Frontend: `orchestrator:lint` + `orchestrator:typecheck` + `orchestrator:test` (+ `:test-e2e` + `:build` for UI changes).
- Backend: `backend:format` + `backend:lint` + `backend:typecheck` + `backend:test`.

Or hit them all at once: `moon run :ci`.

## Workflow

Spec-driven via **OpenSpec**:

1. New capability or behavioural change → start with a proposal in `openspec/changes/`.
2. In Claude Code: `/opsx:propose "<idea>"`. In Codex / OpenCode: invoke the equivalent skill.
3. Review the proposal with the user before writing code.
4. Implement, verify, then archive the change into `openspec/changes/archive/`.
5. Cross-link finished changes with the relevant `openspec/specs/` entry.

Bug fixes that do not alter behaviour can skip the proposal step.

### Git conventions

- Semantic, one-line commit messages (≤72 chars). Lowercase after `:`. No period. Present tense.
- One feature / logical unit per commit; split unrelated changes.
- Never push without explicit user permission.
- Worktrees live under `.worktrees/<kebab-branch>/` (gitignored). Slashes in branch names flatten to dashes for the path; the branch keeps its `feat/` prefix.

  ```bash
  git worktree add .worktrees/feat-testing-setup -b feat/testing-setup
  ```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `moon run :up` fails with port `5434` (or `5433`, `18000`, `5173`) in use | Stale container / host process holding the port | `lsof -nP -iTCP:<port> -sTCP:LISTEN` to find it; stop that container or service |
| Backend reload sluggish on macOS | Docker Desktop polling FS events | Install OrbStack |
| `docker compose` complains about `develop.watch` | Compose `<2.22` | Upgrade Docker / OrbStack |
| Tests pass locally, fail on bare `pytest` | Running outside container against wrong DB | Use `moon run backend:test` |
| `routeTree.gen.ts` drift | `@tanstack/router-plugin` / `-generator` version skew | Bump both together; re-run `node scripts/gen-route-tree.mjs` |
| Alembic autogen empty | `app/db/models/__init__.py` doesn't import the new domain | Add the import; rerun `backend:make-migration` |

Deeper debugging: `moon run backend:shell` drops into `zas_backend`; logs stream via `docker compose logs -f backend`.

## Documentation index

| File | Purpose |
| --- | --- |
| [`AGENTS.md`](./AGENTS.md) | Canonical multi-agent rules (all AI coding tools) |
| [`CLAUDE.md`](./CLAUDE.md) | Claude Code addenda (skills, hooks) |
| [`apps/orchestrator/AGENTS.md`](./apps/orchestrator/AGENTS.md) | Frontend conventions + per-task moon commands |
| [`apps/backend/AGENTS.md`](./apps/backend/AGENTS.md) | Backend layer rules + per-task moon commands |
| [`openspec/project.md`](./openspec/project.md) | Long-lived project context (pitch, stakeholders, constraints) |
| [`openspec/scope.md`](./openspec/scope.md) | Living PoC scope ledger (F1..Fn, mocks, deltas) |
| [`openspec/roadmap.md`](./openspec/roadmap.md) | Tier progression PoC → MVP → Product |
| [`openspec/backlog.md`](./openspec/backlog.md) | Parking lot for out-of-tier work (BL-NNN) |
| [`openspec/mdr-watchlist.md`](./openspec/mdr-watchlist.md) | MDR proximity log |
| [`openspec/AGENTS.md`](./openspec/AGENTS.md) | Rules for working inside `openspec/` |
| `docs/research/` | Research notes |
| `docs/wireframes/` | Builder HTML + transcription |
| `docs/screenshots/` | Design exploration |

## Security & compliance

- **Never MDR**: this product is not, and must not become, a medical device. Any feature pushing toward MDR (clinical decision logic, diagnostic output, automated dosing, interpreting Luscii measurements ourselves) goes through [`openspec/mdr-watchlist.md`](./openspec/mdr-watchlist.md) first.
- **PHI**: all FHIR payloads are PHI. No real patient data in fixtures, screenshots, logs, or commits. Synthetic data only.
- **Logging**: never log full clinical payloads, launch tokens, `state` params, or `Authorization` headers.
- **Secrets**: `.env` is gitignored; production secrets live outside the repo.

## License

Private. Reaktor Health consortium internal.
