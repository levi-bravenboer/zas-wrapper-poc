# Define PoC Scope and Drift Safety Net

**Tier**: `[poc]` (meta — defines scope tiers themselves)

## Why

We started building FHIR-ready infrastructure (`backend-setup` section 12) before deciding what the PoC actually does. The `fhir.resources` integration, `PatientSummary` route, view-model DTOs, and search-param models are forward investment that may or may not earn back depending on whether HiX is "data source" or "launcher only" for the PoC.

This change pauses the apply loop and introduces a scoping safety net so the next round of work can't drift again.

## What changes

Four artifacts. Each owns one concern, no overlap:

1. **`openspec/project.md` (expand)** — long-lived: project idea, stakeholders, integrated systems, hard constraints.
2. **`openspec/scope.md` (new)** — living scope ledger: PoC in-scope, PoC out-of-scope, what's mocked, PoC → MVP delta per feature. Every line carries a tier tag (`[poc]`, `[mvp]`, `[post-mvp]`).
3. **`openspec/backlog.md` (new)** — append-only parking lot: findings, ideas, debt notes that aren't actionable yet but must not be lost. Each entry has a tier + source + note + stable `BL-NNN` ID.
4. **Agent rules (update `AGENTS.md`, `apps/backend/AGENTS.md`, `apps/orchestrator/AGENTS.md`, new `openspec/AGENTS.md`)** — file map + scope-discipline rule: every change proposal cites its tier; out-of-tier work goes to `backlog.md`, not an active change folder; implementers re-read `scope.md` before starting tasks.

## What does NOT change here

- No application code changes.
- A meta-capability spec (`openspec-process`) is added under `openspec/specs/` solely to encode the tier-discipline rules so `openspec change validate --strict` passes.
- Existing `backend-setup` change stays open. Once `scope.md` is written, a follow-up reviews section 12 of `backend-setup` against the new scope and decides what stays, what reverts, what defers.

## Impact

- All future changes must carry a tier tag.
- The `backend-setup` change gets re-scoped (separately) once `scope.md` lands — tracked as `BL-025`.
- `orchestrator-fhir-ready`, `dev-data-seeding`, `agent-sandbox-spike`, `dev-sandbox-skills` are each re-evaluated against the new scope; either tier-tagged or moved to backlog (tracked as `BL-026`..`BL-029`).
