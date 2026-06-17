# Tasks — patient-pathway-visuals

## 1. Prototype the look (HTML-first)
- [x] 1.1 Prototypes v1–v8 (bladder-cancer + short-pathway seed data)
- [x] 1.2 Iterate until look locked — **v10** is the locked look (trail window + end pills; runtime-state palette matching the detail tab; DS-fidelity Card/Badge + state legend)
- [x] 1.3 Folded locked look into proposal + design + spec (window model, WINDOW=2, end pills, runtime palette, deriveBlockStatus reuse)

## 2. Implement (in `modules/patient-pathway/` — no restructure, no `shared/`)

Reuse what the patient module already has — `deriveBlockStatus`, `RUNTIME_STATE_COLOR` (its own `runtime-canvas/runtimeState.ts`) and `BlockTypeIcon` (`@/modules/pathway/blockCatalogue`, the existing cross-import the runtime canvas uses) — so the banner matches the detail tab. No `BlockGlyph`, no builder restyle, no module move.

- [ ] 2.1 `summary.ts` pure selectors — derive window view-model `{ phaseName, done, total, window: Cell[], beforeHidden, afterHidden }` from ordered executions + template (WINDOW=2 each side of active); **reuse `deriveBlockStatus`** for state/completedAt/completedByName/skipped; do NOT modify `runtimeState.ts` or `utils/buckets.ts`
- [ ] 2.2 `PathwaySummaryHeader` — status + pathway name + current phase + X/N + thin meter
- [ ] 2.3 `PathwayTrailNode` — stepper cell (half-line · icon node · half-line + name + sub); styled from `RUNTIME_STATE_COLOR` (finished success / now primary+ring / upcoming muted); overdue red sub on now; finished sub = `completedAt · completedByName`
- [ ] 2.4 `PathwayTrailOverflow` — dashed "+N afgerond" / "+N te gaan" end-pill cell
- [ ] 2.5 `PathwayEnrollmentSummary` — banner orchestrator (header + windowed trail + compact state legend); replace inline `PathwayProgress` in `components/PathwayTimeline.tsx`; preserve enrollment chrome + empty/loading/error states
- [ ] 2.6 If the windowed-stepper turns out content-agnostic, extract a generic reusable primitive to `components/`; otherwise keep it local
- [ ] 2.7 i18n keys under `patient-pathway` (status, afgerond count, overdue, "+N afgerond"/"+N te gaan", phase fallback)
- [ ] NOTE: anchors, attention strip, phase rail, per-step hover detail → deliberately NOT here; the Zorgpad detail tab (runtime canvas) owns them

## 3. Verify
- [ ] 3.1 Unit tests for `summary.ts` — window math (before/after hidden, WINDOW bounds), done/total, current phase, overdue, short pathway (no pills)
- [ ] 3.2 `/verify` (orchestrator lint + typecheck + tests)
- [ ] 3.3 Run the app, open a patient with the bladder-cancer enrollment, confirm it matches v10
