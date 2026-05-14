# Design: local-runtime-docker

## Goals

1. **One-command up:** `moon run :stack` boots db + backend (containerised) and orchestrator (native).
2. **One-command tests:** `moon run backend:test` runs full pytest suite with no env vars set by the caller.
3. **Postgres parity:** every dev / test query hits Postgres, never SQLite.
4. **Stable naming:** every docker artefact prefixed `zas_` for grep-ability and to avoid collisions with other repos on the same host.
5. **Predictable ports:** no random ports, no docker-assigned ports, no surprises.

## Naming + ports

| Resource | Name | Port |
|---|---|---|
| Dev DB container | `zas_db` | `5432:5432` |
| Test DB container | `zas_test_db` | `5433:5432` |
| Backend container | `zas_backend` | `8000:8000` |
| Backend test runner | `zas_backend_test` | — (ephemeral) |
| Compose project | `zas` | — |
| Network | `zas_net` | — |
| Dev DB volume | `zas_pgdata` | — |
| Test DB volume | none (tmpfs / drop on `down`) | — |
| Backend image | `zas_backend:dev` | — |
| Backend test image | `zas_backend:test` | — |

Frontend (Vite dev server) stays on host port `5173`. Reflected via `vite.config.ts` already.

## Compose layout

Two compose files at repo root:

- **`docker-compose.yml`** — default for `moon run :stack`. Services: `db`, `backend`.
- **`docker-compose.test.yml`** — overlay for `moon run backend:test`. Services: `test_db`, `test_runner`. Pulled in via `-f docker-compose.yml -f docker-compose.test.yml`.

Both files set `name: zas` so the compose project name is fixed (powers the `zas_*` container naming via compose's `<project>_<service>` convention; explicit `container_name:` overrides where needed).

### `docker-compose.yml` (sketch)

```yaml
name: zas

services:
  db:
    image: postgres:17-alpine
    container_name: zas_db
    environment:
      POSTGRES_USER: zas
      POSTGRES_PASSWORD: zas
      POSTGRES_DB: zas
    ports:
      - "5432:5432"
    volumes:
      - zas_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zas -d zas"]
      interval: 2s
      timeout: 5s
      retries: 30
    networks: [zas_net]

  backend:
    image: zas_backend:dev
    container_name: zas_backend
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    environment:
      BACKEND_DATABASE_URL: postgresql+asyncpg://zas:zas@db:5432/zas
      BACKEND_HIX_MODE: stub
      BACKEND_LUSCII_MODE: stub
      BACKEND_LOG_LEVEL: INFO
    ports:
      - "8000:8000"
    develop:
      watch:
        - path: ./apps/backend
          target: /app
          action: sync
          ignore:
            - .venv/
            - __pycache__/
            - .pytest_cache/
            - .ruff_cache/
            - .mypy_cache/
            - "*.db"
        - path: ./apps/backend/uv.lock
          action: rebuild
        - path: ./apps/backend/pyproject.toml
          action: rebuild
        - path: ./apps/backend/Dockerfile
          action: rebuild
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status == 200 else 1)\""]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 10s
    networks: [zas_net]

volumes:
  zas_pgdata:

networks:
  zas_net:
    name: zas_net
```

### `docker-compose.test.yml` (sketch)

```yaml
name: zas

services:
  test_db:
    image: postgres:17-alpine
    container_name: zas_test_db
    environment:
      POSTGRES_USER: zas
      POSTGRES_PASSWORD: zas
      POSTGRES_DB: zas_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zas -d zas_test"]
      interval: 1s
      timeout: 3s
      retries: 30
    networks: [zas_net]

  test_runner:
    image: zas_backend:test
    container_name: zas_backend_test
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.test
    environment:
      BACKEND_DATABASE_URL: postgresql+asyncpg://zas:zas@test_db:5432/zas_test
      BACKEND_HIX_MODE: stub
      BACKEND_LUSCII_MODE: stub
      BACKEND_LOG_LEVEL: WARNING
    volumes:
      - ./apps/backend:/app
      - /app/.venv
    depends_on:
      test_db:
        condition: service_healthy
    networks: [zas_net]
```

Test DB uses `tmpfs` — faster, fresh on every `compose up`, never persists.

## Dockerfiles

### `apps/backend/Dockerfile` (dev)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

COPY docker/entrypoint.sh /usr/local/bin/zas-entrypoint
RUN chmod +x /usr/local/bin/zas-entrypoint

COPY . .

EXPOSE 8000

ENTRYPOINT ["zas-entrypoint"]
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

Cache mount on `uv sync` keeps wheels warm across `uv.lock` edits — rebuilds drop from ~30s to ~3s for typical dependency adds. Requires BuildKit (Docker Desktop 4.x + OrbStack both ship it by default).

### `apps/backend/docker/entrypoint.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run migrations before booting the app. Idempotent; safe to re-run.
echo "==> applying alembic migrations"
uv run alembic upgrade head

echo "==> starting backend"
exec "$@"
```

Entrypoint runs `alembic upgrade head` then `exec`s the CMD (uvicorn). Failure aborts before uvicorn binds the port, surfacing the error in compose output.

### `apps/backend/Dockerfile.test`

```dockerfile
FROM zas_backend:dev

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN uv sync --frozen  # include dev deps

CMD ["uv", "run", "pytest", "-q"]
```

Test image extends the dev image — single base, dev deps layered on top.

## Moon orchestration

Every docker-delegating moon task SHALL set `COMPOSE_FILE` in the task `env:` block instead of passing `-f` flags inline. This keeps each `command:` short and uniform (`docker compose <verb> …`) and centralises the file list at the top of the task. The separator is `:` on Linux/macOS — compose's documented default.

Root `moon.yml` (new) coordinates cross-app tasks.

```yaml
$schema: "https://moonrepo.dev/schemas/project.json"

project:
  name: "zas"
  description: "Root orchestration for the zas-wrapper monorepo."

tasks:
  dev:
    command: "docker compose up --build --watch"
    env:
      COMPOSE_FILE: "docker-compose.yml"
    local: true
    preset: "server"

  down:
    command: "docker compose down --remove-orphans"
    env:
      COMPOSE_FILE: "docker-compose.yml:docker-compose.test.yml"

  reset:
    command: "docker compose down -v --remove-orphans"
    env:
      COMPOSE_FILE: "docker-compose.yml:docker-compose.test.yml"
    # full wipe including zas_pgdata
```

Per-app moon tasks change as follows.

### `apps/backend/moon.yml` updates

```yaml
tasks:
  dev:
    command: "docker compose up --build backend"
    env:
      COMPOSE_FILE: "../../docker-compose.yml"
    preset: "server"

  test:
    command: "docker compose run --rm --build test_runner"
    env:
      COMPOSE_FILE: "../../docker-compose.yml:../../docker-compose.test.yml"
    options:
      cache: false  # tests are not deterministic across DB resets

  lint:
    command: "uv run ruff check"   # native (no docker dep for read-only checks)

  format:
    command: "uv run ruff format --check"

  typecheck:
    command: "uv run pyright"

  shell:
    command: "docker compose exec backend bash"
    env:
      COMPOSE_FILE: "../../docker-compose.yml"

  psql:
    command: "docker compose exec db psql -U zas -d zas"
    env:
      COMPOSE_FILE: "../../docker-compose.yml"
    local: true

  migrate:
    command: "docker compose exec backend uv run alembic upgrade head"
    env:
      COMPOSE_FILE: "../../docker-compose.yml"

  make-migration:
    command: "docker compose exec backend uv run alembic revision --autogenerate -m"
    env:
      COMPOSE_FILE: "../../docker-compose.yml"
```

Passthrough args via moon's `--` separator work natively — e.g. `moon run backend:test -- -k test_auth` appends `-k test_auth` to the pytest CMD inside `zas_backend_test`. No extra wiring required.

Native lint/format keeps editor integrations fast. `uv` must stay installed on host for those. Acceptable PoC compromise.

### `apps/orchestrator/moon.yml` (unchanged)

Still runs natively. Vite + vitest + playwright untouched.

### Aggregated dev task

Recommended composite at the repo root for the "boot everything" experience:

```yaml
tasks:
  up:
    command: "noop"
    deps:
      - "~:stack"           # boots docker stack (db + backend)
      - "orchestrator:dev"  # native vite
```

`moon run :up` starts everything in parallel.

## Settings + alembic

- `Settings.database_url` default flips from `sqlite+aiosqlite:///./zas_poc.db` to `postgresql+asyncpg://zas:zas@localhost:5432/zas` (host-local convenience for native runs).
- Inside containers, env overrides via compose (`db:5432` not `localhost:5432`).
- `alembic.ini` `sqlalchemy.url` removed in favour of reading `BACKEND_DATABASE_URL` in `alembic/env.py`.
- Existing single migration regenerated against Postgres dialect — SQLite-specific column types (e.g. `Boolean` constant integer) compile fine in Postgres; verify on first migration run.

## Tests

- Backend test entrypoint: `moon run backend:test`. That command:
  1. Builds `zas_backend:test` if missing or stale.
  2. Starts `zas_test_db` (tmpfs), waits for healthcheck.
  3. Runs `pytest -q` inside `zas_backend_test`. Env baked. No caller config.
  4. Container removed (`--rm`); test DB stops when compose group exits or stays warm for next run.
- DB per test: `tests/conftest.py` `db_session` fixture creates a SAVEPOINT per test, rolls back on teardown. Schema bootstrapped once via `Base.metadata.create_all` on `test_db` start (alembic upgrade head as alt — pick simplest).
- Frontend test command unchanged (`moon run orchestrator:test` — native vitest, no docker).
- `moon ci` runs both: `moon run :ci` aggregates `backend:test` + `orchestrator:test` + lint/format checks.

## Migration story (from SQLite to Postgres)

This change drops SQLite entirely.

1. Delete any local `apps/backend/*.db` files.
2. Delete `apps/backend/alembic/versions/*` (regenerate against Postgres). The PoC has no prod data — schema-only migration is fine.
3. After `moon run :stack`, run `moon run backend:make-migration "initial"` then `moon run backend:migrate`.
4. Update `apps/backend/.env.example` with Postgres URL.

## Ports + collisions

Fixed ports collide with whatever else dev runs on `:5432` / `:8000`. Document in README:

> If host `5432` is occupied (e.g. Postgres.app), stop it: `brew services stop postgresql`. Compose intentionally binds to fixed ports — change here, not in env, if you must.

No automatic port detection / shifting. Predictability > flexibility for PoC.

## Risks

| Risk | Mitigation |
|---|---|
| `--reload` over docker bind-mount is slow on macOS (file events polled, not native) | Accept for PoC. Optionally switch backend to native if pain dominates — same `BACKEND_DATABASE_URL` works against host-mapped DB port. |
| `zas_backend:dev` image rebuilds on every `uv.lock` change | Multi-stage caching keeps deps layer warm; only rebuild when lock changes. |
| Anonymous `.venv` volume hides stale interpreter when dependency drift happens | Document `moon run :reset` to wipe everything including volumes. |
| Postgres dialect quirks not caught by current tests | Regenerate alembic migration against Postgres + run `moon run backend:test` — caught at change time. |
| Two-DB compose names confuse new devs | Naming explicit: `zas_db` for dev, `zas_test_db` for tests, never the same volume. |

## Out of scope (revisited)

- Production Dockerfile (multi-stage, no source mount, gunicorn/uvicorn workers config) → `[mvp]` follow-up.
- CI yaml (`.github/workflows/ci.yml`) → separate `ci-pipeline` change.
- Frontend image → `[mvp]` follow-up once SSR or static-export deployment decided.
- testcontainers-python → revisit if parallel pytest workers need isolated DBs.
- Seed data scripts → separate `dev-data-seeding` change (already drafted).
