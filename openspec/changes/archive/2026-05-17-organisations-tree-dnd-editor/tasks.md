## 1. Backend — schema + migration

- [x] 1.1 Add `sort_index` to the `Organisation` SQLAlchemy model (`apps/backend/app/db/models/organisation/organisation.py`) as `Mapped[int]` with `nullable=False`, `server_default="0"`.
- [x] 1.2 Generate an Alembic migration via `moon run backend:make-migration "add organisations sort_index"`; edit the autogen to add the column with `server_default=0`, create composite index `ix_organisations_parent_sort` on `(parent_organisation_id, sort_index)`, and backfill with `UPDATE organisations SET sort_index = sub.rn - 1 FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_organisation_id ORDER BY name, id) AS rn FROM organisations) sub WHERE organisations.id = sub.id;`.
- [x] 1.3 Add migration tests at `apps/backend/tests/repositories/organisation/test_sort_index_backfill.py` covering the backfill SQL renumbers each sibling group contiguously by name (test DB uses `Base.metadata.create_all`, not alembic — no `tests/migrations/` dir exists).
- [x] 1.4 Add `sort_index: int` to `OrganisationRead` (`apps/backend/app/schemas/organisation/organisation.py`); update existing serialisers + tests where appropriate.
- [x] 1.5 Order the `list_organisations` repository query by `(parent_organisation_id NULLS FIRST, sort_index, name)`; extend `tests/api/routers/organisation/test_organisation_router.py::test_list_organisations_orders_by_sort_index` to assert the new order.

## 2. Backend — tree-move endpoint

- [x] 2.1 Add `OrganisationTreeMove` and `OrganisationTreeUpdate` Pydantic schemas under `apps/backend/app/schemas/organisation/tree.py`; enforce `1 ≤ len(moves) ≤ 500` via `Field(min_length=1, max_length=500)`.
- [x] 2.2 Add `OrganisationTreeCycleError` to `apps/backend/app/services/organisation/errors.py`.
- [x] 2.3 Implement `apps/backend/app/services/organisation/organisation_tree_service.py::apply_tree_moves(session, tenant_id, actor_id, moves)`: lock the affected rows with `SELECT ... FOR UPDATE`, build the proposed parent map (current edges with `moves` applied), BFS from each moved node to detect cycles, then apply updates (parent, sort_index, updated_by, updated_at) and return the refreshed tenant tree.
- [x] 2.4 Add `PATCH /admin/organisations/tree` to `apps/backend/app/api/routers/organisation/admin_router.py` (marked `# AUTH-HARDEN`), wired to `apply_tree_moves`; map service errors to HTTP: cycle → 409 `organisation_tree_cycle`, cross-tenant parent → 403 `forbidden.organisation.cross_tenant`, unknown id → 404, schema violation → 422.
- [x] 2.5 Add admin authz dependency that rejects `caregiver` sessions with `403`.
- [x] 2.6 Add unit tests for `apply_tree_moves` at `apps/backend/tests/services/organisation/test_organisation_tree_service.py` covering: single reparent, sibling reorder, multi-move atomicity, cycle detection (direct and indirect), tenant isolation, unknown id, empty moves rejection at schema layer.
- [x] 2.7 Add router tests at `apps/backend/tests/api/routers/organisation/test_organisation_tree_router.py` covering: happy paths from §2.6, 401 unauthenticated, 403 caregiver, 422 empty/oversized payload.
- [x] 2.8 Regenerate the OpenAPI doc via `moon run backend:openapi`; commit the updated `apps/backend/openapi.json`.

## 3. Orchestrator — typegen + module wiring

- [x] 3.1 Run `moon run orchestrator:typegen` against the running backend; verify `apps/orchestrator/src/lib/api/schema.d.ts` exposes `OrganisationTreeUpdate`, `OrganisationTreeMove`, and the new `PATCH /admin/organisations/tree` operation under `paths`.
- [x] 3.2 In `apps/orchestrator/src/modules/organisation/schemas.ts`, add type aliases derived from the generated `components["schemas"]` for the new tree types and re-export them; add zod parsers only for client-side validation of `pendingMoves` size.
- [x] 3.3 In `apps/orchestrator/src/modules/organisation/api.ts`, add `patchOrganisationTree(client, body)` using the typed `openapi-fetch` client; reuse existing error mapping helper.
- [x] 3.4 In `apps/orchestrator/src/modules/organisation/keys.ts`, add `organisationKeys.tree(tenantId?)` if not already present and ensure invalidation queries cover the tree.
- [x] 3.5 In `apps/orchestrator/src/modules/organisation/hooks.ts`, add `useOrganisationTreeMutation()` (TanStack Query) wrapping `patchOrganisationTree`; on success `queryClient.setQueryData` with the response and invalidate dependent queries.

## 4. Orchestrator — editor primitives

- [x] 4.1 Add deps to `apps/orchestrator/package.json`: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`; run `moon run orchestrator:install`.
- [x] 4.2 Implement pure helpers under `apps/orchestrator/src/modules/organisation/tree/`:
  - `flattenTree(orgs)`: build `FlatItem[] { id, parentId, depth, hasChildren, collapsed }` sorted by `sort_index`.
  - `projectDepth(activeId, overId, offsetLeft, indent)`: lift from the dnd-kit sortable-tree example; cover with unit tests.
  - `applyMovesOverlay(orgs, pendingMoves)`: return a derived flat tree reflecting staged moves.
- [x] 4.3 Implement `useOrganisationTreeEditor` reducer at `apps/orchestrator/src/modules/organisation/hooks/useOrganisationTreeEditor.ts` with state `{ mode, pendingMoves, expanded }` and actions `enterEdit | exitEdit | moveNode | toggleExpand | reset`; ship with full unit tests under `__tests__/useOrganisationTreeEditor.test.ts`.

## 5. Orchestrator — editable tree component

- [x] 5.1 Extract the read-only render of `OrganisationTree` into a `<TreeRow>` subcomponent so it can be reused inside both read-only and edit-mode trees.
- [x] 5.2 Create `<OrganisationTreeEditor>` at `apps/orchestrator/src/modules/organisation/components/OrganisationTreeEditor.tsx`: `DndContext` with `PointerSensor` + `KeyboardSensor`, `SortableContext` (vertical), `TreeRow` rendering with drag handle, indent depth driven by `projectDepth`, drop indicator overlay using `border-primary` ring.
- [x] 5.3 Add ARIA tree semantics to both renderers (`role="tree"`, `role="treeitem"`, `aria-level`, `aria-expanded`); keyboard handler hint surfaced inside edit-mode bar.
- [x] 5.4 Update `<OrganisationsAdminPage>` to render `<OrganisationTreeEditor>` when `mode === 'edit'`, otherwise `<OrganisationTree>`; mount `useOrganisationTreeEditor`, pass `pendingMoves` and `moveNode` callback.
- [x] 5.5 Add the `Bewerk volgorde` toggle to the page header; disable per-row kebabs and the `Nieuwe root` CTA while in edit mode.

## 6. Orchestrator — edit-mode save bar + dirty guard

- [x] 6.1 Create `<EditModeBar>` at `apps/orchestrator/src/modules/organisation/components/EditModeBar.tsx`, copying the sticky-bottom styling shape of `apps/orchestrator/src/components/data-table/BulkBar.tsx` (do not import `BulkBar` itself — different context provider).
- [x] 6.2 Wire `Wijzigingen opslaan` to `useOrganisationTreeMutation`; disable when `pendingMoves.size === 0` or `> 500`; on success exit edit mode and toast; on error keep editor open and toast with `error_code`.
- [x] 6.3 Wire `Annuleren` to a `useDirtyGuard`-backed `AlertDialog` ("Wijzigingen verwerpen?") that only opens when `pendingMoves.size > 0`.
- [x] 6.4 Add an i18n keyboard-DnD hint inside the bar ("Sleep met de muis, of gebruik spatie + pijltjes").

## 7. Orchestrator — create dialog refresh

- [ ] 7.1 Rebuild `<CreateOrganisationDialog>` to use `useEntityForm` + zod schemas already in `organisationForm.schema.ts`; layout = single column stacked.
- [ ] 7.2 Replace the type `<Select>` with the shadcn `Command`-in-`Popover` combobox (reuse `apps/orchestrator/src/components/ui/combobox.tsx`); options derived from `OrganisationTypeCode` map, label = `type_display`, secondary = `type_code`.
- [ ] 7.3 Replace the parent select with an indented combobox: compute each option's depth from the current tree and render an indent prefix (`└─` style) per depth; pin `Geen (root)` as the first option.
- [ ] 7.4 Update existing dialog tests (`CreateOrganisationDialog.test.tsx`) for the new controls; add coverage for combobox keyboard navigation and submit happy-path.

## 8. Orchestrator — detail sheet refresh

- [ ] 8.1 Restructure `<OrganisationDetailSheet>` with a header section (name `text-2xl font-semibold`, type badge, optional `Sub-organisatie van: {parent}` link that closes the sheet and opens the parent's via the existing detail-sheet store).
- [ ] 8.2 Replace the body with stacked shadcn `Card`s separated by `Separator`: `Basisgegevens` (name, type, parent, audit fields), `Sub-organisaties` (immediate-children count + linked list derived from the tree cache), `Aangesloten zorgverleners` (existing data).
- [ ] 8.3 Add centred empty-state copy per Card using the entity-page chrome's existing empty-state component.
- [ ] 8.4 Update `OrganisationDetailSheet.test.tsx` for the new structure; add a test that clicking the parent link swaps the sheet target.

## 9. i18n

- [x] 9.1 Add Dutch strings under `apps/orchestrator/src/lib/i18n/locales/nl/organisations-admin-ui.json`: edit-mode toggle (`tree.edit.toggle`), save bar (`tree.edit.bar.count.one/other`, `tree.edit.bar.save`, `tree.edit.bar.cancel`, `tree.edit.bar.hint`), confirm dialog (`tree.edit.discard.title/description/confirm/cancel`), cycle toast (`tree.edit.error.cycle`), detail sheet (`detail.parent_link`, `detail.children.empty`, `detail.children.title`), create dialog combobox copy.
- [ ] 9.2 Update `tests-e2e/orchestrator/admin/organisations.spec.ts` (if present) or add coverage to existing RTL tests for the new strings.

## 10. Verify

- [x] 10.1 Run `moon run backend:lint` + `moon run backend:typecheck`; fix any issues.
- [x] 10.2 Run `moon run backend:test-host -- tests/api/routers/organisation/ tests/services/organisation/ tests/schemas/organisation/ tests/migrations/test_organisations_sort_index.py`; expect all green.
- [x] 10.3 Run `moon run orchestrator:lint` + `moon run orchestrator:typecheck`; fix any issues.
- [x] 10.4 Run `moon run orchestrator:test`; expect all green.
- [ ] 10.5 Manually verify in `moon run :up` stack: enter edit mode, drag-reparent + reorder, Save, refresh, confirm persistence; Cancel with dirty triggers AlertDialog; cycle attempt surfaces toast.
- [x] 10.6 Update `openspec/changes/CHAIN-orchestrator-admin-ux.md` with a row for `organisations-tree-dnd-editor` (post-chain follow-up) and set its status to in-progress while the change is open.
