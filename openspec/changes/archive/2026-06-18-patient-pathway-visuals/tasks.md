# Tasks — patient-pathway-visuals

## 1. Prototype the look (HTML-first)
- [x] 1.1 Prototypes v1–v8 (bladder-cancer + short-pathway seed data)
- [x] 1.2 Iterate until look locked — **v10** is the locked look (trail window + end pills; runtime-state palette matching the detail tab; DS-fidelity Card/Badge + state legend)
- [x] 1.3 Folded locked look into proposal + design + spec (window model, WINDOW=2, end pills, runtime palette, deriveBlockStatus reuse)

## 2. Implement (in `modules/patient-pathway/` — no restructure, no `shared/`)

Reuse what the patient module already has — `deriveBlockStatus`, `RUNTIME_STATE_COLOR` (its own `runtime-canvas/runtimeState.ts`) and `BlockTypeIcon` (`@/modules/pathway/blockCatalogue`, the existing cross-import the runtime canvas uses) — so the banner matches the detail tab. No `BlockGlyph`, no builder restyle, no module move.

- [x] 2.1 `summary.ts` pure selectors — `deriveSummary` (steps + phaseName + done/total + nowIndex) + `windowAround` (WINDOW=2); reuses `deriveBlockStatus`; `runtimeState.ts`/`utils/buckets.ts` untouched
- [x] 2.2 `PathwaySummaryHeader` — status + anchor + current phase + X/N + thin meter
- [x] 2.3 `PathwayTrailNode` — stepper cell from `RUNTIME_STATE_COLOR` (finished success+check / now primary+ring / upcoming muted); overdue red sub; finished sub = `completedAt · completedByName`
- [x] 2.4 `PathwayTrailOverflow` — dashed "+N afgerond" / "+N te gaan" end-pill cell
- [x] 2.5 `PathwayEnrollmentSummary` — banner orchestrator (header + windowed trail + `RuntimeLegend`); replaced inline `PathwayProgress` in `PathwayTimeline.tsx`; chrome + empty/loading/error preserved
- [~] 2.6 Windowed-stepper kept local (pathway-specific content/colours); not extracted to a generic primitive
- [x] 2.7 i18n keys under `patient-pathway` (`summary.phase/progress/done/toGo/overdueDays`)
- [x] NOTE: anchors, attention strip, phase rail, per-step hover detail → deliberately NOT here; the Zorgpad detail tab (runtime canvas) owns them

## 3. Verify
- [x] 3.1 Unit tests for `summary.ts` — window math, done/total, current phase, overdue, short pathway, skipped/pending excluded (6 tests pass)
- [x] 3.2 typecheck (`tsc -b` clean) + lint (clean) + unit tests green
- [ ] 3.3 Run the app, open a patient with the bladder-cancer enrollment, confirm it matches v10 — NOT done (shared browser stack busy; could not launch UI)
