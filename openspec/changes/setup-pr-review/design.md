# Design: Automated PR review (Almaco setup)

## Context

- CI already exists. `.github/workflows/ci.yml` runs per-app jobs, and one aggregator job, `pr gate`, is built so branch protection can point at it.
- `docs/repo-security.md` describes a `protect-main` ruleset (1 approval plus code-owner review, with devs and `levi-bravenboer` on the bypass list), but that ruleset **does not exist**. The repo is private on a plan without rulesets or branch protection: the GitHub API returns 403 "Upgrade to GitHub Pro or make this repository public".
- `.github/CODEOWNERS` still has the placeholder `@DEVELOPER_1`. The only real code owners are `levi-bravenboer`, plus `julietdyer` on docs, openspec and orchestrator.
- The repo holds no PHI: only synthetic fixtures (AGENTS.md security invariant).
- The Almaco reference loop is Greptile → Claude babysit → human approves and merges. Their babysit skill (Jesse), cross-agent review skill (Peter) and Greptile config are **not available**. We rebuild them from the process guide and session transcripts and tune them to this repo.

## Goals / Non-Goals

**Goals**
- Match Almaco's loop: an automatic external review on every PR, an agent that fixes findings in a loop, and a human who owns the merge.
- Give Greptile the project's own rules so its reviews check our conventions, not only generic bug patterns.
- Keep the skill in the repo so the whole team runs the same version.

**Non-Goals**
- Auto-merge. Agents never run `gh pr merge`, and the existing `permissions.ask` hook already prompts on it.
- Greptile as a required check. At Almaco it is advisory and the human gate decides.
- Linear, intake, Sentry and deploy parts of Almaco's process.

## Decisions

1. **Greptile as a GitHub app, not a CI step.** This is what Almaco does, and it needs no secrets in Actions. *Alternative*: `anthropics/claude-code-action`. Kept only as a fallback if the vendor request is denied.
2. **Review once at open, then on demand.** `triggerOnUpdates: false`. Babysit posts `@greptileai review` after each fix round. This gives one full review per round instead of a half-finished review on every intermediate push. It matches what Peter did ("re-trigger by commenting").
3. **Our own `greptile.json`** instead of a copy of Almaco's, because theirs is unknown and our rules are domain-specific:
   - `customContext` points at the `AGENTS.md` files.
   - The custom rules are the repo's hard invariants (PHI, `zas_` prefix, moon, tier, surface gating, MDR). We leave out the commit-message rule because Greptile reviews diffs, not commit messages.
   - `ignorePatterns` cover generated files.
   - Field names are checked against Greptile's current docs at apply time.
4. **`pr-babysit` as a repo skill, started by hand after PR open.** It uses the `gh` and Monitor polling pattern from the user-level `ci-watch` skill, with ~5 min polls (Almaco: 5–10 min). It adds review-comment triage on top. It does not fork `ci-watch` because that skill is personal and not versioned in the repo.
5. **Human comments go into the same loop.** Reviewers comment while babysit runs (Peter: "it doesn't have to be linear"). Clear comments get fixed and comments that need judgement get handed back, the same as for Greptile.
6. **The agent fixes only comments with a clear answer.** Architecture, scope, naming, product and anything clinical go back to the human. This follows Jesse's "improvements that don't require my say".
7. **Reply with the commit SHA, then resolve.** This matches the Almaco demo, where a bot resolved the fixed threads. The SHA keeps every resolution traceable.
8. **Max 3 rounds, then hand back with a summary.** This answers Almaco's open question about a round limit. Skipped items are listed with the reason, never dropped silently.
9. **Codex pass is opt-in (`--codex`).** Different model families catch different bugs (Peter), but it costs quota, so it does not run by default. It needs the user-level `codex` plugin. If the plugin is missing, the skill prints a one-line notice and continues without the Codex pass.
10. **Merge gate without a dev bypass, enforced once the plan allows it.** Require `pr gate` plus 1 approval plus code-owner review for everyone. Only `levi-bravenboer` stays on the bypass list, for emergencies. This matches Almaco's "one human approval and green CI". It depends on two things:
    - **Plan upgrade.** Until it lands, the same rule is a team agreement in `AGENTS.md`, and nothing enforces it.
    - **Real code owners.** The placeholder handles in CODEOWNERS must be replaced first. Otherwise only levi can approve backend PRs, levi's own PRs can never get a non-author approval, and the "emergency" bypass becomes the normal path.

## Risks / Trade-offs

- [GitHub plan upgrade denied or delayed] → The gate stays a team agreement in `AGENTS.md`. Greptile and babysit work without it, so only enforcement is missing.
- [Greptile is a new vendor with source access] → Install is blocked on Reaktor sign-off, a retention-terms check and budget (task 1.1). No PHI is in the repo. Uninstalling the app removes access.
- [Vendor request denied] → Fall back to `claude-code-action` as the reviewer and keep the same babysit loop and merge gate. The fallback is a new proposal revision, not a silent swap.
- [Developers lose direct push, so solo work slows down] → Accepted; this is the Almaco model. The emergency bypass covers incidents.
- [The agent weakens tests to get CI green] → The skill forbids deleting or loosening assertions, and the summary comment lists every test change.
- [The agent misreads a human comment as clear] → Anything about intent goes to needs-human. The reviewer sees the reply and SHA and can reopen the thread.
- [Babysit burns quota] → 3-round cap, Codex is opt-in, and polling stays at 5 min.

## Migration Plan

1. Get vendor sign-off and budget, install the app, add `greptile.json`, then open a test PR and confirm the review lands.
2. Add the skill and run the full loop on the test PR.
3. Tell the team, then edit the ruleset. Rollback: uninstall the app, delete `greptile.json`, and restore the old bypass list and checks.
