#!/usr/bin/env bash
set -euo pipefail

echo "==> applying alembic migrations"
uv run alembic upgrade head

echo "==> starting backend"
exec "$@"
