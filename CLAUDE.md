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

## Worktree directory

- Always create git worktrees under `.worktrees/<branch-name>` in this repo. Directory is gitignored.

## Behavioural Reminders

- Honour the user's global `~/.claude/CLAUDE.md` rules: semantic commits, no AI attribution, no pushing without permission, lowercase after colon, one-liner messages ≤72 chars, present tense.
- Verification before completion: run the per-app build / test / lint commands and quote the result before reporting done.
- When acting in `apps/<name>/`, load that app's `AGENTS.md` for stack-specific commands.

## Pointers

- Multi-agent rules: `AGENTS.md`
- Project context: `openspec/project.md`
- Frontend conventions: `apps/orchestrator/AGENTS.md`
- Backend conventions: `apps/backend/AGENTS.md`
