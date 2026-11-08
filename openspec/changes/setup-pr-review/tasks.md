# Tasks

## 1. Greptile

- [ ] 1.1 **Blocking.** Request Reaktor vendor sign-off for Greptile (source-code access, retention terms) and budget for seats; verify the approval is recorded in `docs/repo-security.md` before starting 1.2
- [ ] 1.2 Install the Greptile GitHub app on `reaktor/zas-poc` (repo admin, manual) with auto-review on PR open only; verify the app shows under Settings → GitHub Apps
- [ ] 1.3 Add `greptile.json` at repo root (field names checked against current Greptile docs):
  - `triggerOnUpdates: false`
  - `customContext` → `AGENTS.md` + `apps/*/AGENTS.md`
  - custom rules:
    - no real patient data in fixtures, screenshots or logs
    - `zas_` docker prefix
    - moon over raw `uv`/`pnpm`
    - tier line in `proposal.md`
    - surface gating for new clinical views
    - MDR-drift flag
  - `ignorePatterns`: `apps/backend/openapi.json`, `apps/orchestrator/src/lib/api/schema.d.ts`, lockfiles, `openspec/changes/archive/**`

  Verify: a test PR gets a summary, a confidence score and inline comments, and the ignored files get no comments
- [ ] 1.4 On the test PR, plant an RRN-shaped string in a fixture; verify by observing once that Greptile comments on it (this is not a regression gate, because model output varies; deterministic scanning stays with `BL-034`)
- [ ] 1.5 Push a second commit to the test PR; verify Greptile does not re-review on push, and that a `@greptileai review` comment does trigger one

## 2. `pr-babysit` skill

- [ ] 2.1 Create `.claude/skills/pr-babysit/SKILL.md` with frontmatter and a "run by hand after PR open" trigger; verify the skill shows in the Claude Code skill list
- [ ] 2.2 Add the fetch-and-triage step: open Greptile and human review comments plus `gh pr checks`, shown as a table (fix / needs-human: architecture, scope, naming, product, clinical); verify the table renders on the test PR
- [ ] 2.3 Add the fix-and-push step with these rules: semantic commits with no AI attribution, never weaken or delete assertions, never merge. Poll CI every ~5 min with Monitor and fix failures; verify a planted lint error gets fixed and CI goes green
- [ ] 2.4 Add the thread step: reply to each fixed thread with the commit SHA, resolve it, then post `@greptileai review`; verify on the test PR that the threads are resolved with SHAs and Greptile re-reviews
- [ ] 2.5 Add the stop rule (zero open comments plus green `pr gate`, or 3 rounds) and the final summary comment (fixed with SHAs, skipped plus reason, test changes, final Greptile score); verify the summary posts and the loop stops
- [ ] 2.6 Add opt-in `--codex` step via the `codex` plugin, with findings tagged `codex`; when the plugin is missing, print a one-line notice and continue; verify both paths on the test PR
- [ ] 2.7 Run the full loop on the test PR with a planted Greptile-worthy bug, one clear human line comment and one judgement-call human line comment; verify the bug and the clear comment are fixed and resolved, the judgement comment is handed back, CI is green, and nothing merges

## 3. Merge gate + docs

- [ ] 3.1 **Blocking for 3.4.** Request the GitHub Team or Enterprise plan for the org (rulesets and branch protection return 403 on this private repo today); verify `gh api repos/reaktor/zas-poc/rulesets` returns 200
- [ ] 3.2 Replace the `@DEVELOPER_1` placeholder in `.github/CODEOWNERS` with real handles so every path has at least two real code owners; verify no placeholder handle remains and each path rule lists two or more real users
- [ ] 3.3 Announce to the team: the merge gate (one approval plus green `pr gate`, a human merges) starts now as a team agreement, with enforcement following once the plan upgrade lands; verify the message is sent
- [ ] 3.4 Create the `protect-main` ruleset:
  - require the `pr gate` status check
  - require 1 approval plus code-owner review
  - put only `levi-bravenboer` on the bypass list, as emergency-only

  Verify: a dev account cannot push to `main`, and a PR with a failing `pr gate` shows merge blocked
- [ ] 3.5 Add a `## PR review` section to `AGENTS.md`:
  - the loop
  - run `/pr-babysit` after opening a PR
  - review in parallel
  - a human approves and merges
  - the emergency bypass policy
  - the merge gate is a team agreement until 3.4 lands

  Update `docs/repo-security.md` §3 to match the real ruleset state, and add the Greptile install steps. Verify `openspec validate setup-pr-review` passes and the docs match the GitHub settings
