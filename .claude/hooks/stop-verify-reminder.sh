#!/usr/bin/env bash
# Stop hook: advisory reminder when session ends with uncommitted source changes.
# Non-blocking — exits 0 always. Output goes to user via stderr (visible in UI).

set -euo pipefail

# Run from repo root.
cd "$(git -C "$(pwd)" rev-parse --show-toplevel 2>/dev/null || echo .)" 2>/dev/null || exit 0

# Bail quietly if not a git repo.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

changed="$(git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)"
[[ -z "$changed" ]] && exit 0

backend_dirty=0
orch_dirty=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    apps/backend/app/*|apps/backend/tests/*|apps/backend/alembic/*) backend_dirty=1 ;;
    apps/orchestrator/src/*|apps/orchestrator/tests/*) orch_dirty=1 ;;
  esac
done <<< "$changed"

[[ $backend_dirty -eq 0 && $orch_dirty -eq 0 ]] && exit 0

{
  echo ""
  echo "──── verification reminder ────"
  [[ $backend_dirty -eq 1 ]] && echo "• apps/backend modified — run: moon run backend:lint && moon run backend:typecheck && moon run backend:test-host"
  [[ $orch_dirty   -eq 1 ]] && echo "• apps/orchestrator modified — run: moon run orchestrator:lint && moon run orchestrator:typecheck && moon run orchestrator:test"
  echo "(or just /verify)"
  echo "───────────────────────────────"
} >&2

exit 0
