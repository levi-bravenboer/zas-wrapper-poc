---
name: worktree-doctor
description: Audit `.worktrees/` for orphans, stale branches, merged-but-not-removed, and branch-convention violations. Propose prune actions and wait for explicit user confirmation before destructive moves. Use when the user says "cleanup worktrees", "prune worktrees", "worktree doctor", or when `start` flags worktree issues.
license: MIT
metadata:
  version: '0.1'
---

Audit and clean up `.worktrees/`. Read-only by default. Never delete without explicit user OK per worktree.

---

## Conventions (per repo memory + CLAUDE.md)

- Worktrees live under `.worktrees/<kebab-branch>` (slashes flattened: `feat/foo-bar` → `feat-foo-bar`)
- Keep `feat/` (or `fix/`, `chore/`, …) prefix in branch name
- Shared docker stack across worktrees — never run `:reset` / `:up` / `:down` during cleanup
- `.worktrees/` is gitignored

---

## Step 1: Scan

Run in parallel:

```bash
git worktree list --porcelain
ls -1 .worktrees/ 2>/dev/null
```

For each entry in `git worktree list` (skip the main checkout):

- Path
- Branch: `git -C <path> branch --show-current`
- Last commit: `git -C <path> log --format="%ci" -1`
- Merged: `git log main..<branch> --oneline -1` empty → merged
- PR state: `gh pr list --state all --head <branch> --json state,number --limit 1`
- Uncommitted: `git -C <path> status --porcelain`

For each dir in `.worktrees/` not in `git worktree list`: orphan.

---

## Step 2: Classify

| Class                  | Rule                                                                |
|------------------------|---------------------------------------------------------------------|
| 🟢 Active              | Has uncommitted OR last commit <7d OR open PR                       |
| 🟡 Recent              | 7-14d, not merged, no open PR                                       |
| 🧊 Stale               | >14d, not merged, no open PR                                        |
| ✅ Merged              | Branch merged into main (any age)                                   |
| 👻 Orphan              | Dir present, not registered with git                                |
| ⚠️ Convention violation | Path not kebab; or branch missing `feat/`-style prefix when expected |

A worktree can carry multiple flags (e.g. Merged + Convention violation).

---

## Step 3: Report

```
🩺 Worktree doctor — <N> worktrees, <O> orphans

| Path                          | Branch                | Last edit    | Class            | Action proposed         |
|-------------------------------|-----------------------|--------------|------------------|-------------------------|
| .worktrees/feat-foo-bar       | feat/foo-bar          | 2 days ago   | 🟢 Active        | keep                    |
| .worktrees/old-refactor       | refactor/thing        | 30 days ago  | ✅ Merged 🧊 Stale | remove worktree + branch|
| .worktrees/junk-dir           | —                     | —            | 👻 Orphan        | rm -rf dir              |
| .worktrees/badname            | feat/bad-name         | 5 days ago   | 🟢 Active ⚠️      | rename to .worktrees/feat-bad-name |

Safe to act on: 2 (merged + orphan). Touch active/recent only on explicit request.
```

If nothing to do: `✅ All worktrees clean. Nothing to prune.`

---

## Step 4: Confirm + act

**Never act without explicit confirmation, per worktree.**

For each proposed action, ask: `Prune .worktrees/<dir>? (y/N)`. Accept batch: `y all` to confirm all proposed-safe actions at once. Skip anything not explicitly OK'd.

### Action recipes

**Remove worktree + delete merged branch** (after `y`):

```bash
git worktree remove <path>
git branch -d <branch>
```

If `git worktree remove` complains about uncommitted work — STOP, report to user. Never use `--force` without explicit user OK.

**Remove orphan dir** (after `y`):

```bash
rm -rf .worktrees/<dir>
```

Confirm the dir really has no `.git` file pointing at the main repo before removing.

**Rename for convention** (after `y`):

```bash
git worktree move <old-path> .worktrees/<kebab-branch>
```

Do not rename a worktree with uncommitted changes — ask the user to commit/stash first.

---

## Step 5: Recap

After actions, print:

```
🧹 Done.
   Removed:  <list>
   Renamed:  <list>
   Skipped:  <list with reasons>
   Remaining: <N> worktrees
```

Suggest `start` to re-display the dashboard if anything changed.

---

## Guardrails

- **Never** `git worktree remove --force`, `rm -rf` with wildcards, or `git branch -D` without explicit `y`
- **Never** run `moon run :reset` / `:up` / `:down` — shared docker stack across worktrees
- **Never** touch the main checkout
- **Read-only by default** — Step 1+2+3 require no confirmation; Step 4 always confirms
- Ignore `.worktrees/` itself being absent (some setups don't use it)
