---
name: orchestrator-admin-ux-chain
description: Coordinator for the 7-spec orchestrator-admin-ux chain (practitioner-role-split → caregiver-shell → users/orgs/patients UI → practitioner-roles + care-teams UI). Use when starting, continuing, or completing any of these 7 OpenSpec changes. Self-removes when the chain is fully archived.
license: MIT
compatibility: Project-local (zas-wrapper). Requires openspec CLI + project moon tasks.
metadata:
  author: levi
  version: "0.1"
  scope: temporary
  lifetime: until-chain-complete
---

# Orchestrator admin UX chain — coordinator

A **temporary** project skill. It exists only while the 7-spec `orchestrator-admin-ux` chain is open. The last task of the last spec deletes this file along with `openspec/changes/CHAIN-orchestrator-admin-ux.md`.

## When to invoke

Trigger me whenever you (or the user) say any of:
- "next step in the ux chain"
- "what spec do I work on now"
- "[N] is done, what's next"
- "start [spec-name]"
- "archive [spec-name] and move on"
- Any work that touches one of the 7 spec names below.

If the question is unrelated to this chain, skip me.

## Chain order (canonical)

```
1. practitioner-role-split        — backend foundation; blocks all UI work
   ↓
2. caregiver-shell                — nav, auth-shell, landing, filterable list scaffolding
   ↓
   ┌──────────────────────────────┐
   │ 3. users-admin-ui            │  parallel after #2
   │ 4. organisations-admin-ui    │  parallel after #2
   │ 6. patient-profile-ui        │  parallel after #2 (uses shared list scaffolding from #2)
   └──────────────────────────────┘
   ↓
5. practitioner-roles-admin-ui    — needs users + orgs admin (#3 + #4)
7. care-teams-ui                  — needs user picker (#3); embeds in patient profile (#6)
```

**Critical path:** 1 → 2 → 3/4/6 → 5 → 7.

## State source of truth

`openspec/changes/CHAIN-orchestrator-admin-ux.md` holds the authoritative state table:
- Spec → branch → worktree → status (`draft | in-progress | applied | merged | archived`)

Read it at the start of every invocation; never assume from memory.

## Worktree / branch table

| # | Spec | Branch | Worktree |
|---|---|---|---|
| 1 | `practitioner-role-split` | `feat/practitioner-role-split` | `.worktrees/feat-practitioner-role-split` |
| 2 | `caregiver-shell` | `feat/caregiver-shell` | `.worktrees/feat-caregiver-shell` |
| 3 | `users-admin-ui` | `feat/users-admin-ui` | `.worktrees/feat-users-admin-ui` |
| 4 | `organisations-admin-ui` | `feat/organisations-admin-ui` | `.worktrees/feat-organisations-admin-ui` |
| 5 | `practitioner-roles-admin-ui` | `feat/practitioner-roles-admin-ui` | `.worktrees/feat-practitioner-roles-admin-ui` |
| 6 | `patient-profile-ui` | `feat/patient-profile-ui` | `.worktrees/feat-patient-profile-ui` |
| 7 | `care-teams-ui` | `feat/care-teams-ui` | `.worktrees/feat-care-teams-ui` |

Worktrees are created **just-in-time** when work on that spec starts; not all 7 exist at once.

## Workflow

### Starting a spec (status → `in-progress`)

1. Verify prerequisites are `merged` or `archived` per the chain graph.
2. From repo root: ensure `main` is up to date (`git checkout main && git pull --ff-only`).
3. Create worktree if absent: `git worktree add -b feat/<name> .worktrees/feat-<name> main`.
4. Read the spec's `proposal.md` + `tasks.md` + `design.md` + `specs/<cap>/spec.md`.
5. Re-read `openspec/scope.md` and the parent `CLAUDE.md`/`AGENTS.md` rules.
6. Invoke `openspec-apply-change` skill with `<change-name>` to begin task execution.
7. Update tracker row: status `in-progress`, set `Started: YYYY-MM-DD`.

### Finishing a spec (status → `applied` → `merged` → `archived`)

1. Tasks file fully checked off.
2. Run `/verify` for changed apps.
3. Commit + push branch.
4. Open PR (`gh pr create`) — get user permission first per `~/.claude/CLAUDE.md`.
5. After CI green + merge, in main worktree:
   - `git checkout main && git pull --ff-only`
   - `git worktree remove .worktrees/feat-<name>`
   - `git branch -D feat/<name>`
   - `git push origin --delete feat/<name>`
6. Invoke `openspec-archive-change` skill with `<change-name>`.
7. Update tracker: status `archived`, set `Archived: YYYY-MM-DD`.
8. Surface "next ready spec" to user.

### Picking the next spec

Walk the dependency graph and pick the first spec whose status is `draft` AND all `requires` entries are `merged` or `archived`. If multiple eligible (parallel set), present the options to the user.

## Cross-spec invariants

- **Backend shape lock**: `practitioner-role-split` MUST land before any UI spec touches the user/org/practitioner shape. UI specs that reference these MUST use the post-split typed client.
- **Shell-first**: no UI surface (`#3, #4, #5, #6, #7`) is implementation-ready until `caregiver-shell` defines the route group, layout, and shared list/filter primitives.
- **Typed-client regen**: every spec that adds/changes a backend endpoint MUST run `/openapi-sync` and commit the regenerated client diff in its own commit.
- **AUTH-HARDEN markers**: backend endpoints added in these specs MUST carry `# AUTH-HARDEN` comments and matching role guards. Source test enforces this.
- **i18n**: UI strings in user-facing copy go through `t()` (i18n keys). Code identifiers stay English (per memory `feedback_code_language.md`).

## Self-removal trigger

The **last task of spec #7 (`care-teams-ui`) tasks.md** ends with:

```
- [ ] X.N (CHAIN CLEANUP — RUN ONLY AFTER ALL 7 SPECS ARCHIVED) Delete `.claude/skills/orchestrator-admin-ux-chain/` and `openspec/changes/CHAIN-orchestrator-admin-ux.md`; verify the 7 spec dirs are archived under `openspec/changes/archive/`; commit `chore(openspec): retire orchestrator-admin-ux chain coordinator`.
```

If you process spec #7 and reach the cleanup task, run it. Do NOT remove the skill before all prior specs are archived. Confirm tracker state first.

## Quick commands

```bash
# Read the tracker
cat openspec/changes/CHAIN-orchestrator-admin-ux.md

# List active worktrees
git worktree list

# Validate a draft change
openspec validate <change-name> --strict

# Verify before reporting done
moon run :ci      # or /verify
```

## Failure modes (and recovery)

| Symptom | Likely cause | Recovery |
|---|---|---|
| Worktree dirty after merge | leftover `.env.worktree` or local edits | `git worktree remove --force` only if changes are confirmed disposable |
| Branch can't delete (used by worktree) | worktree still exists | remove worktree first |
| OpenAPI drift CI fail | forgot `/openapi-sync` | regenerate client, commit `chore(api): regenerate typed client` |
| Visibility predicate test fails after role-split | UI/service still references `user.organisation_id` | grep and replace all references; predicate path goes through `practitioner_roles` |
| Format CI fail | ran `moon run backend:format` (check-only) instead of `uv run ruff format` | apply formatter, commit `style(backend): apply ruff format` |

## Do not

- Do not stack multiple spec implementations on one branch — one worktree per spec.
- Do not skip ahead of the dependency graph (e.g. starting #5 before #3 + #4 are merged).
- Do not delete this skill manually before spec #7 completes.
