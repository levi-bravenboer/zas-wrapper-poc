# AGENTS.md — zas-wrapper

Canonical instructions for AI coding agents (Claude Code, Codex, OpenCode, Cursor, Aider, …). All agents read this file. Tool-specific addenda live next to it:

- `CLAUDE.md` — Claude Code addenda (skills, hooks).
- `.opencode/` — OpenCode addenda when needed.
- Codex / OpenCode also read `AGENTS.md` automatically.

Scoped per-app instructions live in `apps/<name>/AGENTS.md` and override these for files inside that app.

---

## Project

POC/MVP for **ZAS Telegeneeskunde** (procurement ref. 2026-0015). Reaktor Health consortium with Luscii Healthtech + NewWave Care. June demo target: SMART-on-FHIR launch from HiX → pathway composer (Orchestrator) → Holter / Rugrevalidatie end-to-end.

Full context: `openspec/project.md`.

## Repository Layout

```
zas-wrapper/
├── .moon/                    # moonrepo workspace + toolchain config
├── apps/
│   ├── orchestrator/         # React 19 + Vite 8 + TS 6 — clinician composer + SMART launch
│   ├── backend/              # FastAPI + uv + Py 3.13 — FHIR gateway, MCP host
│   └── digital-front-door/   # Expo SDK 55 + RN 0.83 + React 19.2 — patient-facing mobile app (iOS/Android/web-dev)
├── docs/
│   ├── research/             # research notes
│   ├── wireframes/           # builder HTML + transcription
│   ├── screenshots/          # design exploration
│   └── setup.md              # historical layout doc (superseded by this file)
├── openspec/
│   ├── project.md            # canonical project context
│   ├── specs/                # current capabilities
│   └── changes/              # active + archived change proposals
├── AGENTS.md                 # ← this file (canonical, harness-agnostic)
└── CLAUDE.md                 # Claude Code harness-specific addenda only
```

## Task Runner

Polyglot tasks run through **Moon** (`moonrepo`).

```bash
moon run orchestrator:build      # one project, one task
moon run :test                   # task across every project that defines it
moon run backend:dev             # long-running server (persistent)
moon ci                          # affected-only build + lint + test (CI)
moon query projects              # introspect graph
```

Per-project `moon.yml` declares the canonical task surface (`build`, `test`, `lint`, `typecheck`, `dev`, …). Always prefer `moon run …` over invoking `pnpm` / `uv` directly so caching and affected-detection stay correct.

### Moon is the canonical task runner — use it for everything

**Rule:** if a moon task exists for what you're about to do, run the moon task. Do not hand-roll the underlying `uv run …`, `pnpm …`, `docker compose …`, or env-var-prefixed shell form. Moon tasks set env vars, working dirs, compose files, and toolchain versions for you — the raw form drifts and breaks the agent permission allowlist (env-prefixed commands like `BACKEND_DATABASE_URL=… uv run pytest` will trigger a permission prompt every time).

If you find yourself typing `cd apps/<x> && <tool>`, `BACKEND_DATABASE_URL=…`, `docker compose run …`, `pnpm exec vitest …`, or `pnpm exec jest …`, stop and look for the moon task first.

### Pre-approved moon tasks

**Root** — `moon run :doctor`, `moon run :install`, `moon run :up`, `moon run :down`, `moon run :reset`, `moon run :stack`, `moon run :ci`

**Backend (`apps/backend`)**
- Tests: `moon run backend:test-host -- <paths or -k expr>` (fast, host pytest → localhost:5433, **agent-default**) · `moon run backend:test -- <args>` (ephemeral container)
- Static checks: `moon run backend:lint` · `moon run backend:typecheck` · `moon run backend:format`
- Schema: `moon run backend:openapi`
- DB / migrations / seeds: `moon run backend:migrate` · `moon run backend:make-migration "<msg>"` · `moon run backend:seed` · `moon run backend:seed-tenant` · `moon run backend:seed-users`
- Dev / shells: `moon run backend:dev` · `moon run backend:shell` · `moon run backend:psql` · `moon run backend:install`

**Orchestrator (`apps/orchestrator`)**
- Tests: `moon run orchestrator:test -- <args>` · `moon run orchestrator:test-coverage`
- Static checks: `moon run orchestrator:lint` · `moon run orchestrator:typecheck` · `moon run orchestrator:format`
- Build / types / dev: `moon run orchestrator:build` · `moon run orchestrator:preview` · `moon run orchestrator:typegen` · `moon run orchestrator:dev` · `moon run orchestrator:install`

**Digital Front Door (`apps/digital-front-door`)** — Expo SDK 55 patient-facing mobile app
- Tests: `moon run digital-front-door:test -- <args>` · `moon run digital-front-door:test-coverage`
- Static checks: `moon run digital-front-door:lint` · `moon run digital-front-door:typecheck` · `moon run digital-front-door:format` · `moon run digital-front-door:format-check`
- Build / dev: `moon run digital-front-door:dev` · `moon run digital-front-door:build` · `moon run digital-front-door:install`

### When moon is not the right tool

- One-off file reads / greps / git inspection → use the harness's file tools directly.
- Library docs lookups → the harness's documentation MCP (`context7` for Claude Code).
- Brand-new operation no moon task covers → add a moon task in the relevant `moon.yml` rather than committing an ad-hoc shell snippet; ask the user before adding.

## Worktree directory

Always create git worktrees under `.worktrees/<branch-name>` in this repo (slashes in branch names get flattened to `-`, so `feat/foo-bar` → `.worktrees/feat-foo-bar`). The `.worktrees/` directory is gitignored. Multiple parallel worktrees share the same `docker compose` stack — never run `:reset` / `:up` / `:down` without checking what other worktrees are using the stack.

## Local Runtime

One-command boot: `moon run :up`. Onboarding flow on a fresh checkout is `moon run :doctor` → `moon run :install` → `moon run :up`. See `README.md` for prereqs (incl. `docker compose` v2.22+ and OrbStack on macOS) and `apps/backend/AGENTS.md` for backend-container specifics.

The dev DB (`zas_db`) and the backend (`zas_backend`) run in docker via `docker-compose.yml`. The orchestrator runs natively (Vite HMR). Test runs use `docker-compose.test.yml` overlay with an ephemeral `zas_test_db` on tmpfs.

### Naming rule for docker resources

Every container, volume, network, and built image MUST be prefixed `zas_`. Any future change touching `docker-compose*.yml` or adding services MUST extend this rule (and document it in its proposal).

## Workflow

Spec-driven development through **OpenSpec**:

1. New capability or behavioural change → start with a proposal in `openspec/changes/`.
2. Run `/opsx:propose "<idea>"` (Claude Code) or invoke the equivalent skill on Codex / OpenCode.
3. Review the proposal with the user before writing code.
4. Implement, verify, then archive the change into `openspec/changes/archive/`.
5. Cross-link finished changes with the relevant `openspec/specs/` entry.

Bug fixes that do not introduce or alter behaviour can skip the proposal step but still record the fix in the relevant spec/changelog when behaviour is clarified.

## OpenSpec File Map

| File / Folder | What it is | When to read |
| --- | --- | --- |
| `openspec/project.md` | Long-lived project context: pitch, stakeholders, integrated systems, hard constraints, conventions. | Onboarding. Confirming who owns what. |
| `openspec/scope.md` | Living PoC scope ledger: in-scope features (`F1`..`Fn`), out-of-scope list, mocks table, PoC → MVP delta. Every line tier-tagged. | **Before proposing any change. Before starting any task. After pulling main.** |
| `openspec/roadmap.md` | Tier progression (PoC → MVP → Product). Current-tier flag + per-tier theme / exit criteria / highlights / non-goals. | Confirming what tier comes next or what closes the current one. |
| `openspec/backlog.md` | Parking lot for out-of-tier findings, deferred work. Stable IDs `BL-NNN`. | Before proposing — check if your idea is already parked. |
| `openspec/changes/<name>/` | Active change proposal. `proposal.md` MUST cite tier. | Working on or reviewing the change. |
| `openspec/changes/archive/` | Shipped changes, frozen. Audit trail. | Tracing a past decision. |
| `openspec/specs/` | Current capabilities (post-archive). | Understanding what currently exists. |
| `openspec/AGENTS.md` | Rules for working inside `openspec/` (full map + usage examples + promotion path). | Touching anything under `openspec/`. |

## Scope Discipline

Four rules. No exceptions.

1. **Every `proposal.md` MUST cite a tier** — exactly one of `[poc]`, `[mvp]`, `[product]` — in a `**Tier**:` line near the top. Out-of-tier work goes to `openspec/backlog.md`, not into a change folder.
2. **Re-read `openspec/scope.md` before starting tasks.** Scope drifts. If your task no longer matches scope, pause and propose a scope edit before implementing.
3. **New findings that aren't actionable now → `openspec/backlog.md`.** Add an entry with the next `BL-NNN` ID, tier, source, and a one-paragraph note. Do not create a change folder. Do not silently add to the active change.
4. **MDR check.** We are never an MDR medical device. If a proposal or implementation could push us toward MDR (clinical decision logic, diagnostic output, automated dosing, anything used or labelled as a medical device, interpreting Luscii measurements ourselves), **stop**, log the case in `openspec/mdr-watchlist.md`, and surface a non-MDR alternative before proceeding.

Full openspec rules + usage examples: `openspec/AGENTS.md`.

## Coding Standards

### General

- Make the smallest change that solves the task. No speculative refactors.
- Write no comments by default; add one only when the *why* is non-obvious.
- Match existing patterns in neighbouring code before introducing new ones.
- Verify before claiming done: run typecheck / tests / lint commands listed in the per-app AGENTS.md.

### Style spirit (language-agnostic)

These apply to TS, Python, SQL — wherever they fit. Concrete TS/JSX idioms are listed in `apps/orchestrator/AGENTS.md` `## Code style`.

- **Guard clauses / early returns.** Exit early on preconditions; keep the happy path flat.
- **Switch / dispatch over long if/else chains** when mapping one value to N branches. Lookup table when each case is data.
- **AHA — Avoid Hasty Abstractions.** Three similar occurrences before extracting. Inline duplication beats the wrong abstraction.
- **No premature optimization.** Memoization, caching, indexes — only with a measured cause documented next to the change.
- **Destructure / unpack in signatures** when the host language supports it (TS object params, Python `**kwargs` only when truly variable).
- **Stable, intent-named identifiers.** Booleans read as predicates (`is_active`, `hasAccess`). Functions read as verbs.
- **Prefer non-mutating builders** when an immutable form exists (TS `.toSorted`, Python `sorted(...)`).

### Frontend (`apps/orchestrator`)

- TypeScript strict. No `any` without a `// reason` next to it.
- React 19 idioms: function components only, no class components, no legacy refs.
- Stack: TanStack Router/Query/Form, Zod, openapi-fetch (typed from backend OpenAPI), Tailwind v4 + shadcn/ui, i18next (`nl`), Vitest + Playwright + MSW.
- Module isolation enforced by ESLint `no-restricted-paths`; no barrel `index.ts`; `@/*` is the only path alias.
- See `apps/orchestrator/AGENTS.md` for folder rules, casing table, coding rules, **`## Code style`** (canonical list of style idioms — guard clauses, lookup tables, `??` / `?.` / `!!arr?.length`, non-mutating array helpers, `satisfies`, AHA, naming, JSX gotchas), agentic testing workflow, and per-task moon commands. ADRs live under `apps/orchestrator/docs/adr/`.

### Backend (`apps/backend`)

- Python 3.13 with full type hints (`from __future__ import annotations` not needed on 3.13).
- Format with `uv run ruff format`, lint with `uv run ruff check`, test with `uv run pytest`.
- FastAPI routes live near the domain they serve; shared helpers in `app/` once the layout grows.
- See `apps/backend/AGENTS.md` for commands and conventions.

## Git

- Trunk-based with short-lived branches.
- Conventional commits: lowercase after colon, present tense ("add" not "added"), no period, max 72 chars on the subject.
- One concern per commit. Split refactors from behaviour changes.
- **Never** mention AI assistance or include `Co-Authored-By: Claude/Codex/...` lines.
- **Never** push without explicit user permission.

## Security & Compliance

- Patient data is in scope: treat all FHIR payloads as PHI. No real patient data in fixtures, screenshots, or logs.
- Belgian data residency applies to any productionised deployment. Do not introduce third-party services without flagging it.
- Auth flows (eHealth, itsme®, eID, CSAM) are veto-grade — discuss design before implementing.

## Communication

- Surface ambiguity early. If a task could plausibly mean two things, ask instead of guessing.
- Report what you ran, what you observed, and what is still untested. Never claim success without verifying.
- When recommending an irreversible action (force push, branch deletion, schema migration), pause and confirm.

## Feature surface gating

Verbatim user instruction: **"surface is the single most important early decision; never start a new clinical view without confirming which surfaces it targets."**

The orchestrator ships clinical features across three runtime surfaces:

- `app` — standalone web app, orchestrator session, sidebar chrome
- `smart` — SMART-on-FHIR launch, FHIR data, sidebar chrome
- `embed` — iframe inside HiX EPD, FHIR data, no chrome

Rules:

1. **Ask before code.** Before writing the first line of a new feature, ask the user which surfaces it targets (`app`, `smart`, `embed`, or any combination). Do not guess from context.
2. **Use the generator.** Run `pnpm gen:feature <id> --surfaces <list> --fhir-scopes <scopes> --requires <ctx> --title-nl <label>` (see `apps/orchestrator/scripts/gen-feature.ts`). Hand-written `defineFeature(...)` calls are allowed but discouraged.
3. **Consult the catalogue.** `openspec/changes/multi-surface-feature-framework/page-surface-catalogue.md` (post-archive: `openspec/changes/archive/<date>-multi-surface-feature-framework/page-surface-catalogue.md`) is the source of truth for current page → surface decisions and the admin opt-out list.
4. **Admin opt-out.** Pages under `/_auth/admin/*`, `/_auth/settings`, and `/_auth/pathways/*` are app-only by intent. They MUST NOT call `defineFeature` and MUST NOT pass through `pnpm gen:feature`. Hand-write the route and skip the surface prompt.

## Behavioural Reminders

- **Verify before claiming done.** Run the per-app `lint`, `typecheck`, and `test` moon tasks and quote the result before reporting a task complete.
- **Load the per-app `AGENTS.md`** when working inside `apps/<name>/`. App-scoped rules override these.
- **No AI attribution** in commits or PRs (no `Co-Authored-By`, no `🤖`).
- **No push without explicit user permission.**
- **Surface ambiguity early.** If a task could plausibly mean two things, ask instead of guessing.

## Pointers

- Project context: `openspec/project.md`
- PoC scope ledger: `openspec/scope.md` · Tier progression: `openspec/roadmap.md` · Backlog: `openspec/backlog.md` · MDR watchlist: `openspec/mdr-watchlist.md`
- Frontend conventions: `apps/orchestrator/AGENTS.md`
- Backend conventions: `apps/backend/AGENTS.md`
- Mobile conventions: `apps/digital-front-door/AGENTS.md`

## Tool-specific Notes

- **Claude Code**: skills live under `.claude/skills/`; commands under `.claude/commands/`. The OpenSpec scaffold provides `opsx` commands. Harness-specific notes (slash commands, enforcement hooks, MCP servers) live in `CLAUDE.md`.
- **Codex**: reads this file as `AGENTS.md`. Per-app overrides apply automatically when working inside a subdirectory.
- **OpenCode**: same as Codex. Project-level overrides may live under `.opencode/` later.

No per-app `CLAUDE.md` files exist; every app uses `AGENTS.md`. Update this file when conventions shift. It is the single source of truth.
