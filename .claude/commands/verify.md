---
name: Verify
description: Run lint + typecheck + tests for whichever app(s) have uncommitted changes. Use before claiming work is done or opening a PR.
category: Quality
tags: [verify, lint, typecheck, test, moon]
---

Auto-detect which apps changed and run the canonical verification chain for each, via moon (pre-approved, no permission prompts).

## Steps

1. Run `git diff --name-only HEAD` and `git ls-files --others --exclude-standard` to get the changed-file list (committed-but-unpushed + working-tree + untracked).
2. Bucket files:
   - **Backend dirty** if any file is under `apps/backend/app/`, `apps/backend/tests/`, `apps/backend/alembic/`, `apps/backend/scripts/`, or `apps/backend/main.py` / `apps/backend/pyproject.toml`.
   - **Orchestrator dirty** if any file is under `apps/orchestrator/src/`, `apps/orchestrator/tests/`, `apps/orchestrator/index.html`, or `apps/orchestrator/package.json` / `apps/orchestrator/vite.config.*`.
   - **Schema-only backend changes** (only `apps/backend/app/schemas/**` and/or `apps/backend/tests/schemas/**`): skip the DB-dependent test run; lint + typecheck + `moon run backend:test-host -- tests/schemas/` is enough.
3. Run the relevant chain(s). Always run in this order so failures surface fast:
   - Backend: `moon run backend:lint` → `moon run backend:typecheck` → `moon run backend:test-host -- <narrowed paths if obvious>`
   - Orchestrator: `moon run orchestrator:lint` → `moon run orchestrator:typecheck` → `moon run orchestrator:test`
4. If both apps are dirty, run them sequentially (backend first — backend errors usually cascade to orchestrator type errors via `typegen`).
5. After all chains pass, quote the final tail lines as proof and report `verify: ok`. If any chain fails, stop and report the failure verbatim — do not try to "fix and re-run" silently.

## Notes

- Use moon. Never invoke `uv run pytest` or `pnpm exec vitest` directly — the PreToolUse hook will block you.
- For a feature touching `app/schemas/<x>` + corresponding router, narrow the test run with `moon run backend:test-host -- tests/api/routers/<x>/ tests/schemas/<x>/`.
- If nothing is dirty, report `verify: clean tree, nothing to check`.
