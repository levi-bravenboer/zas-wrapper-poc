## 0. Prerequisite gate

- [ ] 0.1 Verify `external-block-integrations` is archived (`openspec/changes/archive/external-block-integrations/` exists). Halt and surface to the user if not.

## 1. Cross-reference + dependency alignment

- [ ] 1.1 Re-read the archived `external-block-integrations/design.md` and walk the reuse checklist in this change's design.md; record any deviations as comments inline in design.md
- [ ] 1.2 Lift the inspector header chip component into shared UI if it landed local to the prior change

## 2. Backend catalogue + config

- [ ] 2.1 Extend the `pathway_link` catalogue entry: `source='internal'`, `provider='pathway'`, `kind='link'`, `nested_render`
- [ ] 2.2 Extend `pathway_link` `config_schema` with `version_pin` (enum, default `latest_published`) and conditionally-required `pinned_version_id`
- [ ] 2.3 Server-side validation: reject `version_pin='specific'` without `pinned_version_id`; reject when `pinned_version_id` does not belong to `target_pathway_id`

## 3. Cycle guard

- [ ] 3.1 `app/pathways/nesting/cycle_guard.py`: walk ancestor chain via `pathway_link` blocks bounded at depth 8; reject direct + indirect cycles with `NestedPathwayCycleError`
- [ ] 3.2 Unit tests: direct self-link, indirect A→B→A, distinct chain within bound, bounded depth termination

## 4. Snapshot resolver

- [ ] 4.1 `app/pathways/nesting/resolver.py`: at publish time, walk every `pathway_link` in the version and resolve `snapshot_json` per spec rules
- [ ] 4.2 Publish flow rejects when `version_pin='latest_published'` and target has no published version
- [ ] 4.3 Tests covering specific-pin, latest-published-pin happy + missing-published-version error

## 5. Summary endpoint

- [ ] 5.1 `GET /pathways/{id}/summary` returns `{id, name, lane_count, block_count, latest_published_version_id}`
- [ ] 5.2 Tests: counts, null `latest_published_version_id` for draft-only pathway, 404 for unknown id

## 6. OpenAPI + frontend types

- [ ] 6.1 `moon run backend:openapi` updates `apps/backend/openapi.json`
- [ ] 6.2 `moon run orchestrator:typegen` regenerates TS types

## 7. Orchestrator builder UI

- [ ] 7.1 Nested-pathway block container component: collapsible, renders child summary (name, lane count, block count) via `/pathways/{id}/summary`
- [ ] 7.2 Drill-down: clicking the container navigates to `/pathways/<child-id>?from=<parent-id>`; breadcrumb back to parent
- [ ] 7.3 Autosave flush before drill-down navigation; "saving…" indicator if flush is in flight
- [ ] 7.4 Inspector additions: `version_pin` radio (`Latest published` / `Specific`), `pinned_version_id` picker when specific
- [ ] 7.5 Inspector header reuses chip component from `external-block-integrations` (or shared UI) with `source='internal'`, `provider='pathway'`, `kind='link'`
- [ ] 7.6 Read-only child block list (preview) inside the container — no editing affordance, "open child" call-to-action

## 8. Tests + verification

- [ ] 8.1 Backend pytest covers catalogue metadata, config validation, cycle guard, snapshot resolver, summary endpoint
- [ ] 8.2 Orchestrator vitest covers container rendering, drill-down navigation, inspector picker, autosave-flush interaction
- [ ] 8.3 Run `/verify` and quote results before marking the change apply-complete
