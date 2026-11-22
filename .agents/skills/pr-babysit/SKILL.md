---
name: pr-babysit
description: Drive an open PR to mergeable. Triages Greptile + human review comments, fixes the clear ones, keeps CI green, re-pings Greptile, resolves fixed threads, and stops after green or 3 rounds with a summary comment. Never merges. Run by hand after opening a PR ("babysit this PR", "/pr-babysit", "/pr-babysit --codex").
license: MIT
metadata:
  version: '0.1'
---

Almaco-style review loop (see `openspec/changes/setup-pr-review/`). Greptile reviews, this skill fixes, a human approves and merges.

## Hard rules

- **Never merge.** No `gh pr merge`, no auto-merge. The human owns the merge.
- **Never weaken tests** to get green: no deleting or loosening assertions, no `skip`/`xfail`/`.only`, no lowering coverage thresholds. If a test looks wrong, hand it back as needs-human.
- **Never force-push, never `--no-verify`.**
- Commits follow the repo git rules: semantic, one line, ≤72 chars, lowercase after colon, no period, **no AI attribution or trailers**.
- Fix only what has one clear answer. Don't guess.
- Use moon tasks for local checks (`AGENTS.md` → Task Runner).

## 0. Setup

```bash
gh pr view --json number,url,headRefName,baseRefName,isDraft -q .
gh repo view --json owner,name -q '.owner.login + "/" + .name'
```

No PR for the current branch → stop and tell the user. PR is a draft → ask whether to continue (Greptile skips drafts).

Set `ROUND=1`. Max 3 rounds.

## 1. Fetch (each round)

Unresolved review threads (Greptile + humans), with their ids:

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$pr){
      reviewThreads(first:100){
        nodes{ id isResolved isOutdated path line
          comments(first:20){ nodes{ databaseId author{login} body url } } }
      }
    }
  }
}' -F owner=<owner> -F repo=<repo> -F pr=<number> \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved|not)'
```

Plus top-level PR comments (the Greptile summary + confidence score, and any human general comments posted since the last round):

```bash
gh pr view <number> --json comments --jq '.comments[] | {author: .author.login, body, createdAt}'
```

Plus CI:

```bash
gh pr checks <number> --json name,state,bucket,link
```

Source tag per item: `greptile` (author login contains `greptile`), `human`, `ci`, `codex` (step 1b).

## 1b. Codex pass (only with `--codex`)

Needs the `codex` Claude Code plugin and the Codex CLI. Check:

```bash
CODEX_ROOT=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/ 2>/dev/null | sort -V | tail -1)
[ -n "$CODEX_ROOT" ] && node "$CODEX_ROOT/scripts/codex-companion.mjs" setup --json
```

Not found, or `ready` is not `true` → print one line ("codex not available, skipping cross-agent pass — see /codex:setup") and continue without it. Otherwise run once, in round 1 only:

```bash
node "$CODEX_ROOT/scripts/codex-companion.mjs" review --wait --base origin/<baseRefName> --scope branch
```

Add each finding to the triage table tagged `codex`.

## 2. Triage

Show the table before touching code:

| # | source | file:line | finding | decision | why |
|---|---|---|---|---|---|

`decision` is one of:
- **fix** — one clear, local, behaviour-preserving answer (bug with obvious fix, lint/type error, missing null check, typo, rule violation from `AGENTS.md`).
- **needs-human** — anything about architecture, scope, naming, product behaviour, clinical meaning/MDR, security trade-offs, test intent, or where the reviewer and code disagree on intent. Also: outdated threads (`isOutdated`) whose point is unclear.
- **no-op** — already fixed or factually wrong; reply with the reason, don't resolve human threads, do resolve Greptile ones.

Human comments get the same treatment as Greptile. When unsure → needs-human.

## 3. Fix + push

For each **fix** item: smallest change, then run the focused moon check for the touched app (e.g. `moon run backend:test-host -- <path>`, `moon run orchestrator:test -- <path>`, the app's `lint`/`typecheck`). One commit per logical fix where practical. Then:

```bash
git push
```

## 4. Reply + resolve fixed threads

For each fixed thread, reply with the commit SHA, then resolve:

```bash
gh api graphql -f query='mutation($id:ID!,$body:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){ comment{ url } } }' \
  -f id=<threadId> -f body="Fixed in <sha>."

gh api graphql -f query='mutation($id:ID!){
  resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }' -f id=<threadId>
```

Needs-human threads: reply once with a short question/option list, leave unresolved.

## 5. Wait for CI

Use the `Monitor` tool on:

```bash
gh pr checks <number> --watch --interval 300
```

(~5 min polls.) On a failure: `gh run view --log-failed <run-id>`, find the root cause, fix, commit, push, keep watching. Same failure class twice in a row, or a failure that needs secrets/credentials/external approval → stop and hand back.

## 6. Re-ping Greptile

```bash
gh pr comment <number> --body "@greptileai review"
```

Wait for the new Greptile review to land (poll `gh pr view --json comments` every ~2 min, max ~15 min), then `ROUND=ROUND+1` and go to step 1.

## 7. Stop

Stop when **either**:
- zero unresolved threads that are `fix`-able, no open needs-human from this run left unanswered, and `pr gate` is green; or
- `ROUND > 3`; or
- a stuck condition from step 5.

Then post one summary comment:

```bash
gh pr comment <number> --body-file - <<'EOF'
## pr-babysit summary

**Result:** <ready for human review | stopped after 3 rounds | stuck: reason>
**Rounds:** <n> · **pr gate:** <green|red> · **Greptile score:** <x/5 from latest summary>

### Fixed
- <source> <file:line> — <what> (<sha>)

### Needs a human
- <source> <file:line> — <question / options>

### Test changes
- <file> — <what changed and why>   (or "none")
EOF
```

Print the same summary plus the PR URL to the user. Do not merge.
