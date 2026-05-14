# local-runtime Specification

## Purpose
TBD - created by archiving change local-runtime-docker. Update Purpose after archive.
## Requirements
### Requirement: Postgres for dev + test

The backend SHALL run against Postgres 17 in every dev and test execution. SQLite SHALL NOT be supported as a backend persistence target. The PoC adopts Postgres parity from day one so migrations, query shapes, and adapter idioms match `[mvp]` and prod.

#### Scenario: Dev DB is Postgres

- **WHEN** a developer runs `moon run :stack`
- **THEN** a Postgres 17 container named `zas_db` starts on host port `5434` (container-internal `5432`) and the backend connects to it via `postgresql+asyncpg://zas:zas@db:5432/zas`

#### Scenario: aiosqlite removed

- **WHEN** the dependency manifest `apps/backend/pyproject.toml` is inspected
- **THEN** `aiosqlite` is absent from runtime + dev dependencies and `asyncpg` is present

### Requirement: Compose project + naming

Every docker artefact SHALL be named with the `zas_` prefix or live under the `zas` compose project. Containers MUST set `container_name:` explicitly for predictability. Volumes, networks, and built images SHALL match the same convention.

#### Scenario: Containers prefixed

- **WHEN** `docker ps` runs after `moon run :stack`
- **THEN** every running container in the stack has a name starting with `zas_` (`zas_db`, `zas_backend`, …)

#### Scenario: Volumes + network prefixed

- **WHEN** `docker volume ls` and `docker network ls` run after `moon run :stack`
- **THEN** dev data volume is named `zas_pgdata` and the network is `zas_net`

### Requirement: Fixed ports, no auto-assignment

Host ports SHALL be fixed per service. Compose MUST NOT use the random-port form (`"5432"` alone) — every port mapping uses the explicit `"HOST:CONTAINER"` form. Port collisions surface as boot failures, not silent auto-shifting.

#### Scenario: Dev DB binds 5434

- **WHEN** `moon run :stack` boots the stack on a host with port `5434` free
- **THEN** `zas_db` binds host `5434` → container `5432`, accessible via `psql -h localhost -p 5434 -U zas zas`. Host port `5434` (not Postgres default `5432`) lets the stack coexist with other local Postgres instances.

#### Scenario: Test DB binds 5433

- **WHEN** `moon run backend:test` runs while the dev stack is also up
- **THEN** the test DB container `zas_test_db` binds host `5433` and does not conflict with `zas_db` on `5434`

#### Scenario: Backend API binds 18000

- **WHEN** `moon run :stack` boots and `zas_backend` is healthy
- **THEN** `curl http://localhost:18000/healthz` returns `200` via the host-mapped port (container-internal `:8000`)

### Requirement: Backend runs in container during dev

The backend SHALL execute inside the `zas_backend` container during `moon run :stack`. Source synchronisation MUST use the compose `develop.watch` block (compose v2.22+), not a raw bind mount, with `action: sync` for source files and `action: rebuild` for `uv.lock`, `pyproject.toml`, and `Dockerfile`. The `ignore` list MUST exclude `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, and `*.db`. The `:stack` task SHALL invoke compose with `up --watch` so the watcher runs alongside the stack.

#### Scenario: Edit-reload loop works

- **WHEN** a developer edits `apps/backend/app/main.py` while `moon run :stack` is running
- **THEN** compose syncs the changed file into `zas_backend`, uvicorn's reloader detects the change, and the next request serves the new code

#### Scenario: Image rebuild on lock change

- **WHEN** `apps/backend/uv.lock` changes while `moon run :stack` is running
- **THEN** compose watches the file, triggers `action: rebuild` automatically, and the container restarts with fresh deps without a manual `compose up --build`

#### Scenario: Ignore list keeps caches out of container

- **WHEN** a test run on the host writes to `apps/backend/.pytest_cache/` or `apps/backend/__pycache__/`
- **THEN** compose does NOT propagate those paths into `zas_backend` — preventing host/container cache collisions

### Requirement: Minimum compose version documented

The repo `README.md` SHALL document `docker compose` v2.22 or newer as a hard requirement, with a one-line note that `develop.watch` is the reason. `moon run :stack` MUST surface a clear error if the installed compose CLI is too old — either via a preflight check or via the native compose error.

#### Scenario: README states minimum compose version

- **WHEN** a contributor reads the setup section of the root `README.md`
- **THEN** they see "requires `docker compose` v2.22+" with a one-line rationale (`develop.watch` is used for source sync)

### Requirement: Frontend runs natively

The orchestrator (Vite + React) SHALL run on the host via `npm run dev` / `moon run orchestrator:dev`. It SHALL NOT be containerised in this change. Vite HMR over bind-mounted node_modules on macOS is known to be slow and is explicitly avoided.

#### Scenario: Orchestrator boots natively

- **WHEN** `moon run orchestrator:dev` runs
- **THEN** Vite starts on host port `5173`, reads source from `apps/orchestrator/src/`, and uses the host filesystem directly

#### Scenario: Frontend calls containerised backend

- **WHEN** a Vite dev page calls `http://localhost:18000/healthz`
- **THEN** the request reaches `zas_backend` via the published port mapping; no docker network rewriting needed

### Requirement: Preflight host check via moon

`moon run :doctor` SHALL verify host prerequisites before any docker work and exit non-zero with actionable install hints if any are missing or outdated. Checks: `docker compose version` >= 2.22, `node --version` >= 22, `python --version` >= 3.13, `uv --version` present, `moon --version` present. Implementation MAY be a shell script under `scripts/doctor.sh` invoked by the moon task. Output MUST list each tool, its detected version (or "missing"), and the install hint on failure.

#### Scenario: Doctor passes on a ready host

- **WHEN** a contributor with all prereqs installed runs `moon run :doctor`
- **THEN** every tool reports its version, the task exits zero, and the output ends with "ready to run moon run :up"

#### Scenario: Doctor flags missing compose v2.22+

- **WHEN** the host has `docker compose` v2.20 installed
- **THEN** `moon run :doctor` exits non-zero, prints the detected version, names the requirement (`v2.22+`), and prints the install hint (upgrade Docker Desktop / OrbStack)

#### Scenario: Doctor is referenced in onboarding

- **WHEN** a contributor follows the repo-root `README.md` quick-start
- **THEN** the very first command is `moon run :doctor`, before `moon run :install` and `moon run :up`

### Requirement: Install host workspace via moon

`moon run :install` SHALL prepare the host workspace so editor LSPs and native moon tasks (`backend:lint`, `:format`, `:typecheck`, `orchestrator:dev`) work without further commands. The task SHALL run `uv sync` inside `apps/backend/` and `npm install` (or `pnpm install` per existing convention) inside `apps/orchestrator/`. The task MUST be idempotent.

#### Scenario: Install populates backend host deps

- **WHEN** a contributor runs `moon run :install` on a fresh checkout
- **THEN** `apps/backend/.venv` is created via `uv sync` and Pylance / ruff-lsp pick it up automatically

#### Scenario: Install populates orchestrator host deps

- **WHEN** the same `moon run :install` invocation completes
- **THEN** `apps/orchestrator/node_modules` exists and `moon run orchestrator:dev` starts vite without further install steps

#### Scenario: Install is idempotent

- **WHEN** `moon run :install` runs a second time with no upstream changes
- **THEN** both `uv sync` and `npm install` report no-op (or near no-op) and the task exits zero quickly

### Requirement: Single command to boot everything

`moon run :up` SHALL boot the full dev stack: Postgres in docker, backend in docker, orchestrator natively. The composite task wires `~:stack` (docker stack) plus `orchestrator:dev` (native) as parallel deps.

#### Scenario: One-command boot

- **WHEN** a fresh checkout runs `moon run :up`
- **THEN** `zas_db` + `zas_backend` containers come up via compose AND vite dev server starts on the host, all in parallel, with no further commands

### Requirement: Single command to run backend tests

`moon run backend:test` SHALL execute the full pytest suite without the caller setting any environment variables. Implementation: compose runs the `test_runner` service with `--rm`, env baked into `docker-compose.test.yml`, against the ephemeral `zas_test_db`.

#### Scenario: Test command needs no env

- **WHEN** an agent or developer runs `moon run backend:test` with an empty shell environment (`env -i moon run backend:test`)
- **THEN** the suite executes against `zas_test_db` and reports pass/fail; no `BACKEND_DATABASE_URL`, no `PGHOST`, no inline overrides required

#### Scenario: Test DB is ephemeral

- **WHEN** `moon run backend:test` completes
- **THEN** `zas_test_db` either stops or stays warm for re-runs, but its data is tmpfs-backed and reset on container recreation

#### Scenario: Test runner exits with pytest's exit code

- **WHEN** a pytest assertion fails inside `zas_backend_test`
- **THEN** `moon run backend:test` exits non-zero and the moon CI gate fails

#### Scenario: Passthrough args reach pytest

- **WHEN** a developer runs `moon run backend:test -- -k test_auth -x`
- **THEN** the trailing args pass through compose into the `test_runner` CMD, pytest receives `-k test_auth -x`, and only matching tests run

### Requirement: Single command for full teardown

`moon run :down` SHALL stop and remove every container started by either compose file. `moon run :reset` SHALL additionally remove the `zas_pgdata` volume so the next `:up` starts with a clean DB.

#### Scenario: Down stops everything

- **WHEN** `moon run :down` executes after `moon run :up`
- **THEN** `docker ps --filter "name=zas_"` returns zero matching containers AND `zas_pgdata` volume is preserved

#### Scenario: Reset wipes the volume

- **WHEN** `moon run :reset` executes
- **THEN** `zas_pgdata` is removed AND the next `moon run :up` recreates an empty Postgres data directory

### Requirement: Interactive psql via moon

`moon run backend:psql` SHALL open an interactive `psql` shell connected to `zas_db` as the `zas` user against the `zas` database. The task MUST delegate to `docker compose exec db psql -U zas -d zas` so the caller never invokes docker directly.

#### Scenario: psql opens against dev DB

- **WHEN** `moon run backend:psql` runs while `zas_db` is healthy
- **THEN** the contributor lands at a `zas=#` prompt connected inside the `zas_db` container with read/write access to the dev database

#### Scenario: psql fails fast when stack is down

- **WHEN** `moon run backend:psql` runs while `zas_db` is not running
- **THEN** the task exits non-zero with the underlying compose error, prompting the caller to `moon run :up` first

### Requirement: Alembic migrations via moon

`moon run backend:migrate` SHALL apply the current head migration to `zas_db`. `moon run backend:make-migration "<message>"` SHALL generate a new autogenerated revision against the live schema. Both delegate to `alembic` inside `zas_backend`.

#### Scenario: Migrate applies head

- **WHEN** `moon run backend:migrate` runs against a fresh `zas_db`
- **THEN** alembic creates the `alembic_version` table and stamps the head revision

#### Scenario: Autogenerate sees live schema

- **WHEN** a model class is added in `app/db/models/` and `moon run backend:make-migration "add foo"` runs
- **THEN** alembic generates a new revision file under `apps/backend/alembic/versions/` with the expected `op.create_table(...)` for the new model

### Requirement: Moon tasks use COMPOSE_FILE env over inline -f flags

Every docker-delegating moon task SHALL set the compose file list via the `COMPOSE_FILE` env var in the task's `env:` block. The `command:` string SHALL invoke `docker compose <verb> …` without inline `-f path/to/file.yml` flags. Goal: short, uniform commands; the file list is declared once per task instead of being repeated in every line.

#### Scenario: Moon task declares COMPOSE_FILE in env

- **WHEN** a contributor inspects `apps/backend/moon.yml` for the `test` task
- **THEN** they see `env: { COMPOSE_FILE: "../../docker-compose.yml:../../docker-compose.test.yml" }` and a `command:` that reads `docker compose run --rm --build test_runner` — no `-f` flags

#### Scenario: Moon task command stays short

- **WHEN** a contributor inspects any docker-delegating task (`dev`, `test`, `shell`, `psql`, `migrate`, `make-migration`)
- **THEN** the `command:` value is a bare `docker compose <verb> …` invocation that fits on one line

### Requirement: Static checks stay native

`moon run backend:lint`, `moon run backend:format`, and `moon run backend:typecheck` SHALL execute on the host via `uv run ruff …` and `uv run pyright`. The contributor MUST have `uv` installed locally. Rationale: editor LSP (Pylance / ruff-lsp) calls the same binaries with the same config — CI/editor parity. Container round-trips for read-only checks are pure overhead.

#### Scenario: Lint runs without docker

- **WHEN** `docker daemon` is stopped and `moon run backend:lint` runs
- **THEN** the task succeeds because `uv run ruff check` only uses the host

#### Scenario: Typecheck runs without docker

- **WHEN** `moon run backend:typecheck` runs
- **THEN** `uv run pyright` executes against the host workspace, sharing the same `pyrightconfig.json` (or `pyproject.toml` config block) the editor uses, and reports zero errors on a clean tree

### Requirement: Healthchecks block dependent services

Postgres services SHALL declare a `pg_isready`-based healthcheck. The backend service SHALL declare its own healthcheck that hits `/healthz` so future services (orchestrator, MCP host) can chain `depends_on: backend: { condition: service_healthy }`. Backend services SHALL declare `depends_on: <db>: { condition: service_healthy }` so the application never boots before the DB is ready.

#### Scenario: Backend waits for DB

- **WHEN** `moon run :stack` starts a fresh stack
- **THEN** `zas_backend` does not run uvicorn until `pg_isready` against `zas_db` succeeds; logs show the DB healthy line before the backend "started server process" line

#### Scenario: Test runner waits for test DB

- **WHEN** `moon run backend:test` starts `zas_test_db` from cold
- **THEN** the `test_runner` service waits for the `pg_isready` healthcheck to pass before pytest invocation

#### Scenario: Backend healthcheck reports ready

- **WHEN** `zas_backend` is up and migrations have finished
- **THEN** `docker inspect --format '{{.State.Health.Status}}' zas_backend` reports `healthy`, driven by an interval check against `http://localhost:8000/healthz` returning `200`

### Requirement: Backend auto-migrates on container boot

The `zas_backend` container SHALL run `alembic upgrade head` automatically before starting uvicorn. The entrypoint MUST wait for the DB healthcheck (covered by `depends_on`), apply migrations, then exec uvicorn. The auto-migrate step MUST be idempotent and MUST fail loud if a migration errors, preventing uvicorn from starting against a half-migrated schema. Manual control remains available via `moon run backend:migrate` for explicit invocations.

#### Scenario: Cold boot applies head

- **WHEN** `moon run :reset && moon run :up` runs against an empty `zas_pgdata` volume
- **THEN** the backend entrypoint applies all alembic revisions before uvicorn binds port `8000`, and the `alembic_version` table stamps the head revision

#### Scenario: Migration failure halts boot

- **WHEN** an alembic revision raises an exception during entrypoint
- **THEN** uvicorn never starts, the container exits non-zero, and `moon run :up` surfaces the failure in its compose output

### Requirement: Dockerfile uses uv cache mount

The backend Dockerfile SHALL use a BuildKit cache mount for the uv dependency cache (`--mount=type=cache,target=/root/.cache/uv`) on the `uv sync` step. Goal: rebuilds after `uv.lock` changes complete in seconds, not 30+ seconds.

#### Scenario: Re-sync hits cache

- **WHEN** a developer adds a new dependency and re-runs `moon run :stack`
- **THEN** the `uv sync --frozen` layer reuses the cached wheels from the prior build, and the image build completes in single-digit seconds for typical small dependency adds

### Requirement: `.env.example` documents Postgres + container defaults

`apps/backend/.env.example` SHALL document `BACKEND_DATABASE_URL` with the host-side URL (`postgresql+asyncpg://zas:zas@localhost:5434/zas`) and explain that the in-container override is set by compose. The file MUST also list `BACKEND_HIX_MODE`, `BACKEND_LUSCII_MODE`, and `BACKEND_LOG_LEVEL` with default values.

#### Scenario: Onboarding from `.env.example`

- **WHEN** a new contributor copies `.env.example` to `.env` and runs `moon run :up`
- **THEN** the stack boots without further env edits

### Requirement: Naming guidance documented in AGENTS.md

`apps/backend/AGENTS.md` SHALL document the `zas_` prefix rule for any new docker resource introduced (additional services, volumes, networks). Future changes that touch compose MUST extend this rule.

#### Scenario: New service follows prefix

- **WHEN** a future change introduces an MCP host container
- **THEN** that container is named `zas_mcp` per the documented rule and the change references this requirement in its proposal

### Requirement: README recommends OrbStack on macOS

The root `README.md` (and/or repo onboarding doc) SHALL recommend [OrbStack](https://orbstack.dev) for macOS contributors as a Docker Desktop replacement. Bind-mount filesystem performance on Docker Desktop for macOS is the primary friction point for Shape 2 (containerised backend + source bind mount); OrbStack resolves it as a drop-in replacement with no compose-file changes.

#### Scenario: Onboarding doc mentions OrbStack

- **WHEN** a new macOS contributor reads the repo README to set up locally
- **THEN** they encounter a "macOS: install OrbStack" note before the `moon run :up` instructions, with a single-line rationale (faster bind-mount FS events) and the OrbStack install link

