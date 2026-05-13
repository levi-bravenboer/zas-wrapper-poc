# Repo security & access control

Goal: developers push freely, designers restricted to `docs/`, `openspec/`, and `apps/orchestrator/**`. Levi keeps unrestricted direct push to `main`.

## Components

| Layer | Purpose |
| --- | --- |
| `.github/CODEOWNERS` | Folder-level review ownership |
| Branch ruleset on `main` | Force PR + codeowner review for non-bypass users |
| Push ruleset (path restrict) | Block designers from writing outside their zones |
| Collaborator roles | Grant repo `Write` to all contributors |

## Prerequisites

- Org plan: GitHub Team or Enterprise (rulesets enforceable).
- Repo admin rights on this repository.
- Real GitHub usernames (or `@org/team-slug` if org admin can create teams).

## 1. CODEOWNERS

Edit `.github/CODEOWNERS`. Replace placeholders:

- `@DEV_USER_1`, `@DEV_USER_2` → developer handles
- `@DESIGNER_1`, `@DESIGNER_2` → designer handles

Commit to `main` so GitHub picks it up. CODEOWNERS only takes effect when the file exists on the target branch.

## 2. Collaborators

Repo → Settings → Collaborators and teams. Invite each contributor with **Write** role.

## 3. Branch ruleset — protect `main`

Repo → Settings → Rules → Rulesets → **New branch ruleset**.

- Name: `protect-main`
- Enforcement status: **Active**
- Bypass list (Always allow):
  - `levi-bravenboer`
  - each developer username (or `@org/developers` team)
- Target branches: include default branch (`main`)
- Rules:
  - [x] Restrict deletions
  - [x] Block force pushes
  - [x] Require a pull request before merging
    - Required approvals: `1`
    - [x] Require review from Code Owners
    - [x] Dismiss stale approvals on new commits (optional)

Save.

Effect: designers cannot push directly. Devs + levi bypass → direct push to `main` still works.

## 4. Push ruleset — designer path guard

Repo → Settings → Rules → Rulesets → **New push ruleset**.

- Name: `designer-path-guard`
- Enforcement status: **Active**
- Bypass list (Always allow):
  - `levi-bravenboer`
  - each developer username
- Rules → [x] **Restrict file paths**

Restricted paths (deny list — designers blocked from touching these):

```
apps/backend/**
.github/**
infra/**
package.json
pnpm-lock.yaml
turbo.json
tsconfig*.json
.env*
```

Extend the list with any other top-level paths outside `docs/`, `openspec/`, `apps/orchestrator/`.

Save.

Effect: designer push (direct or via PR branch) touching restricted paths is rejected at push time. Bypass users unaffected.

## 5. Verification matrix

| Actor | Action | Expected |
| --- | --- | --- |
| levi | direct push to `main` | accepted (bypass) |
| developer | direct push to `main` | accepted (bypass) |
| developer | PR touching anywhere | mergeable, no codeowner block |
| designer | direct push to `main` | rejected (branch ruleset) |
| designer | PR editing `docs/x.md` | mergeable after codeowner approval |
| designer | PR editing `apps/orchestrator/z.tsx` | mergeable after codeowner approval |
| designer | push containing `apps/backend/y.ts` | rejected (push ruleset) |
| designer | PR touching `.github/workflows/foo.yml` | rejected (push ruleset) |

## 6. Maintenance

- New restricted area appears → append to push ruleset deny list.
- New designer-owned folder → add CODEOWNERS row, ensure path is NOT in push ruleset deny list.
- New designer joins → invite as collaborator, add username to CODEOWNERS designer rows.
- New developer joins → invite as collaborator, add to CODEOWNERS default row, add to both ruleset bypass lists.

## 7. Rollout

1. Land CODEOWNERS on `main`.
2. Create both rulesets in **Disabled** mode first.
3. Smoke test from a designer-style account (or temp collaborator).
4. Flip both rulesets to **Active**.
5. Announce in team channel; share this doc.

<!-- bypass smoke test -->
