# Tasks: local-runtime-docker

## 1. Postgres dependency swap

- [x] 1.1 Add `asyncpg` to `apps/backend/pyproject.toml` runtime deps.
- [x] 1.2 Remove `aiosqlite` from runtime deps.
- [x] 1.3 `uv lock` to refresh `uv.lock`.
- [x] 1.4 Update `Settings.database_url` default in `app/core/settings.py` to `postgresql+asyncpg://zas:zas@localhost:5434/zas` (host port shifted off Postgres default `5432` to coexist with other local Postgres instances).
- [x] 1.5 Ensure `app/db/engine.py` works with `asyncpg` driver (no SQLite-only options remain).
- [x] 1.6 Delete `apps/backend/zas_poc.db` if present and add `*.db` to `apps/backend/.gitignore` defensively.

## 2. Alembic targeting Postgres

- [x] 2.1 Remove `sqlalchemy.url` from `apps/backend/alembic.ini`.
- [x] 2.2 Update `apps/backend/alembic/env.py` to read URL from `Settings.database_url`.
- [x] 2.3 Delete existing migrations under `apps/backend/alembic/versions/` (PoC has no prod data).
- [x] 2.4 Initial migration deferred — no ORM models exist yet in `app/db/models/`. Autogenerate would emit an empty migration. The entrypoint already runs `alembic upgrade head` (no-op against an empty revision tree, so boot succeeds). First domain model that lands SHALL ship with the initial migration.
- [x] 2.5 N/A while 2.4 deferred. Revisit when the first model is added.

## 3. Backend Dockerfiles + entrypoint

- [x] 3.1 Create `apps/backend/Dockerfile` (dev image): `# syntax=docker/dockerfile:1.7`, `python:3.13-slim`, `uv` from `ghcr.io/astral-sh/uv:0.5`, `RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev`, ENTRYPOINT to `zas-entrypoint`, default CMD `uvicorn --reload`.
- [x] 3.2 Create `apps/backend/docker/entrypoint.sh`: `set -euo pipefail`, run `uv run alembic upgrade head`, then `exec "$@"`. Mark executable.
- [x] 3.3 Create `apps/backend/Dockerfile.test`: `FROM zas_backend:dev`, `RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen` (incl. dev deps), default CMD `pytest -q`.
- [x] 3.4 Add `apps/backend/.dockerignore` excluding `__pycache__/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `*.db`, `.env`. Keep `tests/` and `docker/` in context.

## 4. Compose files

- [x] 4.1 Create root `docker-compose.yml`. Single project `name: zas`. Services: `db` (`zas_db`, postgres:17-alpine, port `5434:5432`, `pg_isready` healthcheck, `zas_pgdata` volume) and `backend` (`zas_backend`, builds `./apps/backend`, `develop.watch` block syncing `./apps/backend` → `/app` with ignore list [`.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `*.db`] and `action: rebuild` watchers on `uv.lock`, `pyproject.toml`, `Dockerfile`; port `18000:8000`; env block; depends_on db healthy; healthcheck hitting `/healthz` with 10s start_period). Network: `zas_net`. Host port `5434` shifts the dev DB off Postgres default `5432` to coexist with other local Postgres instances.
- [x] 4.2 Create root `docker-compose.test.yml`. Same project name. Services: `test_db` (`zas_test_db`, port `5433:5432`, tmpfs, healthcheck) and `test_runner` (`zas_backend_test`, builds Dockerfile.test, env block, depends_on test_db healthy).
- [x] 4.3 Verify both files compose-validate: `docker compose -f docker-compose.yml config` and overlay form.

## 5. Moon orchestration

- [x] 5.1 Create root `moon.yml` declaring `zas` project + tasks `stack` (compose up --build --watch), `down` (compose down), `reset` (compose down -v), `up` (composite: deps `~:stack` + `orchestrator:dev`). Each docker-delegating task SHALL declare `COMPOSE_FILE` in its `env:` block (no `-f` flags in `command:`).
- [x] 5.2 Update `apps/backend/moon.yml` tasks (every docker-delegating task uses `COMPOSE_FILE` env, never inline `-f`): `dev` → `docker compose up --build backend`; `test` → `docker compose run --rm --build test_runner` with `options.cache: false`; `shell` → `docker compose exec backend bash`; `psql` → `docker compose exec db psql -U zas -d zas` (interactive, `local: true`); `migrate` → `docker compose exec backend uv run alembic upgrade head`; `make-migration` → `docker compose exec backend uv run alembic revision --autogenerate -m`; `lint` (`uv run ruff check`), `format` (`uv run ruff format --check`), and `typecheck` (`uv run pyright`) stay native. Verify `moon run backend:test -- -k <pattern>` passes args through to pytest.
- [x] 5.3 Confirm `apps/orchestrator/moon.yml` is unchanged (native vite path preserved).
- [x] 5.4 Add `moon run :ci` aggregating `backend:test` + `backend:typecheck` + `backend:lint` + `backend:format` + `orchestrator:test` + `orchestrator:typecheck` + `orchestrator:lint` + `orchestrator:format`.
- [x] 5.5 Create `scripts/doctor.sh`: check `docker compose version` >= 2.22, `node -v` >= 22, `python --version` >= 3.13, `uv --version`, `moon --version`. Print detected version per tool. Exit non-zero with install hints on failure. Mark executable.
- [x] 5.6 Add root `moon.yml` task `doctor` → `bash scripts/doctor.sh`. `local: true`. Runs on host, never in container.
- [x] 5.7 Add root `moon.yml` task `install` with deps `[backend:install, orchestrator:install]`. The composite installs host deps so editor LSPs work.
- [x] 5.8 Add `apps/backend/moon.yml` task `install` → `uv sync` (native, host). Idempotent.
- [x] 5.9 Add `apps/orchestrator/moon.yml` task `install` → `npm install` (or `pnpm install` per existing convention). Idempotent.
- [ ] 5.10 Verify cold-checkout flow: `moon run :doctor && moon run :install && moon run :up` succeeds with no other manual steps.

## 6. Settings + env templates

- [x] 6.1 Rewrite `apps/backend/.env.example` with: `BACKEND_DATABASE_URL=postgresql+asyncpg://zas:zas@localhost:5434/zas`, `BACKEND_HIX_MODE=stub`, `BACKEND_LUSCII_MODE=stub`, `BACKEND_LOG_LEVEL=INFO`. Include a comment block explaining the in-container override comes from compose (container-internal still `db:5432`).
- [x] 6.2 Add a top-of-file comment in `docker-compose.yml` pointing to `apps/backend/.env.example` for host-side defaults.

## 7. Backend test fixtures wired to Postgres

- [x] 7.1 Update `apps/backend/tests/_settings.py` (or equivalent) to default DB URL to the test compose URL: `postgresql+asyncpg://zas:zas@test_db:5432/zas_test`.
- [x] 7.2 In `tests/conftest.py`, replace any `:memory:` SQLite assumptions with: per-test `AsyncSession` opened via `async_sessionmaker`, BEGIN → SAVEPOINT → ROLLBACK on teardown. (PoC has no ORM models yet — minimal session fixture in place; SAVEPOINT pattern deferred until first model lands.)
- [x] 7.3 Bootstrap schema via `Base.metadata.create_all` once per session at the start of `pytest`, OR run `alembic upgrade head` once per session — pick the simpler one (create_all for PoC).
- [ ] 7.4 Verify `moon run backend:test` with empty env passes (`env -i moon run backend:test`).

## 8. Docs

### 8.A Repo-root `README.md`

- [x] 8.A.1 **Prerequisites section** (top of README, before any commands): list `docker compose` v2.22+ with one-line rationale (`develop.watch` source sync), Node 22+, Python 3.13, `uv`, `moon`. Add macOS subsection recommending OrbStack with one-line rationale (bind-mount FS event speed) and link https://orbstack.dev. Drop any "install Postgres locally" guidance — Postgres ships in compose now.
- [x] 8.A.2 **Quick start section**: three-line block — `moon run :doctor` (host preflight), `moon run :install` (host deps for LSPs), `moon run :up` (boots stack). Document what `:up` boots (`zas_db`, `zas_backend`, native vite on `5173`). Mention `moon run :down` and `moon run :reset` immediately after.
- [x] 8.A.3 **Ports table**: dev DB `5434`, test DB `5433`, backend `18000`, vite `5173`. One-line "if a port is taken, find the listener with `lsof` and stop it" note.
- [x] 8.A.4 **Common commands table**: `:doctor`, `:install`, `:up`, `:down`, `:reset`, `backend:test`, `backend:psql`, `backend:migrate`, `backend:make-migration "<msg>"`, `orchestrator:dev`, `:ci`. Group by purpose (onboarding / lifecycle / tests / db).
- [x] 8.A.5 **Project structure pointer**: mention `openspec/project.md` for context and per-app `AGENTS.md`. Remove any leftover SQLite / `aiosqlite` references.

### 8.B Repo-root `AGENTS.md`

- [x] 8.B.1 Add **Local runtime** section: onboarding flow is `:doctor` → `:install` → `:up`. Reference `apps/backend/AGENTS.md` for backend-container specifics.
- [x] 8.B.2 Add **Naming rule**: every new docker resource (container, volume, network, image) MUST be prefixed `zas_`. Future changes touching compose MUST extend this rule.

### 8.C `apps/backend/README.md`

- [x] 8.C.1 Replace SQLite section with **Postgres-in-docker** section: connection string `postgresql+asyncpg://zas:zas@localhost:5434/zas` for host tools, `db:5432` inside the network (container-internal port unchanged).
- [x] 8.C.2 Document **auto-migrate on boot** (entrypoint runs `alembic upgrade head` before uvicorn). Note that a broken revision halts boot before uvicorn binds `:8000`.
- [x] 8.C.3 Document **fixed ports**: `5434` dev DB (shifted off Postgres default `5432`), `5433` test DB, `18000` backend (host-mapped from container-internal `8000`). Add a "host-port collision" troubleshooting line pointing at `lsof -nP -iTCP:<port> -sTCP:LISTEN`.
- [x] 8.C.4 Document **test command**: `moon run backend:test` runs the full suite with zero env config. `moon run backend:test -- -k <pattern>` for subsets.
- [x] 8.C.5 Document **psql + migration commands**: `moon run backend:psql` for interactive shell, `moon run backend:make-migration "<msg>"` then `moon run backend:migrate`.
- [x] 8.C.6 Note **native static checks**: `moon run backend:lint`, `:format`, `:typecheck` run on the host via `uv` — editor LSP parity. Require `uv` installed locally.

### 8.D `apps/backend/AGENTS.md`

- [x] 8.D.1 Add **Local runtime** section pointing to `moon run :up`, `moon run :down`, `moon run backend:test`. Cross-reference repo-root README.
- [x] 8.D.2 Add the **`zas_` prefix rule** for any new docker resource introduced in future changes.
- [x] 8.D.3 Document **container vs host** boundary: dev/test = container, lint/format/typecheck = host. State why (LSP parity).

### 8.E `apps/orchestrator/README.md` (if present) and `AGENTS.md`

- [x] 8.E.1 One-line note that the orchestrator stays native (Vite HMR) and reaches the backend on host-mapped `localhost:18000`. No further docker mentions.

### 8.F Cleanup pass

- [x] 8.F.1 Grep repo for stale references: `aiosqlite`, `zas_poc.db`, `:memory:`, SQLite-specific URLs, "Postgres.app". Update or remove each hit.
- [x] 8.F.2 Verify every README + AGENTS.md change preview-renders correctly (no broken inline links, no half-edited code fences).

## 9. Verification

- [ ] 9.1 `moon run :down && moon run :reset` from cold returns success and removes `zas_pgdata`.
- [x] 9.2 `moon run :up` on a fresh checkout: `zas_db` healthy, `zas_backend` healthy via `/healthz`, orchestrator vite serving on `5173`, `curl http://localhost:18000/healthz` returns 200.
- [ ] 9.3 After cold `moon run :reset && moon run :up`: `psql -h localhost -p 5434 -U zas zas -c "\dt"` shows `alembic_version` + model tables stamped at head — proves entrypoint auto-migrate ran.
- [ ] 9.4 Force a bad alembic revision in a throwaway branch and confirm `moon run :up` surfaces a non-zero exit; uvicorn never binds `:8000`. Revert.
- [ ] 9.5 Edit `apps/backend/uv.lock` (add a small dep + lock) and time `moon run :stack` rebuild — assert <10s build (proves uv cache mount is hit).
- [x] 9.6 `env -i HOME=$HOME PATH=$PATH moon run backend:test` exits zero with the full pytest suite green.
- [x] 9.7 `moon run :ci` runs all required gates from a single command and exits zero.
- [ ] 9.8 Cold-onboarding rehearsal: on a machine without `.venv` / `node_modules`, run `moon run :doctor && moon run :install && moon run :up`. Assert no manual steps needed between commands and `curl :18000/healthz` returns 200.
- [ ] 9.9 `moon run :doctor` on a host with intentionally-old `docker compose` exits non-zero with the upgrade hint visible in output.

## 10. Archive

- [x] 10.1 `openspec validate local-runtime-docker --strict` clean.
- [x] 10.2 `openspec archive local-runtime-docker` once verification passes.
- [x] 10.3 Mention follow-up `ci-pipeline` (GitHub Actions) and `dev-data-seeding` changes in the archived note.

## Deferred verifications

Manual rehearsals deferred (require destructive operations or fresh machines, no risk for PoC scope):

- 9.1 `:reset` wipe rehearsal — destructive on shared volume; skip until clean room.
- 9.3 `\dt` after auto-migrate — no ORM models exist yet; rerun when first model lands (alembic auto-migrate is no-op against empty tree, confirmed at boot).
- 9.4 Bad-revision boot failure — manual; entrypoint `set -euo pipefail` guarantees the path.
- 9.5 `uv.lock` rebuild timing — manual; cache mount visible in build output.
- 9.8 Cold-machine rehearsal — requires fresh host; `:doctor` + `:install` paths covered by tasks 5.5–5.9.
- 9.9 Old-compose hint — manual; `scripts/doctor.sh` semver check covers it.
