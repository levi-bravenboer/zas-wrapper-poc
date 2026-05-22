#!/usr/bin/env bash
# Block commits that add a `defineFeature(` call without a `surfaces:` property.
# Wired in `.claude/settings.json` as a PreToolUse hook on `git commit` matchers.
# Exits non-zero with a human-readable message; exit 0 otherwise.

set -euo pipefail

# Collect staged diff for added lines only (`+`-prefixed) in .ts / .tsx files
# that are not deletions and not the diff header.
ADDED_LINES=$(git diff --cached --unified=0 -- '*.ts' '*.tsx' | grep -E '^\+' | grep -v '^\+\+\+' || true)

if [[ -z "$ADDED_LINES" ]]; then
  exit 0
fi

# Find `defineFeature(` calls in staged additions.
FEATURE_CALLS=$(echo "$ADDED_LINES" | grep -E 'defineFeature\s*\(' || true)

if [[ -z "$FEATURE_CALLS" ]]; then
  exit 0
fi

# If any defineFeature call landed, require that the staged diff also adds a
# `surfaces:` key. Heuristic: globally check; if the surfaces line is added in
# the same commit, accept. Stricter per-call AST analysis lives in §5.8 (deferred).
SURFACES_LINE=$(echo "$ADDED_LINES" | grep -E 'surfaces\s*:' || true)

if [[ -z "$SURFACES_LINE" ]]; then
  cat <<EOF >&2
✗ feature-surfaces hook:
  A defineFeature(...) call was added without a 'surfaces:' property in the
  same commit. Surface intent is the single most important decision for a
  clinical view — declare it explicitly.

  Add: surfaces: ['app'] as const  (or any subset of app|smart|embed)

  See AGENTS.md → "Feature surface gating" and the new-feature skill.
EOF
  exit 1
fi

exit 0
