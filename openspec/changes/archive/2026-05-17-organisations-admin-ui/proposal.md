**Tier**: chain — orchestrator-admin-ux #4

## Why

`organisations-base` ships a tenant-scoped read-only `GET /organisations`. The orchestrator-admin-ux chain needs an admin surface to add and rename organisations — the demo story is "Zas Hospital is the root, add an external GP practice as a sibling root, add a Cardiology department under the hospital". Without write endpoints + a tree-editor UI, the only way to materialise that today is via seed scripts.

`caregiver-shell` registered the placeholder `_auth/admin/organisations` route and the admin layout gate. This change replaces the placeholder with a real tree-editor and adds the minimal admin writes the editor needs.

This change is **#4 of the orchestrator-admin-ux chain**. It MAY ship in parallel with `#3 users-admin-ui` and `#6 patient-profile-ui`.

## What Changes

- **Add capability `organisations-admin-ui`** covering:
  - Tree editor at `/_auth/admin/organisations` rendering the tenant's organisation tree (recursive `<TreeNode>`). Each node shows name + type chip. Per-node kebab: `Bewerken`, `Nieuwe sub-organisatie`, `Archiveren` (soft delete, destructive confirm). A primary CTA `Nieuwe root` opens the create dialog with `parent_organisation_id = null`.
  - Detail drawer (right-aligned shadcn `Sheet`) opens on row click, showing demographics + a small list of `Practitioners affiliated here` (links into `practitioner-roles-admin-ui` placeholders for now).
- **Add backend admin endpoints** under `/organisations` (admin-only, `# AUTH-HARDEN`):
  - `POST /organisations` — create an organisation. Body: `name`, `type` (CodeableConcept-shaped: `system` + `code`), optional `parent_organisation_id` (must be in same tenant; null = root).
  - `PATCH /organisations/{id}` — edit `name`, `type`. Re-parenting is OUT of scope (tree restructure is risky; backlog).
  - `DELETE /organisations/{id}` — soft-close: SHALL be rejected if any non-soft-deleted child organisation exists OR if any user / patient / care-team / practitioner_role still references the org. Otherwise stamps `deleted_at` and returns 204.
- **MODIFIES `organisations-base`**: adds the three write endpoints (additive). `GET /organisations` shape unchanged.
- **Regenerate OpenAPI + typed client.**

## Capabilities

### New Capabilities

- `organisations-admin-ui`: tree editor UI + the admin writes it needs.

### Modified Capabilities

- `organisations-base`: gains `POST`, `PATCH`, soft-`DELETE` endpoints (additive).

## Impact

- **Chain prerequisites**: `practitioner-role-split` and `caregiver-shell` both archived.
- **Code**:
  - Backend: `app/api/routers/organisation/organisation_router.py` — add three write handlers.
  - Backend: `app/services/organisation/organisation_service.py` — `create`, `update`, `soft_delete` with reference-check.
  - Backend: `app/schemas/organisation/organisation.py` — add `OrganisationCreate`, `OrganisationUpdate`.
  - Frontend: replace placeholder `_auth/admin/organisations.tsx` with `<OrganisationsAdminPage>`.
  - Frontend: `apps/orchestrator/src/features/organisations/OrganisationTree.tsx`, `OrganisationDetailSheet.tsx`, `CreateOrganisationDialog.tsx`, `EditOrganisationDialog.tsx`.
  - Frontend: `i18n/<lang>/organisations-admin-ui.json`.
- **APIs**: 3 new endpoints; 0 modified.
- **DB**: no schema changes.
- **Demo**: admin builds Zas tree (Hospital root, Cardio + Pediatrics under it) and adds external GP practice as a sibling root.
- **Chain position**: change #4 (parallel with #3 + #6).

## Risks and mitigations

- **R1 — accidental cycle on re-parent.** Mitigation: re-parenting is OUT of scope for this change. Only insertion + name/type edit are admin-write paths.
- **R2 — soft-delete of an organisation in use.** Existing FKs use `ON DELETE RESTRICT`, so a hard delete already errors. **Mitigation**: the soft-delete path SHALL pre-check that no non-soft-deleted children, users, patients, care-teams, or PractitionerRoles reference the org; if any do, return 409 with `ErrorResponse{ code: "conflict.organisation.in_use" }` listing which entity types still reference it.
- **R3 — large trees rendered too eagerly.** Tenant trees are small in PoC (<20 nodes), but render perf with deeply nested `<TreeNode>` should still be measured. **Mitigation**: `<OrganisationTree>` virtualises only if `nodes.length > 100`; otherwise renders all.

## Out of scope

- Re-parenting (moving a node to a new parent) — backlog.
- Bulk org import — backlog.
- Locking / per-org RBAC — backlog.
- Organisation merge — out of chain.
