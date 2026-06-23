#!/usr/bin/env bash
set -euo pipefail

# Optional: block until dependencies accept TCP. Deploy sets WAIT_FOR_HOSTS so
# the seed's Kratos import + Keto reconcile don't no-op against a cold Ory.
# Empty by default → local dev (compose depends_on) is unaffected.
if [ -n "${WAIT_FOR_HOSTS:-}" ]; then
  echo "==> waiting for ${WAIT_FOR_HOSTS}"
  uv run python - "$WAIT_FOR_HOSTS" <<'PY'
import socket, sys, time

for hp in (h for h in sys.argv[1].split(",") if h.strip()):
    host, port = hp.split(":")
    deadline = time.time() + 180
    while True:
        try:
            with socket.create_connection((host, int(port)), timeout=3):
                print(f"  {hp} up")
                break
        except OSError:
            if time.time() > deadline:
                print(f"  WARN {hp} unreachable after 180s; continuing")
                break
            time.sleep(2)
PY
fi

echo "==> applying alembic migrations"
uv run alembic upgrade head

if [ "${SEED_PROFILE:-full}" = "demo" ]; then
  echo "==> running scripts.seed_demo (SEED_PROFILE=demo)"
  uv run python -m scripts.seed_demo
else
  echo "==> running scripts.seed_all"
  uv run python -m scripts.seed_all
fi

echo "==> starting backend"
exec "$@"
