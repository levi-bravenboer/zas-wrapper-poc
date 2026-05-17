## Context

The `organisations` table uses an adjacency-list model (`parent_organisation_id`
self-FK). The current admin tree (`OrganisationsAdminPage` +
`OrganisationTree`) renders read-only nested rows from a flat list, sorts
siblings alphabetically, and exposes per-row actions through a dropdown
(edit / create child / archive). Mutations are single-row PATCHes. Frontend
state is held in `useEntityForm` for create/edit and a local `Set<string>` for
expanded nodes.

Admins increasingly need to reshape hierarchies in batches (e.g. after a
merger or reorg) without round-tripping per node, and the existing create /
detail surfaces have not had the design pass that other admin pages received
during the `entity-page` chrome refactor.

Existing patterns we will reuse:
- Sticky bottom action bar — `apps/orchestrator/src/components/data-table/BulkBar.tsx`
- `useEntityForm` + zod schemas — `apps/orchestrator/src/hooks/entity/`
- Combobox: `apps/orchestrator/src/components/ui/combobox.tsx`
- `useDirtyGuard` — confirm dialog before destructive cancel
- shadcn `Sheet`, `Card`, `Separator` for the detail layout
- OpenAPI-generated types from `apps/orchestrator/src/lib/api/schema.d.ts`,
  wrapped by per-module `schemas.ts` (zod) and consumed via `api.ts`

## Goals / Non-Goals

**Goals:**

- Single transactional batch endpoint so partial failures cannot leave the
  hierarchy inconsistent.
- Stable persistent sibling order (`sort_index`) instead of derived
  alphabetical order, allowing manual sequencing.
- Drag-and-drop edit mode that is keyboard- and screen-reader-accessible
  (dnd-kit primitives + ARIA tree semantics).
- No auto-save: edit mode is explicit; Save commits, Cancel reverts.
- Visual refresh of create dialog + detail sheet aligned to current shadcn
  vibe used by users / patients admin pages.
- Reuse the OpenAPI-generated types end-to-end; zod schemas only narrow or
  brand them.

**Non-Goals:**

- Multi-tenant tree merges or cross-tenant moves.
- Bulk archive in edit mode (existing single-row archive stays).
- Virtualisation of the tree (org counts are small enough; revisit > 500
  nodes).
- Audit history surface for tree changes (only `updated_by` / `updated_at`
  are bumped; richer audit is a separate change).
- Migrating to a nested-set / closure-table model (adjacency list stays).

## Decisions

### Decision 1: Single batch endpoint over per-move PATCHes

`PATCH /admin/organisations/tree` accepts `{ moves: [{ id,
parent_organisation_id, sort_index }] }` and applies them in one DB
transaction.

**Why:** Partial failures would leave the tree in a half-applied state that is
expensive to reconcile client-side and breaks user expectations around an
explicit Save action. Cycle detection also needs the full proposed graph,
not per-row context.

**Alternatives:**
- Per-move PATCH loop on Save — simpler backend, but partial failure handling
  on the client is hostile (rollback over the wire is racy).
- WebSocket push of incremental moves — overkill, no real-time requirement.

### Decision 2: Add `sort_index INTEGER NOT NULL DEFAULT 0`

New column on `organisations` with composite index `(parent_organisation_id,
sort_index)`. Backfill: `ROW_NUMBER() OVER (PARTITION BY
parent_organisation_id ORDER BY name) - 1`.

**Why:** Without persistent ordering, dragging between siblings has no
durable effect. Integer index is the standard pattern, cheap to update.

**Trade-off:** Reorder of N siblings rewrites N rows. Acceptable at our
scale (< a few hundred orgs per tenant). If we hit pathological reorders we
can switch to fractional indexing later — schema stays compatible.

### Decision 3: `@dnd-kit` over `react-arborist` / `react-dnd-treeview`

Use `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` and follow
their official sortable-tree example (flat-list with depth projection from
drag offset).

**Why:** shadcn/ui's own blocks already use dnd-kit; it is headless so styling
matches our Tailwind + Radix conventions; React 19-first; accessible
out-of-the-box (Pointer + Keyboard sensors with the standard screen reader
announcements).

**Alternatives:**
- `react-arborist` — bundles virtualization and DnD but imposes its own
  layout primitives; styling fights against shadcn defaults.
- `react-complex-tree` — fine, less popular, less momentum.
- Hand-rolled DnD — violates the "prefer packages" guideline; accessibility
  would be expensive to re-derive.

### Decision 4: Reducer-backed editor state, scoped to the page

`useOrganisationTreeEditor` exposes `{ mode, pendingMoves, expanded,
optimisticFlatTree, actions }`. Actions: `enterEdit`, `exitEdit`, `moveNode`,
`toggleExpand`, `reset`.

**Why:** State is ephemeral and page-scoped — adding it to a global Zustand
store would create a footgun (stale `pendingMoves` after navigation). A
reducer is also trivial to unit-test in isolation.

### Decision 5: Sticky bottom save bar follows BulkBar styling

Reuse the visual + interaction language of
`apps/orchestrator/src/components/data-table/BulkBar.tsx` (sticky bottom,
slide-up on visibility, "X items" left + actions right).

**Why:** Admins already learn this pattern in DataTable bulk operations.
Re-using the same shape avoids inventing a second sticky-bar dialect.

### Decision 6: OpenAPI-generated types are the source of truth

- Backend schemas regenerate `apps/backend/openapi.json` via
  `moon run backend:openapi`.
- Orchestrator regenerates `apps/orchestrator/src/lib/api/schema.d.ts` via
  `moon run orchestrator:typegen`.
- `modules/organisation/schemas.ts` re-exports type aliases derived from
  `components["schemas"]["…"]`, layered with zod for client validation only.
- `modules/organisation/api.ts` uses `openapi-fetch` typed client to talk to
  `/admin/organisations/tree`.

**Why:** Eliminates manual type drift; matches the convention used by
`patient` and `user` modules.

### Decision 7: Cycle detection via in-transaction BFS

Service constructs the proposed parent map (current edges with `moves`
applied) and BFS-walks from each moved node toward root; if it revisits a
moved node's id, raise `OrganisationTreeCycleError` → 409 with
`error_code: "organisation_tree_cycle"`.

**Why:** Cheaper than a recursive CTE per move, runs entirely in app memory
over the (small) set of orgs for the tenant. The endpoint already loads all
tenant orgs for the response payload.

## Risks / Trade-offs

- **Drag offset → depth heuristic feels fiddly** → Mitigation: copy the
  battle-tested calculation from the dnd-kit sortable-tree story; cover with
  unit tests on `projectDepth`. Add 8 px snap so micro-jitter doesn't flip
  the projected parent.
- **Keyboard DnD has a steeper learning curve** → Mitigation: show a
  one-line keyboard hint inside the EditModeBar; rely on dnd-kit's default
  screen-reader announcements; include an "Verplaats…" submenu in the
  per-row dropdown as a non-DnD fallback.
- **Backfill of `sort_index` runs on prod data** → Mitigation: migration is
  pure SQL, ordered by name (stable), wrapped in a single transaction, and
  set as `NOT NULL DEFAULT 0`. Tested against a snapshot in CI.
- **Optimistic tree diverges from server on error** → Mitigation: failed
  mutation keeps the editor open with `pendingMoves` intact and surfaces a
  toast; success path uses the server response to seed the next read.
- **`pendingMoves` payload could grow large** → Mitigation: server caps at
  500 moves per call; client batches to that and disables Save with a
  warning above the cap.
- **OpenAPI typegen requires backend up** → Mitigation: keep the existing
  `/openapi-sync` slash command flow; document the order in tasks.

## Migration Plan

1. Apply Alembic migration: add column + index, backfill `sort_index`.
2. Deploy backend with the new endpoint behind the standard admin
   authorisation. Old single-row PATCHes keep working (no breaking change).
3. Regenerate `apps/backend/openapi.json` and orchestrator typegen.
4. Deploy orchestrator with the editor. The "Bewerk" toggle defaults to off,
   so existing admins see no behaviour change until they opt in.
5. Rollback: orchestrator can be reverted independently — old read-only tree
   continues to work against the new schema (it ignores `sort_index` and
   keeps sorting alphabetically). Backend rollback drops the column via the
   migration's downgrade.

## Open Questions

- Should sub-tree moves auto-expand the destination on hover during DnD? Yes
  for parity with file-manager UX — confirm in implementation review.
- Do we want a "Reset to alphabetical order" admin action somewhere? Not in
  this change; could ship as a follow-up if requested.
