# CLAUDE.md

**Read `AGENTS.md` first.** This file holds only Claude Code harness-specific notes (slash commands, enforcement hooks, Claude-bound MCP servers, skills). Every other convention — task runner rules, pre-approved moon tasks, worktree directory, feature-surface gating, behavioural reminders, pointers — lives in `AGENTS.md` (canonical, harness-agnostic).

## Claude-specific Setup

- **OpenSpec workflow** is wired through the `opsx` commands in `.claude/commands/` and the `openspec-*` skills in `.claude/skills/`. Prefer those over ad-hoc edits to `openspec/`.
- **Superpowers skills** (brainstorming, TDD, debugging, plan writing/execution) are available. Use them when the task matches their description.
- **`pencil` MCP** is available for `.pen` design files. Never read `.pen` files with `Read` / `Grep`; always use the pencil tools.
- **`context7` MCP** is available for up-to-date library documentation. Prefer it over web search when checking framework APIs (React 19, FastAPI, Vite 8, Expo SDK 55, etc.).

## Project slash commands

Prefer these over manual recipes — they encode the canonical sequence:

- **`/verify`** — auto-detects which app(s) changed and runs lint + typecheck + tests via moon. Use before claiming done, before opening a PR, before committing a meaningful chunk.
- **`/new-migration <message>`** — wraps `moon run backend:make-migration`, opens the generated revision, flags suspicious autogen output.
- **`/openapi-sync`** — regenerates `apps/backend/openapi.json` then `orchestrator:typegen` in lockstep so the frontend client doesn't drift.

## Enforcement hooks

- **PreToolUse(`Bash`)** blocks raw `uv run pytest`, `BACKEND_DATABASE_URL=… uv run pytest`, `pnpm exec vitest`, `pnpm exec jest`, and `docker compose run … test_runner`. Use the moon equivalent — the hook will tell you which.
- **Stop** prints a `verification reminder` listing any dirty apps. Treat it as a checklist before reporting done; ideally run `/verify` instead of dismissing it.
- **`permissions.ask`** covers destructive ops: `git push*`, `git reset --hard*`, `rm -rf*`, `docker compose down -v*`, `alembic upgrade*` / `downgrade*`, `gh pr merge*`, `psql*`. Expect a prompt — don't try to route around it.
