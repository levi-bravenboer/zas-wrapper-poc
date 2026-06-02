---
name: start
description: Session entry point. Scans worktrees, OpenSpec changes, and PRs, then shows options first plus small context tables. Routes to repo skills. Use at the start of any session.
license: MIT
metadata:
  version: '0.5'
---

Scan. Options first. Context as small tables. Route to skills, don't do work.

No emojis. No decorative dividers. Hide empty sections. Renumber.

---

## Step 1: Scan (parallel)

- `git worktree list` → branch, last commit, merged, uncommitted
- Per worktree: `openspec/changes/` → in-progress changes linked to that worktree
- `openspec list --json` (main checkout) → all active changes
- `gh pr list --state all --head <branch>` per worktree
- Detect chain artifacts in `openspec/changes/`
- Worktree health: orphans, branch convention, merged-not-removed

## Step 2: Classify

| Class    | Rule                                                |
|----------|-----------------------------------------------------|
| Active   | open PR OR uncommitted OR (<7d AND not merged)      |
| Recent   | 7-14d, not merged, no PR                            |
| Stale    | >14d, not merged, no PR                             |
| Merged   | branch merged into main                             |
| Anomaly  | merged+uncommitted, or orphan dir                   |

Anomalies surface as notes, not actions.

For each worktree, also compute its **linked spec** — the in-progress change in `<worktree>/openspec/changes/` that matches the work (heuristic: name overlap with branch, or the most-recently-modified change in that worktree). One linked spec per worktree.

---

## Step 3: Render

### Header (one line)

```
zas-wrapper — <N> active · <M> pending specs · <K> merged to prune
```

### Options (always, first)

Plain numbered list — never a table:

```
1. continue on a worktree   → selection mode (worktree + its linked spec)
2. new feature              → new-feature
3. explore idea             → openspec-explore
4. cleanup worktrees        → worktree-doctor (K candidates)
5. chain coordinator        → orchestrator-admin-ux-chain
```

Hide options that don't apply. Renumber sequentially. No standalone "apply spec" option — applying a spec happens via option 1 (worktree → linked spec).

### Selection mode (after option 1)

Show worktrees sorted by last commit desc. Each row pairs worktree with its linked spec:

```
Pick a worktree to continue:
  a. feat/aws-poc-deploy        15d   PR #21 open   spec: external-block-integrations (36/37)   1f dirty
  b. feat/ai-pathway-building    9d   merged + 25f dirty (anomaly)
  c. feat/nested-paths-luscii…   9d   merged
  d. feat/multi-surface-spec…   10d   merged       spec: multi-surface-feature-framework (65/66)
  e. fix/ui-org                 11d   merged

Pick a letter, name, or cancel.
```

On pick:
1. Open that worktree (`cd .worktrees/<dir>` suggestion)
2. If worktree has a linked spec, also route to `openspec-apply-change` with that spec
3. Surface dirty apps + `/verify <app>` hint per dirty app

If a worktree has no linked spec: just open it, no spec route.

### Wrap-up detection (before continuing)

Before routing into the worktree, check these signals:

- **Spec near-complete** (≥90% tasks done, e.g. 36/37): inspect remaining task and ask whether to finish + archive instead of continuing
- **All worktrees containing the spec are merged**: spec work likely landed; the unfinished tasks may just be doc/archive
- **Worktree merged + uncommitted (anomaly)**: ask whether to inspect and discard, or salvage

When any of these hit, before opening the worktree, propose:

```
Wrap-up detected for spec <name> (<done>/<total>):
  a. inspect remaining tasks
  b. finish remaining tasks (apply change)
  c. archive the change (openspec-archive-change) if it's effectively done
  d. remove merged worktrees holding this spec (worktree-doctor)
  e. cancel — continue normally

Pick a-e.
```

Only show this prompt when at least one signal hits. Otherwise route normally.

### Context (small markdown tables, only if non-empty)

**Active worktrees**

```
| Branch              | Age | PR        | Linked spec                  | Dirty |
|---------------------|-----|-----------|------------------------------|-------|
| feat/aws-poc-deploy | 15d | #21 open  | external-block-integ. 36/37  | 1f    |
```

**Pending specs in main** (top 5 by completion %, then `+N more`)

```
| Spec                            | Done   |
|---------------------------------|--------|
| external-block-integrations     | 36/37  |
| multi-surface-feature-framework | 65/66  |
| nested-pathway-blocks           |  0/24  |
| care-teams-ui                   |  0/31  |
| care-context-thread             |  0/31  |
```

`+1 more` line after table if truncated.

**Notes** (max 3 lines, plain bullets — not a table)

```
- feat-ai-pathway-building: merged + 25 uncommitted — inspect before prune
```

### Edge cases

- No worktrees + no pending → `clean slate — option 2 or 3`
- Everything merged + done → `all clear — option 2, 3, or 4`

---

## Step 4: Route

| Input                     | Action                                                       |
|---------------------------|--------------------------------------------------------------|
| number / option name      | invoke skill or enter selection mode                         |
| worktree / branch         | open worktree, route to linked spec if any, surface /verify  |
| change name               | open the worktree linked to that change, then apply-change   |
| PR number                 | `gh pr view <n>`                                             |
| describes new work        | suggest 2 (clinical) or 3 (other); confirm route             |

On entering a dirty worktree: append `dirty — run /verify <app>` per dirty app.

---

## Guardrails

- Options first, context after
- No standalone apply-spec option; specs ride along with their worktree
- Small tables only; truncate to top 5 with `+N more`
- Hide empty sections; renumber
- No emojis, no dividers
- Route, never implement
- Repo-native skills only
- **Wrap-up first**: when a picked worktree's linked spec is near-complete OR all its worktrees are merged, propose archive/cleanup before continuing
