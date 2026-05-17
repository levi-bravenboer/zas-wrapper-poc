# pathway-config-forms — tasks

## 1. Zod schemas + parser

- [ ] 1.1 Create `apps/orchestrator/src/modules/pathway/configSchemas.ts` with one Zod schema per `BlockSemantics`.
- [ ] 1.2 Export `ConfigForSemantics<S>` type and `parseBlockConfig(block, semantics)` helper.
- [ ] 1.3 Vitest `configSchemas.test.ts` — round-trip per semantics + one failing fixture per schema.

## 2. Replace runtime-narrowing shims

- [ ] 2.1 Rewrite `blockCatalogue.utils.ts` `blockSemanticsSummary` to consume parsed config (drop `asString` / `asArray`).
- [ ] 2.2 Add `try { parse } catch` and return undefined summary on parse failure (graceful at the summary level — full inspector shows the error).
- [ ] 2.3 Verify existing `blockCatalogue.test.ts` still passes (or update if shape shifts).

## 3. `patch-edge` reducer action

- [ ] 3.1 Add `{ type: 'patch-edge'; edgeId: string; patch: Partial<PathwayEdge> }` to `BuilderAction`.
- [ ] 3.2 Implement the reducer case (mirror `patch-block`, push history).
- [ ] 3.3 Vitest `useBuilderState.test.ts` — `patch-edge` happy path + history push + undo restores prior edge.

## 4. Block inspector — bespoke per semantics

- [ ] 4.1 Add directory `apps/orchestrator/src/modules/pathway/components/drawer/inspectors/`.
- [ ] 4.2 `AppointmentInspector.tsx` — kind text + location text. Test: renders + dispatches.
- [ ] 4.3 `TaskInspector.tsx` — assignee picker (role enum: `caregiver` / `admin`) + description textarea. Test: renders + dispatches.
- [ ] 4.4 `MessageInspector.tsx` — channel segmented + subject + body + CTA pair. Test: renders + dispatches.
- [ ] 4.5 `FormInspector.tsx` — questions list editor with add / remove / move-up / move-down; per-question type select + label + required toggle; options field visible when `type` is choice-shaped. Test: renders existing questions + add/remove + reorder.
- [ ] 4.6 `DecisionInspector.tsx` — criterion textarea + read-only list of `block.branches` (labels editable inline). Test: renders + dispatches criterion patch.
- [ ] 4.7 `MilestoneInspector.tsx` — note textarea. Test: renders + dispatches.
- [ ] 4.8 `WaitInspector.tsx` — event_type select (closed enum), timeout_days number, on_timeout select, source_block_id select over current pathway's blocks. Test: renders + dispatches.
- [ ] 4.9 `PathwayLinkInspector.tsx` — target_pathway_id combobox over `GET /pathways` summaries, mode segmented, context_mapping key/value editor. Test: renders + dispatches with all three sub-fields.

## 5. Drawer wiring

- [ ] 5.1 Update `BuilderDrawer.tsx` — switch on `blockType.semantics`; drop `INSPECTOR_PENDING_SEMANTICS` placeholder; render the matching inspector with parsed config.
- [ ] 5.2 Add an error-banner branch when `parseBlockConfig` throws: show Zod error + "reset to default" button that dispatches `patch-block` with `schema.parse({})` defaults (or `{}` if the schema can't supply defaults).
- [ ] 5.3 Delete `ConfigForm.tsx` (RJSF) once all inspectors are wired.
- [ ] 5.4 Remove `@rjsf/core`, `@rjsf/utils`, `@rjsf/validator-ajv8` from `apps/orchestrator/package.json` and lockfile.

## 6. Edge inspector

- [ ] 6.1 Create `EdgeInspector.tsx` matching `BuilderDrawer` chrome (header with edge label, body with kind picker + sub-form, footer with delete + close).
- [ ] 6.2 Kind picker — segmented control over four kinds; current kind derived from `readEdgeTiming(edge).kind`.
- [ ] 6.3 Sub-form per kind: `completion` (timing-value select), `marker` (marker + offset value + direction), `immediate` (empty), `branch` (source block branches select).
- [ ] 6.4 On any change, dispatch `patch-edge` with a **full reset** of the union columns (null abandoned-kind fields).
- [ ] 6.5 Handle missing source block on `branch` mode: disable picker, show muted "Geen branches op bronblok" copy.
- [ ] 6.6 Vitest `EdgeInspector.test.tsx` — render per kind, switch kind clears the right fields, dispatch shape correct.

## 7. Shell wiring

- [ ] 7.1 In `PathwayBuilderShell`, branch on `selection.kind`: render `BuilderDrawer` for block, `EdgeInspector` for edge.
- [ ] 7.2 Pass `timingKinds` + `offsetDirections` catalogue data to the inspector — loader fetches both alongside the existing block-type catalogue.
- [ ] 7.3 Verify selection clears correctly when source block of selected edge is deleted (existing `delete-block` reducer already filters edges, just need to ensure selection collapses to `{ kind: 'none' }` for edge selection too).

## 8. i18n + copy

- [ ] 8.1 Add `inspector.*` keys to `apps/orchestrator/src/lib/i18n/locales/nl/pathway.json` for each inspector's labels, placeholders, helper copy. Dutch only.
- [ ] 8.2 Run `moon run orchestrator:lint` to catch stray English strings.

## 9. Catalogue endpoints in loader

- [ ] 9.1 Extend the builder route loader to fetch `GET /pathway-edge-timing-kinds` and `GET /pathway-edge-offset-directions` in parallel with the existing catalogue + pathway + phase-templates calls.
- [ ] 9.2 Add `usePathwayEdgeTimingKinds()` and `usePathwayEdgeOffsetDirections()` query hooks under `modules/pathway/api.ts` (or extend the existing hook).
- [ ] 9.3 Vitest — query keys + happy-path fetch under MSW.

## 10. Cleanups

- [ ] 10.1 Drop the `INSPECTOR_PENDING_SEMANTICS` constant from `BuilderDrawer.tsx`.
- [ ] 10.2 Drop `asString` / `asArray` from `blockCatalogue.utils.ts` if not referenced elsewhere.
- [ ] 10.3 Mark `BL-064` resolved in `openspec/backlog.md` (move to "Closed" section or strike, per backlog convention).
- [ ] 10.4 Update `openspec/scope.md` F3 row — drop the "Inspector forms for `form` / `wait` / `pathway_link` are placeholders pending `pathway-config-forms`" caveat.

## 11. Verification

- [ ] 11.1 `moon run orchestrator:test` green.
- [ ] 11.2 `moon run orchestrator:lint` clean.
- [ ] 11.3 `moon run orchestrator:typecheck` clean.
- [ ] 11.4 Manual smoke: open builder, add form/wait/pathway_link blocks, configure each, switch every edge through all four timing kinds, undo/redo each, save → refresh → state persists. Document any issues found.
- [ ] 11.5 Playwright happy-path deferred — same blocker as `pathway-block-redesign` 11.4 (MSW pathway handlers + builder e2e harness not built yet). Tracked for a future change.
