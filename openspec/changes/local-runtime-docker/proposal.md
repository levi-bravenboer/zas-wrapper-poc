# Change: local-runtime-docker

## Why

PoC backend now ships SQLAlchemy 2.x + Alembic on top of `aiosqlite`. We want **Postgres parity from day one** so migrations, query shapes, and adapter idioms match `[mvp]` and prod. We also want one-command lifecycle for the whole stack so any contributor (human or agent) can boot, test, and tear down without juggling env vars, ports, or DB names.

## What changes

- **Postgres in docker** for dev + test (two separate containers, different ports).
- **Backend in docker** (Shape 2) — Python image with `uv sync --frozen`, mounted source, `uvicorn --reload`. Tradeoff: HMR over bind-mount is slower than native, accepted for reproducibility.
- **Frontend stays native** — Vite HMR keeps host filesystem speed.
- **Moon tasks orchestrate everything** — `moon run :stack`, `moon run :down`, `moon run backend:test` work end-to-end without touching docker CLI.
- **Fixed ports + `zas_` prefix** on every container, volume, network, image.
- **Single test entrypoint** — `moon run backend:test` invokes a compose-run that mounts source, starts ephemeral test DB, runs pytest with baked env. No per-shell env exports.

## Out of scope

- Frontend in docker — vite HMR pain on macOS not worth it for PoC.
- Production Dockerfile / k8s manifests — `[mvp]` follow-up.
- CI yaml (GitHub Actions) — separate `ci-pipeline` change after this lands.
- testcontainers-python — fixed `zas_test_db` service is simpler; revisit at `[mvp]` if parallel test workers need isolation.
- MCP host / additional surfaces — not yet implemented; add to compose when they exist.

## Impact

- New: `docker-compose.yml`, `docker-compose.test.yml`, `apps/backend/Dockerfile`, `apps/backend/Dockerfile.test`, root `moon.yml` orchestration tasks, `.env.example`.
- Modified: `apps/backend/app/core/settings.py` (Postgres URL default), `apps/backend/alembic.ini` + `alembic/env.py` (Postgres dialect, async driver), `apps/backend/moon.yml` (dev/test tasks delegate to docker), `apps/backend/pyproject.toml` (drop `aiosqlite`, add `asyncpg`).
- Removed: `aiosqlite` from runtime deps. SQLite file artefacts ignored.
