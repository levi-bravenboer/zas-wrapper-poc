---
name: style-check
description: Audit TypeScript/React code against the project style canon in apps/orchestrator/AGENTS.md. Use when the user asks to scan, review, check, or audit code style; or says "style check", "code review", "lint my style". Always prompts the user to pick scope (full frontend / domain / worktree diff).
license: MIT
---

# style-check

Scan orchestrator TS/TSX against the canonical style list in `apps/orchestrator/AGENTS.md` `## Code style`. Report-only by default; never edit without confirmation.

## Rule source (authoritative)

- **Frontend canon:** `apps/orchestrator/AGENTS.md` → `## Code style`
- **Language-agnostic spirit:** `AGENTS.md` (root) → `### Style spirit`

Re-read both before scanning. Style evolves; never rely on memory.

## Step 1 — Ask for scope (always)

Present these three modes verbatim and wait for the user's pick. Do NOT proceed without an answer.

```
Pick scan scope:
  1. Full frontend — apps/orchestrator/src/**/*.{ts,tsx}
  2. Domain        — a specific module path (you'll be asked which)
  3. Diff          — files changed in this worktree vs base branch
```

- **Mode 1** target glob: `apps/orchestrator/src/**/*.{ts,tsx}` (exclude `*.test.ts`, `*.test.tsx` unless user opts in)
- **Mode 2**: ask for the path (e.g. `apps/orchestrator/src/modules/pathway`); glob that subtree
- **Mode 3**: get the changed files via:
  ```bash
  base=$(git merge-base HEAD origin/main)
  git diff --name-only "$base"...HEAD -- 'apps/orchestrator/src/**/*.ts' 'apps/orchestrator/src/**/*.tsx'
  ```
  Include staged + unstaged: `git status --porcelain | awk '{print $2}'` filtered to the same globs. Dedupe.

If the file list is empty, say so and stop.

## Step 2 — Load the canon

Read `apps/orchestrator/AGENTS.md` → `## Code style` once. Keep the subsections in scope:

- Control flow (guard clauses, lookup tables over long if/else, `switch` for tagged unions)
- Component shape (object-destructured props, early returns)
- Naming (`is*`/`has*` for booleans, verbs for functions, English identifiers)
- Idioms — null/undefined (`??` vs `||`, `?.`, no `=== undefined` checks)
- Idioms — boolean coercion (`!!arr?.length` over `arr && arr.length > 0`)
- Idioms — arrays (ES2023+: `.at(-1)`, `.toSorted()`, `.toReversed()`, `Object.groupBy`)
- Idioms — destructuring (params + return values)
- Idioms — objects (spread over `Object.assign`, computed keys)
- Idioms — TypeScript (`satisfies`, `as const`, discriminated unions, no `any` without `// reason:`)
- Idioms — functions (arrow expressions for callbacks, default params)
- JSX gotchas (`!!arr?.length &&`, never `arr.length &&`; keys stable; no inline objects in deps)
- Avoid (barrel `index.ts`, deep relative imports, `any`, `as` casts, premature memoisation)
- AHA (three occurrences before extracting)

## Step 3 — Scan

For each file in scope, look for violations of the canon. Use `Grep` for cheap patterns first; read full file when context matters.

High-signal greps to start with:

| Pattern | Likely violation |
|---|---|
| `\.length > 0` | replace with `!!arr?.length` |
| `\.length && ` (inside JSX) | numeric-leak risk; wrap with `!!` |
| ` === undefined\| !== undefined` | prefer `?? ` / optional chaining |
| `\|\| ` (with default value) | check if `??` is correct (null/undefined only) |
| `as any\|: any` | needs `// reason:` comment; otherwise flag |
| `if \(.*\) \{[\s\S]*?else if` (multiline) | candidate for lookup table or switch |
| `arr\.sort\(\|arr\.reverse\(` | mutates; prefer `.toSorted()`/`.toReversed()` |
| `arr\[arr\.length - 1\]` | `arr.at(-1)` |
| `function .*\(props\) \{` | destructure props in signature |
| `index\.ts` in path | forbidden barrel |
| `from '\.\./\.\./\.\.` | deep relative; use `@/` alias |
| `useMemo\|useCallback` | confirm measured cause documented |

Don't lean only on greps — read each candidate to confirm before reporting (false positives waste user time).

## Step 4 — Report

Single block, one finding per line:

```
<file>:<line> | <rule> | <issue> → <suggestion>
```

Example:
```
src/modules/pathway/utils/createBlock.ts:42 | !!arr?.length | uses `tags.length > 0` → replace with `!!tags?.length`
src/modules/pathway/components/Foo.tsx:81  | discriminated union | long if/else on `kind` → switch with exhaustive default
```

Group by file. At the end, summarise:
- Files scanned (count)
- Findings by rule (top 3)
- "0 findings" if clean

## Step 5 — Offer to fix

After the report, ask:
```
Apply fixes? (y / select N,M / no)
```

- `y` → fix everything, run `moon run orchestrator:lint` + `orchestrator:typecheck` after
- `select N,M` → fix only those numbered findings
- `no` (default) → stop; user owns next step

Never edit before this prompt. Never commit. Hand control back after edits + verify.

## Guardrails

- Skill is **report-first**. Edits require explicit user yes.
- Style canon is the only source of rules. Don't invent new ones mid-scan.
- If a finding is ambiguous (e.g. `||` may be intentional for `0 || fallback`), flag it as `review` instead of `fix`.
- Test files: skip by default, scan if user opted into mode 1/2 with `--include-tests` flag.
- Never scan `apps/backend` here — Python has its own conventions (ruff). If user asks, redirect to `moon run backend:lint`.
- Don't scan generated files: `apps/orchestrator/src/lib/api/types.gen.ts`, `routeTree.gen.ts`.
