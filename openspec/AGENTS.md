# AGENTS.md — openspec/

Rules for working inside `openspec/`. The artifacts here are the project's living scope + change pipeline. Edit them with care.

## OpenSpec File Map

| File / Folder | What it is | When to read | When to write |
|---|---|---|---|
| `project.md` | Long-lived project context: pitch, stakeholders (tiered), integrated systems, hard constraints, conventions. | Joining the project. Onboarding any new agent. Confirming who owns what. | Stakeholders, systems, or constraints change. Conventions shift. |
| `scope.md` | Living **PoC scope ledger**: in-scope features (with IDs `F1`..`Fn`), out-of-scope list, mocks table, PoC → MVP delta. Every line tier-tagged. | Before proposing any OpenSpec change. Before starting any task. After pulling main. | Adding / removing a feature. Re-tiering a feature. Updating a mock or delta. Always part of the same PR as the change that motivates the edit. |
| `roadmap.md` | Tier-progression view: PoC → MVP → Product. Current-tier flag at top; per-tier theme, exit criteria, highlights, non-goals. Cross-links `BL-NNN` and `Fn` IDs. | Confirming what tier comes next. Checking exit criteria for the current tier. | A tier's exit criteria shift, a major item lands or moves, current-tier flag changes. |
| `backlog.md` | Parking lot for findings, ideas, deferred work. Stable IDs `BL-NNN`. Each entry: tier + source + note. | Before proposing — check if your idea is already parked. When promoting an item to an active change. | New finding from code review, RFP doc, conversation. Deferred work that isn't a change yet. |
| `changes/<name>/` | Active OpenSpec change proposal. Contains `proposal.md` (MUST cite tier), `design.md` (optional), `tasks.md`, `specs/`. | Working on the change. Reviewing it. Following a `BL-NNN` → change promotion. | Creating a new change via `/opsx:propose`. Updating tasks as work progresses. |
| `changes/archive/` | Shipped changes, frozen. Audit trail. | Looking up why a past decision was made. Tracing a feature back to its proposal. | After `/opsx:archive` only. Never edit by hand. |
| `specs/` | Current capabilities (post-archive). The "what we have built" reference. | Understanding what currently exists. Mapping a bug to a spec. | Only via change archival — never by hand. |
| `AGENTS.md` | This file. Rules for working inside `openspec/`. | Now. Every time you touch any of the above. | Workflow or layout changes. |

## Scope Discipline

Three rules. No exceptions.

1. **Every `proposal.md` MUST cite a tier** — exactly one of `[poc]`, `[mvp]`, `[product]` — in a `**Tier**:` line near the top. Out-of-tier work goes to `backlog.md`, not into a change folder.
2. **Re-read `scope.md` before starting tasks.** Scope drifts; assumptions from a week ago may be wrong. If your task no longer matches scope, pause and propose a scope edit before implementing.
3. **New findings that aren't actionable now → `backlog.md`.** Add an entry with the next `BL-NNN` ID, tier, source, and a one-paragraph note. Do not create a change folder for it. Do not "just add it to the current change".

## Usage Examples

- **Got a new product idea from a meeting?** → `backlog.md` entry. Maybe never a change. (Rule 3.)
- **Starting work on `define-poc-scope` tasks?** → Re-read `scope.md` first. (Rule 2.)
- **About to write a proposal for "embed orchestrator in HiX"?** → That's `[mvp]` per `scope.md` PoC → MVP delta. If we're still in PoC window, it goes to `backlog.md`. (Rule 1 + 3.)
- **Implementing a `[poc]` task and find a `[mvp]` blocker?** → Note the blocker in `backlog.md`, don't expand the current change.

## Promotion Path

`backlog.md` entry → active change:

1. Stakeholder commits to the work AND tier matches the current scope window.
2. Run `/opsx:propose` (Claude Code) or equivalent.
3. In `proposal.md`, cite the tier AND reference the `BL-NNN` ID it promotes.
4. Update the `BL-NNN` entry's note: "Promoted to `changes/<name>/` on YYYY-MM-DD." Keep the entry — audit trail.

## Relation to Other Agent Docs

- Root `AGENTS.md` is the canonical agent rulebook (workflow, coding standards, git rules). Read first.
- Per-app `AGENTS.md` files (`apps/backend/AGENTS.md`, `apps/orchestrator/AGENTS.md`) override for files inside that app.
- This file is the **openspec-specific** override. It only governs files under `openspec/`.

## Update Rule

Edit this file when the file map changes (new artifact under `openspec/`) or when scope discipline rules shift. Both are rare. When in doubt, ask before editing.
