#!/usr/bin/env bash
set -euo pipefail

echo "==> applying alembic migrations"
uv run alembic upgrade head

echo "==> running scripts.seed_all"
uv run python -m scripts.seed_all

echo "==> starting backend"
exec "$@"
