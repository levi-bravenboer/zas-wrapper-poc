#!/usr/bin/env bash
# PreToolUse hook: block / rewrite anti-pattern Bash commands toward moon.
# Reads PreToolUse JSON on stdin. Exit 0 = allow. Exit 2 = block (stderr → agent).

set -euo pipefail

payload="$(cat)"

# Only inspect Bash tool calls.
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // .toolName // empty')"
if [[ "$tool_name" != "Bash" ]]; then
  exit 0
fi

cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // .toolInput.command // empty')"
if [[ -z "$cmd" ]]; then
  exit 0
fi

# Pattern 1: any 'uv run pytest …' invocation (with or without env prefixes, with or without cd).
# Triggers for: 'uv run pytest', 'BACKEND_DATABASE_URL=… uv run pytest', 'cd apps/backend && uv run pytest', etc.
# Does NOT trigger for non-pytest uv invocations: 'uv run python …', 'uv run ruff …', 'uv run alembic …'.
if [[ "$cmd" =~ uv[[:space:]]+run[[:space:]]+pytest ]]; then
  args="$(printf '%s' "$cmd" | sed -E 's/.*uv[[:space:]]+run[[:space:]]+pytest[[:space:]]*//; s/[[:space:]]*2>&1.*$//; s/[[:space:]]*\|.*$//; s/[[:space:]]*$//')"
  cat >&2 <<EOF
Blocked: do not invoke 'uv run pytest' directly.

Use the canonical moon task — pre-approved (no permission prompt), sets BACKEND_DATABASE_URL for you, survives DB-URL changes:

    moon run backend:test-host -- ${args}

See CLAUDE.md → "Moon is the canonical task runner". General 'uv run …' (python/ruff/alembic) is still allowed — only pytest is gated.
EOF
  exit 2
fi

# Pattern 3: 'cd apps/orchestrator && pnpm exec vitest' — prefer orchestrator:test
if [[ "$cmd" =~ cd[[:space:]]+apps/orchestrator.*pnpm[[:space:]]+(exec[[:space:]]+)?vitest ]]; then
  cat >&2 <<'EOF'
Blocked: do not invoke 'pnpm exec vitest' directly inside apps/orchestrator.

Use the canonical moon task:

    moon run orchestrator:test -- <args>
EOF
  exit 2
fi

# Pattern 4: docker compose run --rm test_runner — prefer backend:test
if [[ "$cmd" =~ docker[[:space:]]+compose[[:space:]]+run.*test_runner ]]; then
  cat >&2 <<'EOF'
Blocked: do not invoke 'docker compose run … test_runner' directly.

Use the canonical moon task:

    moon run backend:test -- <args>
EOF
  exit 2
fi

exit 0
