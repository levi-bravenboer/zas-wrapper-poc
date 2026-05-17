## Why

The current organisations admin tree is read-only with alphabetical sibling
ordering and a basic Create dialog / Detail sheet. Admins need to reshape the
org hierarchy (reparent, reorder siblings) without round-tripping per node, and
the create + detail surfaces feel utilitarian relative to the rest of the
admin chrome. This change introduces a true drag-and-drop tree editor with
explicit Save/Cancel, plus a polished create flow and detail layout.

## What Changes

- Add a **drag-and-drop edit mode** for `OrganisationsAdminPage`: a toggle flips the
  tree into editable state with `@dnd-kit/sortable`-powered reparent + sibling
  reorder, drop indicators, and keyboard DnD.
- Stage moves client-side; commit via a single atomic backend call (no
  auto-save). A sticky bottom save bar (BulkBar-style) shows pending count,
  Cancel, and Save changes; Cancel-with-dirty triggers a confirm dialog.
- Add a `sort_index` column to `organisations` (backfilled by name), plus a
  composite index on `(parent_organisation_id, sort_index)`.
- New backend endpoint `PATCH /admin/organisations/tree` accepting a batch of
  `{id, parent_organisation_id, sort_index}` moves, applied in one transaction
  with cycle-detection (BFS) and tenant isolation.
- **Refresh the create dialog**: searchable type combobox (FHIR org-types) and
  parent picker with indented combobox.
- **Refresh the detail sheet**: hero header (name + type badge + parent link),
  shadcn `Card`-sectioned body (Basisgegevens · Sub-organisaties · Aangesloten
  zorgverleners).

## Capabilities

### New Capabilities

(none — extending existing capabilities)

### Modified Capabilities

- `organisations-base`: add `sort_index` field to organisation persistence and
  expose a batch tree-move endpoint with cycle validation.
- `organisations-admin-ui`: introduce drag-and-drop edit mode with batch save,
  redesigned create dialog, and refreshed detail sheet layout.

## Impact

- **Backend**
  - New Alembic migration adding `organisations.sort_index` + index
  - New schema `OrganisationTreeMove` / `OrganisationTreeUpdate`
  - New service `organisation_tree_service.apply_tree_moves`
  - New router endpoint `PATCH /admin/organisations/tree`
  - `OrganisationRead` schema gains `sort_index`
  - OpenAPI regen → orchestrator typegen
- **Orchestrator**
  - New deps: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`
  - New `OrganisationTreeEditor` (flat-tree DnD + reducer state)
  - Refactor `OrganisationTree` to share read-only renderer
  - Refresh `CreateOrganisationDialog` (combobox parent picker + type combobox)
  - Refresh `OrganisationDetailSheet` (hero header + Card-sectioned body)
  - Sticky bottom `EditModeBar` reusing BulkBar styling pattern
  - New i18n keys under `organisations-admin-ui`
- **Tests**
  - Backend: tree-move router + service tests (happy, cycle, tenant, 422/403)
  - Orchestrator: editor reducer, DnD interactions (RTL), create + detail
    visual regressions covered by existing test suite
