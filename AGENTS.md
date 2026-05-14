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
├── .moon/              # moonrepo workspace + toolchain config
├── apps/
│   ├── orchestrator/   # React 19 + Vite 8 + TS 6 — clinician composer + SMART launch
│   └── backend/        # FastAPI + uv + Py 3.13 — FHIR gateway, MCP host
├── docs/
│   ├── research/       # research notes
│   ├── wireframes/     # builder HTML + transcription
│   ├── screenshots/    # design exploration
│   └── setup.md        # historical layout doc (superseded by this file)
├── openspec/
│   ├── project.md      # canonical project context
│   ├── specs/          # current capabilities
│   └── changes/        # active + archived change proposals
├── AGENTS.md           # ← this file
└── CLAUDE.md           # Claude Code addenda
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

Per-project `moon.yml` declares the canonical task surface (`build`, `test`, `lint`, `typecheck`, `dev`, …). Always prefer `moon run …` over invoking `npm` / `uv` directly so caching and affected-detection stay correct.

## Local Runtime

One-command boot: `moon run :up`. Onboarding flow on a fresh checkout is `moon run :doctor` → `moon run :bootstrap` → `moon run :up`. See `README.md` for prereqs (incl. `docker compose` v2.22+ and OrbStack on macOS) and `apps/backend/AGENTS.md` for backend-container specifics.

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

### Frontend (`apps/orchestrator`)

- TypeScript strict. No `any` without a `// reason` next to it.
- React 19 idioms: function components only, no class components, no legacy refs.
- Stack: TanStack Router/Query/Form, Zod, openapi-fetch (typed from backend OpenAPI), Tailwind v4 + shadcn/ui, i18next (`nl`), Vitest + Playwright + MSW.
- Module isolation enforced by ESLint `no-restricted-paths`; no barrel `index.ts`; `@/*` is the only path alias.
- See `apps/orchestrator/AGENTS.md` for folder rules, casing table, coding rules, agentic testing workflow, and per-task moon commands. ADRs live under `apps/orchestrator/docs/adr/`.

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

## Tool-specific Notes

- **Claude Code**: skills live under `.claude/skills/`; commands under `.claude/commands/`. The OpenSpec scaffold provides `opsx` commands. See `CLAUDE.md`.
- **Codex**: reads this file as `AGENTS.md`. Per-app overrides apply automatically when working inside a subdirectory.
- **OpenCode**: same as Codex. Project-level overrides may live under `.opencode/` later.

Update this file when conventions shift. It is the single source of truth.
