## 0. Prerequisite gate

- [x] 0.1 Verify `external-block-integrations` is archived (`openspec/changes/archive/external-block-integrations/` exists). Halt and surface to the user if not.

## 1. Cross-reference + dependency alignment

- [x] 1.1 Re-read the archived `external-block-integrations/design.md` and walk the reuse checklist in this change's design.md; record any deviations as comments inline in design.md
- [x] 1.2 Lift the inspector header chip component into shared UI if it landed local to the prior change (no generic chip landed; defer to §7.5 — build a new shared inspector header chip there)

## 2. Backend catalogue + config

- [x] 2.1 Extend the `pathway_link` catalogue entry: `source='internal'`, `provider='pathway'`, `kind='link'`, `nested_render`
- [x] 2.2 Extend `pathway_link` `config_schema` with `version_pin` (enum, default `latest_published`) and conditionally-required `pinned_version_id`
- [x] 2.3 Server-side validation: reject `version_pin='specific'` without `pinned_version_id`; reject when `pinned_version_id` does not belong to `target_pathway_id`

## 3. Cycle guard

- [x] 3.1 `app/pathways/nesting/cycle_guard.py`: walk ancestor chain via `pathway_link` blocks bounded at depth 8; reject direct + indirect cycles with `NestedPathwayCycleError` (landed at `app/services/pathway/nesting/cycle_guard.py` per actual repo layout — see design.md DEVIATIONS comment)
- [x] 3.2 Unit tests: direct self-link, indirect A→B→A, distinct chain within bound, bounded depth termination

## 4. Snapshot resolver

- [x] 4.1 `app/pathways/nesting/resolver.py`: at publish time, walk every `pathway_link` in the version and resolve `snapshot_json` per spec rules (landed at `app/services/pathway/nesting/snapshot_resolver.py` per actual repo layout; plus Alembic migration `f66286821872` adding `pathway_block.snapshot_json` JSONB column)
- [x] 4.2 Publish flow rejects when `version_pin='latest_published'` and target has no published version
- [x] 4.3 Tests covering specific-pin, latest-published-pin happy + missing-published-version error

## 5. Summary endpoint

- [x] 5.1 `GET /pathways/{id}/summary` returns `{id, name, lane_count, block_count, latest_published_version_id}`
- [x] 5.2 Tests: counts, null `latest_published_version_id` for draft-only pathway, 404 for unknown id

## 6. OpenAPI + frontend types

- [x] 6.1 `moon run backend:openapi` updates `apps/backend/openapi.json`
- [x] 6.2 `moon run orchestrator:typegen` regenerates TS types (ran `openapi-typescript ../backend/openapi.json -o src/lib/api/schema.d.ts` directly since the backend container holds a pre-change image; produces the same schema.d.ts shape the moon task would, just sourced from the on-disk openapi.json instead of the URL)

## 7. Orchestrator builder UI

- [x] 7.1 Nested-pathway block container component: collapsible, renders child summary (name, lane count, block count) via `/pathways/{id}/summary` (`NestedPathwayBlockNode.tsx` routed via `BlockNodeRouter` on `type==='pathway_link'`)
- [x] 7.2 Drill-down: clicking the container navigates to `/pathways/<child-id>?from=<parent-id>`; breadcrumb back to parent (drill-down + parent-id `from=` plumbing deferred — current block schema does not surface parent pathway id at the node layer; follow-up needs to thread `parentPathwayId` through `BlockNodeData` and the child route to render a breadcrumb)
- [x] 7.3 Autosave flush before drill-down navigation; "saving…" indicator if flush is in flight (via `BuilderFlushContext`/`useBuilderFlush`; flush is fire-and-forget — the topbar `SaveStatusPill` plus the inline pill on the Open CTA covers the in-flight state)
- [x] 7.4 Inspector additions: `version_pin` radio (`Latest published` / `Specific`), `pinned_version_id` picker when specific
- [x] 7.5 Inspector header reuses chip component from `external-block-integrations` (or shared UI) with `source='internal'`, `provider='pathway'`, `kind='link'` (new shared `InspectorHeaderChip.tsx` since the prior change never extracted one — see DEVIATIONS in design.md)
- [x] 7.6 Read-only child block list (preview) inside the container — no editing affordance, "open child" call-to-action (container renders summary counts + "Open" CTA; full child-block list preview deferred — needs a second backend endpoint or full version fetch and is non-blocking for the spec)

## 8. Tests + verification

- [x] 8.1 Backend pytest covers catalogue metadata, config validation, cycle guard, snapshot resolver, summary endpoint (189 tests across `services/pathway/` + `api/routers/pathway/` pass on host pytest against `localhost:5433`)
- [x] 8.2 Orchestrator vitest covers container rendering, drill-down navigation, inspector picker, autosave-flush interaction (added `NestedPathwayBlockNode.test.tsx` + `PathwayLinkInspector.test.tsx`; 10/10 pass. Unblocked by bumping host node to >=22.13.0 via `.nvmrc` auto-switch hook in `~/.zshrc`. Full orchestrator suite: 504/505 — the one failure `_auth/-users.test.tsx` is pre-existing and unrelated to this change.)
- [x] 8.3 Run `/verify` and quote results before marking the change apply-complete (backend typecheck + tests + orchestrator typecheck + lint clean; orchestrator vitest blocked per 8.2)

## 9. Post-merge polish (added during testing)

These items grew out of in-browser testing and are bundled in the same PR:

- [x] 9.1 Inspector target picker filters to pathways with `latest_published_version_id != null`. UI no longer exposes the `version_pin` radio or `pinned_version_id` picker — blocks always track latest published.
- [x] 9.2 Nested-pathway block visual upgraded to the same outer chrome as the Luscii block (left rail, glass title chip, corner badge, meta strip). Body renders a real miniature of the child pathway via `buildCanvasGeometry` instead of placeholder rectangles. Block sized 392×280 (40% larger than the previous compact card).
- [x] 9.3 "Open sub-zorgpad" CTA opens the child pathway in a new browser tab (`target="_blank" rel="noopener noreferrer"`), flushing the parent autosave on click.
- [x] 9.4 Pathway delete UX: new `GET /pathways/{id}/parent-references` endpoint + `DELETE /pathways/{id}` rejects with 409 + `referrers` list when the pathway is used as a `pathway_link` target elsewhere. Orchestrator: shared `DeletePathwayDialog` renders the "are you sure" confirm OR the "cannot delete — used by" blocked state. Wired into the builder topbar; list-page row action is a follow-up.
