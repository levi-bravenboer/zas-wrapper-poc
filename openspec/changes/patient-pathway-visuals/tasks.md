# Tasks — patient-pathway-visuals

## 1. Prototype the look (HTML-first)
- [x] 1.1 Prototypes v1–v8 (bladder-cancer + short-pathway seed data)
- [x] 1.2 Iterate until look locked — **v10** is the locked look (trail window + end pills; runtime-state palette matching the detail tab; DS-fidelity Card/Badge + state legend)
- [x] 1.3 Folded locked look into proposal + design + spec (window model, WINDOW=2, end pills, runtime palette, deriveBlockStatus reuse)

## 2. Implement (only after look locked + spec re-reviewed)

### Phase 0 — Module restructure (behaviour-preserving, own commit, BEFORE the feature)
- [ ] 0.1 `git mv` builder code into `modules/pathway/builder/` (canvas, dialog, dock, drawer, subbar, topbar, version, shell, blockCatalogue.tsx, canvasLayout.ts, …)
- [ ] 0.2 `git mv modules/patient-pathway/* modules/pathway/patient/`
- [ ] 0.3 Create `modules/pathway/shared/`; move cross-side vocab into it (types.ts, api.ts, theme.ts, blockTypeIcon.tsx, DayChip.tsx, blockCatalogue.utils.ts)
- [ ] 0.4 Fix imports: ≈6 external `@/modules/pathway/*` consumers, ≈1 `@/modules/patient-pathway/*` (PatientProfilePage), and the ≈12 shared-vocab importers; rule: builder/patient may import shared, not each other
- [ ] 0.5 `/verify` (orchestrator) — green with zero behaviour change before continuing; coordinate timing vs the 7 in-flight `pathway-*` branches

### Phase 1 — Feature (`modules/pathway/patient/`)

Reuse the patient runtime vocabulary the merge landed — `BlockTypeIcon`, `RUNTIME_STATE_COLOR`, `deriveBlockStatus` (runtime-canvas/runtimeState.ts) — so the banner matches the detail tab. No new `BlockGlyph`, no builder restyle.

- [ ] 1.1 `summary.ts` pure selectors — derive window view-model `{ phaseName, done, total, window: Cell[], beforeHidden, afterHidden }` from ordered executions + template (WINDOW=2 each side of active); **reuse `deriveBlockStatus`** for state/completedAt/completedByName/skipped; do NOT modify `runtimeState.ts` or `utils/buckets.ts`
- [ ] 1.2 `PathwaySummaryHeader` — status + pathway name + current phase + X/N + thin meter
- [ ] 1.3 `PathwayTrailNode` — stepper cell (half-line · icon node · half-line + name + sub); styled from `RUNTIME_STATE_COLOR` (finished success / now primary+ring / upcoming muted); overdue red sub on now; finished sub = `completedAt · completedByName`
- [ ] 1.4 `PathwayTrailOverflow` — dashed "+N afgerond" / "+N te gaan" end-pill cell
- [ ] 1.5 `PathwayEnrollmentSummary` — banner orchestrator (header + windowed trail); replace inline `PathwayProgress` in `patient/components/PathwayTimeline.tsx`; preserve enrollment chrome + empty/loading/error states
- [ ] 1.6 i18n keys under `patient-pathway` (status, afgerond count, overdue, "+N afgerond"/"+N te gaan", phase fallback)
- [ ] NOTE: anchors, attention strip, phase rail, per-step hover detail → deliberately NOT here; the Zorgpad detail tab (runtime canvas) owns them

### 2c. Styling pass
- [ ] 2c.1 Align to design system tokens (Geist, ZAS teal, radii/shadows); match builder block look via shared `BlockGlyph`

## 3. Verify
- [ ] 3.1 Component tests for the three bucket states + phase grouping + progress header math
- [ ] 3.2 `/verify` (orchestrator lint + typecheck + tests)
- [ ] 3.3 Run the app, open a patient with the bladder-cancer enrollment, confirm it matches the locked prototype
