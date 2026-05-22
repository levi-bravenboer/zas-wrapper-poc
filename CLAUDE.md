# CLAUDE.md

Claude Code reads this file first. The canonical multi-agent instructions live in **`AGENTS.md`** — read that next, then return here for Claude-specific addenda.

## Order of Precedence

1. User's direct messages and `~/.claude/CLAUDE.md`.
2. This file (`CLAUDE.md`).
3. `AGENTS.md` at the same scope.
4. Per-app `AGENTS.md` when working inside `apps/<name>/`.

Where this file is silent, `AGENTS.md` rules apply.

## Claude-specific Setup

- **OpenSpec workflow** is wired through the `opsx` commands in `.claude/commands/` and the `openspec-*` skills in `.claude/skills/`. Prefer those over ad-hoc edits to `openspec/`.
- **Superpowers skills** (brainstorming, TDD, debugging, plan writing/execution) are available. Use them when the task matches their description.
- **`pencil` MCP** is available for `.pen` design files. Never read `.pen` files with `Read` / `Grep`; always use the pencil tools.
- **`context7` MCP** is available for up-to-date library documentation. Prefer it over web search when checking framework APIs (React 19, FastAPI, Vite 8, etc.).

### Project slash commands

Prefer these over manual recipes — they encode the canonical sequence:

- **`/verify`** — auto-detects which app(s) changed and runs lint + typecheck + tests via moon. Use before claiming done, before opening a PR, before committing a meaningful chunk.
- **`/new-migration <message>`** — wraps `moon run backend:make-migration`, opens the generated revision, flags suspicious autogen output.
- **`/openapi-sync`** — regenerates `apps/backend/openapi.json` then `orchestrator:typegen` in lockstep so the frontend client doesn't drift.

### Enforcement hooks

- **PreToolUse(`Bash`)** blocks raw `uv run pytest`, `BACKEND_DATABASE_URL=… uv run pytest`, `pnpm exec vitest`, and `docker compose run … test_runner`. Use the moon equivalent — the hook will tell you which.
- **Stop** prints a `verification reminder` listing any dirty apps. Treat it as a checklist before reporting done; ideally run `/verify` instead of dismissing it.
- **`permissions.ask`** covers destructive ops: `git push*`, `git reset --hard*`, `rm -rf*`, `docker compose down -v*`, `alembic upgrade*` / `downgrade*`, `gh pr merge*`, `psql*`. Expect a prompt — don't try to route around it.

## Worktree directory

- Always create git worktrees under `.worktrees/<branch-name>` in this repo. Directory is gitignored.

## Feature surface gating

Before writing the first line of any new clinical view, ask the user which surfaces it targets (`app`, `smart`, `embed`, or any combination). Surface intent is the single most important early decision — do not infer it from context. Then run `pnpm gen:feature` (or, for admin/pathway/dashboard/settings opt-outs, hand-write the route and skip the prompt).

Full rules + admin opt-out list live in `AGENTS.md` under `## Feature surface gating`. The `.claude/skills/new-feature` skill walks the workflow.

## Behavioural Reminders

- Honour the user's global `~/.claude/CLAUDE.md` rules: semantic commits, no AI attribution, no pushing without permission, lowercase after colon, one-liner messages ≤72 chars, present tense.
- Verification before completion: run the per-app build / test / lint commands and quote the result before reporting done.
- When acting in `apps/<name>/`, load that app's `AGENTS.md` for stack-specific commands.

## Moon is the canonical task runner — use it for everything

**Rule:** if a moon task exists for what you're about to do, run the moon task. Do not hand-roll the underlying `uv run …`, `pnpm …`, `docker compose …`, or env-var-prefixed shell form. Moon tasks set env vars, working dirs, compose files, and toolchain versions for you — the raw form drifts and breaks the permission allowlist (env-prefixed commands like `BACKEND_DATABASE_URL=… uv run pytest` will trigger a permission prompt every time).

If you find yourself typing `cd apps/<x> && <tool>`, `BACKEND_DATABASE_URL=…`, `docker compose run …`, or `pnpm exec vitest …`, stop and look for the moon task first.

### Pre-approved moon tasks (no permission prompt)

**Root** — `moon run :doctor`, `moon run :install`, `moon run :up`, `moon run :down`, `moon run :reset`, `moon run :stack`, `moon run :ci`

**Backend (`apps/backend`)**
- Tests: `moon run backend:test-host -- <paths or -k expr>` (fast, host pytest → localhost:5433, **agent-default**) · `moon run backend:test -- <args>` (ephemeral container)
- Static checks: `moon run backend:lint` · `moon run backend:typecheck` · `moon run backend:format`
- Schema: `moon run backend:openapi`
- DB / migrations / seeds: `moon run backend:migrate` · `moon run backend:make-migration "<msg>"` · `moon run backend:seed` · `moon run backend:seed-tenant` · `moon run backend:seed-users`
- Dev / shells: `moon run backend:dev` · `moon run backend:shell` · `moon run backend:psql` · `moon run backend:install`

**Orchestrator (`apps/orchestrator`)**
- Tests: `moon run orchestrator:test -- <args>` · `moon run orchestrator:test-coverage`
- Static checks: `moon run orchestrator:lint` · `moon run orchestrator:typecheck` · `moon run orchestrator:format`
- Build / types / dev: `moon run orchestrator:build` · `moon run orchestrator:preview` · `moon run orchestrator:typegen` · `moon run orchestrator:dev` · `moon run orchestrator:install`

### When moon is not the right tool

- One-off file reads / greps / git inspection → use Read/Grep/git directly.
- Library docs lookups → `context7` MCP.
- Brand-new operation no moon task covers → add a moon task in the relevant `moon.yml` rather than committing an ad-hoc shell snippet; ask the user before adding.

## Pointers

- Multi-agent rules: `AGENTS.md`
- Project context: `openspec/project.md`
- Frontend conventions: `apps/orchestrator/AGENTS.md`
- Backend conventions: `apps/backend/AGENTS.md`
