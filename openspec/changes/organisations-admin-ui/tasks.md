## 0. Chain prerequisite

- [x] 0.1 Verify `practitioner-role-split` and `caregiver-shell` both `archived`; bail if not

## 1. Backend writes

- [x] 1.1 Add `app/schemas/organisation/organisation.py` types `OrganisationCreate { name, type, parent_organisation_id? }`, `OrganisationUpdate { name?, type? }`
- [x] 1.2 `OrganisationService.create(actor, payload)` — admin-only; rejects cross-tenant `parent_organisation_id`
- [x] 1.3 `OrganisationService.update(actor, org_id, payload)` — admin-only; rejects re-parenting attempts (`parent_organisation_id` is not in `OrganisationUpdate`)
- [x] 1.4 `OrganisationService.soft_delete(actor, org_id)` — admin-only; pre-checks for references in `organisations` (children), `users`, `patients`, `care_teams`, `practitioner_roles`; surfaces `conflict.organisation.in_use` with the list of blocking entity types
- [x] 1.5 Add `POST /organisations`, `PATCH /organisations/{id}`, `DELETE /organisations/{id}` handlers with `# AUTH-HARDEN` + `Depends(require_role(Role.ADMIN))`
- [x] 1.6 Tests: `tests/api/test_organisation_admin_create.py`, `tests/api/test_organisation_admin_update.py`, `tests/api/test_organisation_admin_delete.py` (in-use rejection across each referencing table)

## 2. Frontend: tree page

- [x] 2.1 Replace placeholder `_auth/admin/organisations.tsx` with `<OrganisationsAdminPage>`
- [x] 2.2 `<OrganisationsAdminPage>` wraps content in `<FilterableListPage>` but with `table` slot replaced by `<OrganisationTree>` (a non-table list)
- [x] 2.3 `<OrganisationTree>` recursive renderer reading the flat `GET /organisations` response, materialising parent→children, supporting expand/collapse, per-node kebab actions, click → opens `<OrganisationDetailSheet>`

## 3. Frontend: dialogs

- [x] 3.1 `<CreateOrganisationDialog>` form: name, type (system + code), parent_organisation_id (hidden when CTA is `Nieuwe root`, prefilled when `Nieuwe sub-organisatie`)
- [x] 3.2 `<EditOrganisationDialog>` form: name, type
- [x] 3.3 `<OrganisationDetailSheet>` right-side `Sheet` showing demographics + list of Practitioners (from `GET /practitioner-roles?organisation_id=<id>&is_open=true`)

## 4. i18n

- [x] 4.1 New namespace `organisations-admin-ui` in both `en/` and `nl/`

## 5. OpenAPI + typed client

- [x] 5.1 `moon run backend:openapi`
- [x] 5.2 `moon run orchestrator:typegen`
- [x] 5.3 Contract test: three new endpoints present

## 6. Tests + verification

- [x] 6.1 `<OrganisationTree>` test: nested rendering + expand/collapse persistence in URL
- [x] 6.2 `<CreateOrganisationDialog>` test: root vs sub-org create paths
- [x] 6.3 `<OrganisationDetailSheet>` test: opens on row click, shows affiliated Practitioners
- [x] 6.4 Backend lint / typecheck / test green
- [x] 6.5 Orchestrator lint / typecheck / test green

## 7. Docs

- [x] 7.1 Update CHAIN tracker
- [x] 7.2 Open follow-up: re-parenting + merge — BL-065
- [x] 7.3 `openspec validate organisations-admin-ui --strict` clean
