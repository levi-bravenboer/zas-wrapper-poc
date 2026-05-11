# Agentic Setup Research

Findings from two reference projects. Raw notes for discussion before deciding what to lift into `zas-wrapper`.

Sources:
- `/Users/levibravenboer/Desktop/me/projects/code-align` — pure design-phase plugin, AI-coding-agent rules audit tool
- `/Users/levibravenboer/Desktop/me/projects/bureau-ongemak/.worktrees/workshop-data-aware-builder` — full production monorepo with mature agentic OS

---

## 1. code-align — what it teaches

Status: pre-v0.1, design only. Three files: `README.md`, `docs/spec.md`, `docs/plan.md`, `docs/research.md`. That's the whole repo.

### Three-layer rules architecture

```
Layer 1 — Narrative rules (cross-tool)
  AGENTS.md (root + nested per domain) — read natively by Codex, opencode, Cursor, Windsurf
  CLAUDE.md = thin @import wrapper for Claude Code

Layer 2 — Audit config (machine layer)
  .code-align/code-align.yaml      — domains, categories, globs, exclusions, modes
  .code-align/categories.yaml      — category catalog with detection hints
  .code-align/profile.yaml         — auto-discovered architectural profile
  .code-align/local.yaml           — per-dev overrides (gitignored)

Layer 3 — Audit skill (tool-specific adapters, single contract)
  ~/.claude/plugins/.../code-align/skills/code-align[-init]/SKILL.md
  ~/.codex/skills/code-align[-init]/
  ~/.config/opencode/skills/code-align[-init]/
  .cursor/rules/code-align.mdc + custom command
```

### Key ideas worth stealing

- **AGENTS.md is the cross-tool source of truth.** CLAUDE.md = thin `@AGENTS.md` import. One file, every agent reads it.
- **Fenced sync markers.** `<!-- code-align:start --> ... <!-- code-align:end -->` so generators can rewrite a slice without clobbering hand-written content.
- **Auto-discovered profile.** Init skill walks repo, detects monorepo shape + frameworks + linters + i18n + ORM + design system, writes `profile.yaml`. Saves writing rules twice.
- **Per-dev overrides gitignored.** `local.yaml` for personal preferences without polluting team config.
- **Privacy gate.** Every file write asks before doing it. Auto-invocation always shows consent prompt.
- **Two-skill pattern.** `init` (bootstrap, interview-driven) + `run` (audit, dispatch fixes). Clean split.
- **Doc layout drift detector.** Flags flat `docs/plans/YYYY-MM-DD-*.md` dumps, missing `initiatives/` / `decisions/` dirs, frozen specs.
- **Skill hygiene drift detector.** Inventories `.claude/skills/`, plugin skills, `~/.claude/skills/`. Detects overlap. Suggests deprecation banners.

### Spec doc itself is a model

`docs/spec.md` structured as: Outcome → Scope (in/out v1.0) → Architecture → Naming/identity/packaging → File scope + VCS policy table → Skills (phase-by-phase) → ... Reads like a contract. Reusable template for our own POC specs.

---

## 2. bureau-ongemak — full production agentic OS

This is the deep one. Full monorepo, 8-stage feature lifecycle, 13 skills, universal verification gates, hard-delete context hygiene.

### Top-level layout (relevant parts only)

```
bureau-ongemak/
├── AGENTS.md                       # canonical cross-tool, source-of-truth order
├── CLAUDE.md                       # thin: @AGENTS.md + Claude-specific notes
├── MANUAL_ACTIONS.md               # things humans must do (env, secrets, infra)
├── apps/
│   ├── admin/frontend/CLAUDE.md    # app-specific UI/design context
│   ├── workshop/frontend/CLAUDE.md
│   └── website/frontend/CLAUDE.md
├── libs/surveys/AGENTS.md          # nested AGENTS.md for shared lib rules
├── design/
│   ├── pencil/                     # .pen files
│   └── pencil/CHANGELOG.md         # required entry per design change
├── docs/
│   ├── INDEX.md                    # auto-generated map (marker blocks)
│   ├── ai/                         # the agentic OS docs
│   │   ├── AGENTIC_DEV_LIFECYCLE.md
│   │   ├── AI_FIRST_OPERATING_SYSTEM.md
│   │   ├── PENCIL_TO_CODE_HANDOFF.md
│   │   ├── LINEAR_WORKFLOW.md
│   │   ├── permissions.md
│   │   └── admin-component-catalog.md
│   ├── apps/<app>/                 # canonical, post-graduation truth
│   ├── domains/<domain>/<surface>/ # bounded contexts spanning apps
│   ├── concepts/<topic>/           # horizontal capabilities (auth, audit, i18n, ws)
│   ├── initiatives/<slug>/         # in-flight only; HARD-DELETED on graduate
│   └── plans/                      # frozen, do not add new files (legacy)
├── .claude/
│   ├── skills/                     # 13 workflow skills
│   ├── templates/                  # manifest.yaml, spec.md, slice.md, decision.md, ...
│   ├── checks/always.yaml          # universal verification gates
│   └── settings.local.json
├── .github/
│   ├── copilot-instructions.md     # Copilot repo-wide
│   ├── instructions/               # Copilot path-scoped
│   ├── skills/                     # Copilot agent skills
│   └── ci/quality-matrix.yaml      # scope → test mapping
├── .cursor/rules/project-context.mdc   # minimal Cursor compat shim
└── .worktrees/<slug>/              # one worktree per active initiative
```

### AGENTS.md — source-of-truth order

This is gold. From the actual file:

```
1. Direct user task instructions
2. This file (root AGENTS.md)
3. .github/ci/quality-matrix.yaml
4. Closest nested AGENTS.md for the affected area
5. docs/ai/AGENTIC_DEV_LIFECYCLE.md for stage / skill expectations
6. docs/ai/* workflow docs
7. docs/apps/<app>/, docs/domains/<domain>/<surface>/, docs/concepts/<topic>/
8. design/pencil/* + apps/*/frontend/CLAUDE.md for UI work
9. Active initiative under docs/initiatives/<slug>/
10. docs/plans/* (legacy, frozen)
```

Idea: explicit precedence list resolves "which doc wins" without ambiguity. We need this for ZAS — tons of sources (Bestek, Lastenboek, REQ-IDs, demo script).

### 8-stage lifecycle (the heart)

```
PROPOSE → SPEC → CONFIRM → TASKS → BUILD ⇄ FEEDBACK → SHIP → GRADUATE-write → GRADUATE-publish → CLEANUP
```

| Stage | Skill | Writes |
| --- | --- | --- |
| PROPOSE | `propose-initiative` | new worktree + `initiatives/<slug>/` skeleton + `manifest.yaml` |
| SPEC | `write-spec` | `spec.md` filled (outcome, why, acceptance, surfaces, risks) |
| CONFIRM | `confirm-spec` | manifest `slices:` populated, status → `confirmed`, user approves |
| TASKS | `generate-tasks` | `tasks.md` rows derived from slices |
| BUILD | `pick-task` | code per slice, commits as `<slug>/<slice-id>: <subject>` |
| FEEDBACK | `process-feedback` | drains `feedback.md` unread blocks → patches `spec.md` / `tasks.md` |
| SHIP | `run-always-checks` | `checks.md` results, blocks on any fail |
| GRADUATE-write | `rewrite-spec-canonical` | `spec.md` rewritten clean → `spec-history.md` keeps diff |
| GRADUATE-publish | `graduate-initiative` | canonical spec into `domains/` or `apps/`; ADRs into target `decisions/` |
| CLEANUP | `cleanup-initiative` | hard-delete `initiatives/<slug>/`; remove worktree; prune merged branch |

### Manifest.yaml as single source of truth

```yaml
slug: 2026-q2-<kebab-title>
title: <human title>
status: proposed | speccing | confirmed | building | shipping | graduating | cleaned
owner: <git author>
created: <YYYY-MM-DD>
worktree: .worktrees/<slug>
branch: feat/<slug>

surfaces:
  domains: []
  apps: []
  concepts: []

links:
  linear: null
  pencil: null
  pr: null

slices:
  - id: 001
    title: <slice title>
    status: pending
    paths_touched: []

checks_overrides:
  skip: []      # check ids to skip with justification in spec.md §risks
  extra: []

contract_changes_approved: false

graduate_to:
  domain: null
  app: null
  concept: null
```

Drives: which always-checks fire, which INDEX.md auto-updates, where canonical truth eventually lives.

### Always-checks (`.claude/checks/always.yaml`)

Universal verification gates with **trigger globs** and **grep verify**. Each check:

```yaml
- id: <stable-id>
  description: <one-liner>
  when: always | trigger | stage
  trigger:
    glob: [path patterns]
    grep:
      pattern: <regex>
      glob: <where>
  commands: [shell ...]
  verify:
    grep:
      pattern: <regex>
      scope: changed_files
  skill: <skill-name>     # alternative to commands
  protected: true | false # cannot be skipped if true
```

Bureau's actual gates: `authz`, `authz-matrix`, `audit-events`, `i18n`, `generated-types`, `tests`, `code-quality`, `design-changelog`, `cleanup`, `protected-domains`. Skipping a non-protected check requires `manifest.checks_overrides.skip` + justification in `spec.md §risks`. Protected checks cannot be skipped — only via approval flag.

For ZAS this maps to: REQ-traceability check, FHIR-resource-validity check, SMART-launch smoke check, demo-readiness check, pricing-consistency check (story-point math reproducibility).

### Skills inventory (`.claude/skills/`)

13 skills in production:

```
backend-domain-plan-scan       # plan validator for backend changes
cleanup-initiative              # hard-delete after graduation
propose-initiative              # entry skill — creates worktree + initiative
protected-contract-changes      # gate on capability registry / WS / AI pipeline
regen-indexes                   # rebuild marker-block INDEX.md files
repo-delivery                   # commit + PR opening
reviewing-reuse-boundaries      # check abstraction-extraction discipline
run-always-checks               # fire universal gates
run-audit-tasks                 # execute code-align findings
spec-slice-planning             # decompose feature into slices
ui-design-sync                  # Pencil ↔ code reconciliation
verification-handoff            # report exact verification commands + outcomes
verify-i18n                     # i18n hard-coded-string scan
```

Each skill is a folder with `SKILL.md` describing scope/inputs/outputs.

### Templates inventory (`.claude/templates/`)

```
manifest.yaml      # initiative manifest scaffolding
spec.md            # in-flight spec template
spec-canonical.md  # post-graduation spec template
slice.md           # one slice = one PR-sized chunk
tasks.md           # task list per slice
decision.md        # ADR template
feedback.md        # user feedback inbox
checks.md          # check-result log
```

### Context hygiene rules

This is the discipline that keeps the system from rotting:

- `cleanup-initiative` does **hard delete** of `initiatives/<slug>/`. No archive.
- ADRs survive (moved to `decisions/`).
- Canonical spec survives (promoted to `domains/` / `apps/` / `concepts/`).
- Everything else deletes.
- `git worktree remove --force` after CLEANUP; merged branch deletes.
- `INDEX.md` files use auto-generated marker blocks so they stay tiny.
- `apps/`, `domains/`, `concepts/` are the only stable agent-readable context.

> "Context grows linearly with time unless we delete." — root principle.

### Multi-tool fan-out

Same rules, multiple agent surfaces:

| Agent | Reads from |
| --- | --- |
| Codex CLI | nested `AGENTS.md` files |
| Claude Code | `CLAUDE.md` + `.claude/skills/` + `.claude/templates/` |
| GitHub Copilot | `.github/copilot-instructions.md` + `.github/instructions/*` + `.github/skills/*` |
| Cursor | `.cursor/rules/project-context.mdc` (minimal compat shim) |

`AGENTS.md` is the canonical narrative; everything else is a thin adapter or pointer.

### Feedback loop

User tests work, drops comments in `initiatives/<slug>/feedback.md` as `processed: false` blocks. `process-feedback` skill drains unread before next task: decide spec patch / task add / ADR / no-action, apply, mark `processed: true` with resolution + commit sha, commit as `<slug>/feedback: <one-liner>`. Spec is authoritative; feedback is inbox.

### Doc taxonomy (canonical truth split)

```
docs/apps/<app>/                      # host-shell context (admin, workshop, forms)
docs/domains/<domain>/<surface>/      # bounded contexts (workshop/authoring, workshop/runtime)
docs/concepts/<topic>/                # horizontal capabilities (auth, audit, i18n, ws)
docs/initiatives/<slug>/              # in-flight; HARD-DELETED
docs/plans/                           # FROZEN legacy
```

Surface = role: `authoring`, `runtime`, `presentation`, `data`. Smart split — same domain (e.g., workshop) lives in multiple surfaces.

### MANUAL_ACTIONS.md

Tracks things humans must do that agents can't: provision secrets, run migrations on shared infra, set up DNS, get approval. Keeps agents honest about scope.

### CODEOWNERS at root

Even in a solo-ish project — anchors review responsibility for protected paths.

---

## 3. What likely fits ZAS POC

Pre-discussion picks (for us to debate):

### Lift wholesale
- **AGENTS.md** as canonical cross-tool source of truth. CLAUDE.md = `@AGENTS.md` import.
- **Source-of-truth order list** in AGENTS.md. ZAS has Bestek + Lastenboek + REQ-IDs + demo script + consortium contracts — ambiguity will kill us without explicit precedence.
- **Nested AGENTS.md** per app/package for scoped rules.
- **`.claude/checks/always.yaml`** with our own gates: REQ traceability, FHIR validity, SMART launch smoke, demo-readiness, pricing reproducibility.
- **Manifest.yaml + initiatives/** lifecycle for non-trivial features.
- **Hard-delete on graduation.** Critical for POC velocity — three months to demo, can't drown in stale docs.
- **Marker-block auto-generated INDEX.md.**
- **MANUAL_ACTIONS.md** for HiX test-instance access, eHealth keys, Luscii license setup, NewWave VPN — things consortium partners must provide.

### Adapt
- **Surface taxonomy.** ZAS surfaces probably: `composer/authoring`, `fhir/integration`, `mcp/runtime`, `transmural/sharing`, `compliance/identity`. Decide before scaffolding.
- **Quality matrix.** ZAS gates: REQ-coverage, FHIR-conformance, MCP-version-compat, Belgian-IdP-mock, accessibility (WCAG), demo-recordability.
- **Skills.** Shrink to 3-5 for POC: `propose-feature`, `req-traceability`, `fhir-validate`, `demo-rehearse`, `cleanup`. Add more later.

### Defer or skip for POC
- 8-stage lifecycle full ceremony — overkill for 3-month POC. Compress to 4: PROPOSE → BUILD → SHIP → CLEANUP.
- Linear integration — only if consortium uses it; else skip.
- Pencil changelog discipline — yes if designer uses Pencil, no if Figma.
- code-align audit plugin — track but don't install till post-MVP.
- GitHub Copilot scoped instructions — only if team uses Copilot.
- Cursor rules — only if team uses Cursor. Otherwise drop the shim.

### Open questions for discussion

1. **Lifecycle weight.** Full 8-stage or compressed 4-stage for POC?
2. **AGENTS.md vs CLAUDE.md primary?** AGENTS.md wins if Codex / multi-agent usage planned. Pure-Claude → CLAUDE.md primary, AGENTS.md as alias.
3. **Initiatives folder location.** `docs/initiatives/<slug>/` or top-level `initiatives/<slug>/`? Bureau uses docs/; I'd argue top-level for visibility on a small POC.
4. **Worktree discipline from day one** or only when consortium scales up?
5. **Veto-grade REQs as protected always-checks** (e.g., `protected-smart-launch`, `protected-mcp-compat`) so changes near them require manifest approval flag?
6. **MANUAL_ACTIONS.md** as deliverable to consortium leads (Luscii, NewWave) — frames hand-off cleanly?
7. **Skill scope.** Build our own ZAS-specific skills, or lean on superpowers + speckit + lift bureau's `propose-initiative`?

---

## 4. Side-by-side summary

| Aspect | code-align | bureau-ongemak | ZAS likely fit |
| :---- | :---- | :---- | :---- |
| Maturity | design only | production | POC |
| Cross-tool | AGENTS.md + CLAUDE.md @import | AGENTS.md + CLAUDE.md + Copilot + Cursor | AGENTS.md + CLAUDE.md (lean) |
| Skills count | 2 (init, run) | 13 | 3–5 |
| Lifecycle stages | n/a (audit only) | 8 | 4 (compressed) |
| Verification gates | category-driven | 10 always-checks | 5–7 (REQ + FHIR + MCP + demo + pricing) |
| Context hygiene | AGENTS.md fenced markers | hard-delete initiatives + INDEX markers | adopt both |
| Templates | n/a | 8 (manifest, spec, slice, ADR, feedback, ...) | start with 3 (manifest, spec, slice) |
| Per-app scoping | nested AGENTS.md | nested AGENTS.md + per-app CLAUDE.md | nested AGENTS.md per package/app |
| Worktree discipline | n/a | one per initiative | adopt for parallel demo tracks |

---

## 5. Next step

Talk through the open questions above, decide what to lift, then update `setup.md` with the agentic layer baked in.
