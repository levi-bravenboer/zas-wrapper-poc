# Proposal: Automated PR review (Almaco setup)

**Tier**: [poc]

## Why

Agents now open most of our PRs, and every line still waits for a human to read it. Almaco runs a proven loop for this (source: *ALMACO AI Team Practices — Detailed Process Guide*, 2026-10-06, and the Almaco PR review session with Milan and Peter). Greptile reviews every PR. A Claude Code `babysit` loop fixes review findings and CI failures until the PR can merge. A human approves and merges. We copy that loop as closely as we can. Where Almaco's material doesn't say (their skill files and Greptile config were not shared), we fill the gap with a setup that fits this project.

## What Changes

- **Greptile GitHub app** is installed on `reaktor/zas-poc`. It reviews every non-draft PR into `main` once, when the PR opens. It posts a summary, a flow diagram, a 1–5 confidence score and inline comments. Later re-reviews happen on demand through `@greptileai review`, which the babysit loop posts after each fix round.
- **`greptile.json`** (repo root) is a project-specific config:
  - It points Greptile at `AGENTS.md` and `apps/*/AGENTS.md`.
  - It adds custom rules taken from those files: no real patient data in fixtures, screenshots or logs; the `zas_` prefix on docker resources; moon tasks over raw `uv`/`pnpm`; a cited tier on every `proposal.md`; the surface-gating rule for new clinical views; flag anything that drifts toward MDR (clinical decision logic, interpreting Luscii measurements).
  - It ignores generated output (`openapi.json`, generated TS types, lockfiles, `openspec/changes/archive/`).
- **`pr-babysit` skill** (`.agents/skills/pr-babysit/SKILL.md`, symlinked from `.claude/skills/pr-babysit` so Claude Code discovers it) is versioned in the repo so the whole team runs the same version. The developer runs it by hand after opening the PR. Each round:
  1. Fetch open review comments from Greptile **and from humans** (people review in parallel), plus CI status.
  2. Show a triage table. Fix each comment that has a clear answer. List the ones that need a human decision instead of guessing.
  3. Commit, push, then poll CI every ~5 min and fix failures.
  4. Reply to each fixed thread with the commit SHA and resolve it. Post `@greptileai review`.
  5. Stop when no comments are open and `pr gate` is green, or after **3 rounds**. Post one summary comment on the PR covering what was fixed, what was skipped and why, any test changes, and the final Greptile score. It never merges.
- **Optional cross-agent pass** (Peter's practice): the opt-in `--codex` flag runs a Codex review through the installed `codex` plugin and adds those findings to the same triage table. This needs the `codex` plugin installed on your machine; without it the skill says so and skips the step instead of failing.
- **Human gate on merge (Almaco: one approval plus green CI)**:
  - Prerequisite: the org must be on GitHub Team or Enterprise. Today the GitHub API returns 403 for both rulesets and branch protection on this private repo. Until the plan is upgraded, the gate is a team agreement that nothing enforces.
  - `.github/CODEOWNERS` placeholders (`@DEVELOPER_1`) are replaced with real handles, so a PR author is never the only code owner who can approve.
  - The `protect-main` ruleset requires the `pr gate` status check in addition to 1 approval plus code-owner review.
  - Developers are removed from the bypass list. `levi-bravenboer` stays only as an emergency bypass.
  - A human always approves and merges.
- **Docs**: a `## PR review` section in `AGENTS.md`, plus updates to `docs/repo-security.md` for the ruleset change, the Greptile install and the vendor sign-off.

## Capabilities

### New Capabilities
None. This is developer tooling and changes no product behaviour. `skip_specs: true`.

### Modified Capabilities
None.

## Impact

- **New third-party service: Greptile. Install is blocked until approved.** Greptile reads the full repo source and PR diffs. The repo holds only synthetic fixtures and no PHI, so no patient data leaves. Reaktor vendor sign-off, a check of data-retention terms, and budget (paid per seat) must be in place before install. Flagged per AGENTS.md "do not introduce third-party services without flagging it".
- **Workflow change**: developers lose direct push to `main`. Every change goes through a PR with an approval and a green `pr gate`.
- **Files**: `greptile.json`, `.agents/skills/pr-babysit/SKILL.md` (symlinked from `.claude/skills/pr-babysit` so Claude Code discovers it), `AGENTS.md`, `docs/repo-security.md`, `.github/CODEOWNERS`. `ci.yml` does not change.
- **GitHub plan**: rulesets and branch protection need GitHub Team or Enterprise for a private repo. This is a second blocking request, next to the Greptile one.
- **GitHub settings** (manual, repo admin): Greptile app install and creating the `protect-main` ruleset (it does not exist yet).
- **Out of scope**: Linear (not used on this project; the summary goes in a PR comment), the intake skill, Sentry → auto-fix, and deploy gates.
