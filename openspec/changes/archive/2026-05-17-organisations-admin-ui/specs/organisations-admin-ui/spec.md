## ADDED Requirements

### Requirement: Admin can create organisations, optionally rooted under an existing parent

The backend SHALL expose `POST /organisations` (admin-only, `# AUTH-HARDEN`-marked) accepting `OrganisationCreate { name, type, parent_organisation_id? }`. When `parent_organisation_id` is provided, the parent MUST be in the actor's tenant; mismatching tenants SHALL return `403`. The new row inherits its tenant from the actor's session, and its `parent_organisation_id` from the body (NULL = root).

#### Scenario: Admin creates a root organisation

- **WHEN** an admin posts `{"name": "Acme Care", "type": {"system": "hl7", "code": "prov"}, "parent_organisation_id": null}`
- **THEN** the response is `201 Created` with the new `OrganisationRow` having `parent_organisation_id = null` and a matching `tenant_id`

#### Scenario: Admin creates a child organisation

- **WHEN** an admin posts a body with `parent_organisation_id` set to an existing same-tenant organisation
- **THEN** the response is `201 Created` and `GET /organisations` MUST now include the new row pointing at the parent

#### Scenario: Cross-tenant parent rejected

- **WHEN** an admin posts a body with `parent_organisation_id` referencing an organisation in a different tenant
- **THEN** the response is `403 Forbidden` with `ErrorResponse{ code: "forbidden.organisation.cross_tenant" }`

### Requirement: Admin can rename and re-type organisations, but not re-parent

The backend SHALL expose `PATCH /organisations/{org_id}` (admin-only, `# AUTH-HARDEN`-marked) accepting `OrganisationUpdate { name?, type? }`. The body schema SHALL NOT contain a `parent_organisation_id` field; re-parenting is explicitly out of scope for this change. Cross-tenant updates SHALL return `403`.

#### Scenario: Name edit succeeds

- **WHEN** an admin PATCHes `name: "Acme Care BV"` on an org in their tenant
- **THEN** the response is `200` and a follow-up `GET` reflects the new name

#### Scenario: Re-parenting attempt rejected by schema

- **WHEN** an admin PATCHes a body that includes `parent_organisation_id`
- **THEN** the response is `422 Unprocessable Entity` (schema rejects the field), and the row's parent MUST NOT change

### Requirement: Admin can soft-delete organisations only when unreferenced

The backend SHALL expose `DELETE /organisations/{org_id}` (admin-only, `# AUTH-HARDEN`-marked) performing a soft delete (stamps `deleted_at`, returns `204`). Before stamping, the handler SHALL pre-check for references and reject with `409 Conflict` + `ErrorResponse{ code: "conflict.organisation.in_use", details: { references: [...] } }` when any of the following exist for that organisation (excluding soft-deleted rows):

- Child organisations whose `parent_organisation_id` is the target.
- Patients whose `primary_organisation_id` is the target.
- Care teams referencing the target (if any FKs).
- Open `practitioner_roles` whose `organisation_id` is the target.

The `details.references` SHALL list which entity types still reference the org, so the UI can surface a precise reason.

#### Scenario: Soft delete with no references succeeds

- **WHEN** an admin DELETEs an organisation with no children, no patients, no open practitioner roles
- **THEN** the response is `204 No Content` and a follow-up `GET /organisations` MUST NOT include the row

#### Scenario: Soft delete with a child org rejected

- **WHEN** an admin DELETEs an organisation that has a non-soft-deleted child organisation
- **THEN** the response is `409 Conflict` with `details.references` containing `"organisations"`

#### Scenario: Soft delete with open practitioner roles rejected

- **WHEN** an admin DELETEs an organisation that has at least one `PractitionerRole` with `period_end IS NULL` and `organisation_id` set to the target
- **THEN** the response is `409 Conflict` with `details.references` containing `"practitioner_roles"`

### Requirement: Admin organisations page renders the tenant tree with per-node actions

The orchestrator SHALL render at `/_auth/admin/organisations` an `<OrganisationsAdminPage>` that wraps `<OrganisationTree>` inside `<FilterableListPage>` (using the scaffolding's `table` slot for the tree). The tree SHALL materialise the flat `GET /organisations` response into a recursive `parent → children` structure, support expand/collapse with state persisted in the URL, and render per-node kebab actions:

- `Nieuwe sub-organisatie` — opens `<CreateOrganisationDialog>` with `parent_organisation_id` prefilled.
- `Bewerken` — opens `<EditOrganisationDialog>`.
- `Archiveren` — destructive confirm; calls `DELETE /organisations/{id}` and surfaces a `conflict.organisation.in_use` error with a human-readable list of blocking references.

The page primary CTA SHALL be `Nieuwe root` opening `<CreateOrganisationDialog>` with `parent_organisation_id = null`. Clicking a node body (not the kebab) SHALL open `<OrganisationDetailSheet>` on the right side, listing demographics and Practitioners affiliated through open PractitionerRole rows.

#### Scenario: Tree renders nested hierarchy

- **WHEN** the admin loads the page in a tenant with one root and two children
- **THEN** the page MUST render one top-level node containing two nested nodes, with each node showing name + type chip

#### Scenario: Archiving an in-use org surfaces the precise blocker

- **WHEN** the admin archives an organisation that still has open PractitionerRole rows
- **THEN** the destructive-confirm result MUST surface copy that includes "Praktijkrol" (or English equivalent), derived from `ErrorResponse.details.references`, and the row MUST remain in the tree

#### Scenario: Caregiver session redirected from admin page

- **WHEN** a caregiver navigates to `/_auth/admin/organisations`
- **THEN** the admin route-group layout MUST redirect to `/_auth/` before the page mounts

### Requirement: Detail sheet surfaces affiliated practitioners

The orchestrator's `<OrganisationDetailSheet>` SHALL fetch open `PractitionerRole` rows via `GET /practitioner-roles?organisation_id={id}&is_open=true` and render them as a compact list (Practitioner display name + role code badge). Each entry MAY link out to `/_auth/admin/practitioner-roles?practitioner_id=<…>` (placeholder until `practitioner-roles-admin-ui` ships).

#### Scenario: Sheet shows zero state when no affiliated practitioners

- **WHEN** an organisation has zero open PractitionerRole rows
- **THEN** the sheet MUST render an empty-state line `"Nog geen aangesloten zorgverleners."` and MUST NOT render an empty list element
