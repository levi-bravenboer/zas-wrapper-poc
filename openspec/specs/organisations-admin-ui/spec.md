# organisations-admin-ui Specification

## Purpose
TBD - created by archiving change organisations-admin-ui. Update Purpose after archive.
## Requirements
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

The orchestrator SHALL render at `/_auth/admin/organisations` an
`<OrganisationsAdminPage>` that wraps `<OrganisationTree>` inside
`<FilterableListPage>` (using the scaffolding's `table` slot for the
tree). The tree SHALL materialise the flat `GET /organisations` response
into a recursive `parent → children` structure ordered by `sort_index`
(falling back to `name` for ties), support expand/collapse with state
persisted in the URL, and render per-node kebab actions:

- `Nieuwe sub-organisatie` — opens `<CreateOrganisationDialog>` with
  `parent_organisation_id` prefilled.
- `Bewerken` — opens `<EditOrganisationDialog>`.
- `Archiveren` — destructive confirm; calls `DELETE /organisations/{id}`
  and surfaces a `conflict.organisation.in_use` error with a
  human-readable list of blocking references.

The page primary CTA SHALL be `Nieuwe root` opening
`<CreateOrganisationDialog>` with `parent_organisation_id = null`.
Clicking a node body (not the kebab) SHALL open
`<OrganisationDetailSheet>` on the right side, listing demographics and
Practitioners affiliated through open PractitionerRole rows.

The page header SHALL include a `Bewerk volgorde` toggle that switches
the tree into an edit mode (see "Admin can re-shape the organisation
tree…"). The kebab and primary CTAs above SHALL remain available only in
read-only mode; edit mode SHALL suppress per-row kebabs and disable the
create CTA until edits are saved or cancelled.

#### Scenario: Tree renders nested hierarchy

- **WHEN** the admin loads the page in a tenant with one root and two
  children
- **THEN** the page MUST render one top-level node containing two nested
  nodes, with each node showing name + type chip, ordered by
  `sort_index`

#### Scenario: Archiving an in-use org surfaces the precise blocker

- **WHEN** the admin archives an organisation that still has open
  PractitionerRole rows
- **THEN** the destructive-confirm result MUST surface copy that
  includes "Praktijkrol" (or English equivalent), derived from
  `ErrorResponse.details.references`, and the row MUST remain in the
  tree

#### Scenario: Caregiver session redirected from admin page

- **WHEN** a caregiver navigates to `/_auth/admin/organisations`
- **THEN** the admin route-group layout MUST redirect to `/_auth/` before
  the page mounts

#### Scenario: Toggling edit mode hides per-row kebabs

- **WHEN** the admin clicks `Bewerk volgorde` on the read-only tree
- **THEN** every node's kebab menu MUST be removed from the DOM and the
  page's primary `Nieuwe root` CTA MUST be disabled until the admin
  exits edit mode

### Requirement: Detail sheet surfaces affiliated practitioners

The orchestrator's `<OrganisationDetailSheet>` SHALL fetch open `PractitionerRole` rows via `GET /practitioner-roles?organisation_id={id}&is_open=true` and render them as a compact list (Practitioner display name + role code badge). Each entry MAY link out to `/_auth/admin/practitioner-roles?practitioner_id=<…>` (placeholder until `practitioner-roles-admin-ui` ships).

#### Scenario: Sheet shows zero state when no affiliated practitioners

- **WHEN** an organisation has zero open PractitionerRole rows
- **THEN** the sheet MUST render an empty-state line `"Nog geen aangesloten zorgverleners."` and MUST NOT render an empty list element

### Requirement: Admin can re-shape the organisation tree via drag-and-drop with batched save

The orchestrator SHALL expose an edit mode on the organisations admin
page that lets an admin reparent and reorder organisations via drag and
drop. The edit mode SHALL stage changes locally (without hitting the
network per move) and SHALL commit them through a single
`PATCH /admin/organisations/tree` call on Save.

The DnD implementation SHALL be built on `@dnd-kit/core` +
`@dnd-kit/sortable` + `@dnd-kit/modifiers`. The tree SHALL be rendered
as a flat list with depth projected from horizontal drag offset, and a
visible drop indicator SHALL show the projected parent + insert slot
before drop. Sensors SHALL include PointerSensor and KeyboardSensor so
that the editor is fully keyboard-operable. The tree SHALL keep ARIA
tree semantics (`role="tree"`, `role="treeitem"`, `aria-level`,
`aria-expanded`).

The editor SHALL announce its current edit state through a sticky bottom
bar reusing the visual + interaction pattern of
`apps/orchestrator/src/components/data-table/BulkBar.tsx`. The bar SHALL
show the count of staged moves, a `Annuleren` button, and a
`Wijzigingen opslaan` button. Save SHALL be disabled when there are no
staged changes and when the staged count exceeds the backend cap of
`500`.

Optimistic rendering SHALL apply staged moves immediately so the tree
reflects the admin's intent during the session; on Save success the
server response SHALL re-seed the cache; on Save failure the bar SHALL
remain visible with the failure surfaced as a toast that includes
`ErrorResponse.code` (e.g. `organisation_tree_cycle`).

#### Scenario: Drag reparents and updates staged-count

- **WHEN** the admin drags a node onto another node in edit mode
- **THEN** the dropped node MUST render under the new parent in the
  tree, and the sticky save bar MUST show `1 wijziging` (or localised
  plural)

#### Scenario: Save commits all staged moves atomically

- **WHEN** the admin has staged three moves and clicks
  `Wijzigingen opslaan`
- **THEN** the orchestrator MUST issue exactly one
  `PATCH /admin/organisations/tree` request whose `moves` array contains
  exactly those three moves; on `200` the bar MUST disappear and the
  tree MUST reflect the server response

#### Scenario: Cycle error keeps the editor open

- **WHEN** the backend rejects the save with
  `ErrorResponse{ code: "organisation_tree_cycle" }`
- **THEN** the edit mode MUST remain active, the staged moves MUST stay
  in `pendingMoves`, and a toast MUST surface the localised cycle error

#### Scenario: Keyboard DnD moves a node

- **WHEN** the admin focuses a row's drag handle, presses `Space` to
  pick up, presses `ArrowDown` then `Space` to drop
- **THEN** the dropped node MUST render at the new position and the
  save bar MUST update its staged-count

### Requirement: Cancel from a dirty edit confirms before discarding

The edit mode SHALL guard against accidental loss of staged moves. When
the admin clicks `Annuleren` (or attempts to navigate away from the
page) while `pendingMoves` is non-empty, an `AlertDialog` SHALL ask the
admin to confirm discarding their changes. Confirming SHALL clear
`pendingMoves`, exit edit mode, and re-seed the tree from the latest
server response. Cancelling the confirm SHALL keep the editor open and
preserve `pendingMoves`.

When `pendingMoves` is empty, `Annuleren` SHALL exit edit mode without a
confirm dialog.

#### Scenario: Cancel with dirty edits opens confirm dialog

- **WHEN** the admin has staged at least one move and clicks
  `Annuleren`
- **THEN** an `AlertDialog` MUST appear with copy referring to discarding
  changes, and edit mode MUST remain active until the admin chooses an
  option

#### Scenario: Confirm discard clears staged moves

- **WHEN** the admin confirms the discard dialog
- **THEN** `pendingMoves` MUST be empty, the edit mode MUST be closed,
  and the tree MUST render the latest server-side state

#### Scenario: Cancel with no staged moves exits without dialog

- **WHEN** the admin clicks `Annuleren` while `pendingMoves` is empty
- **THEN** no dialog MUST appear and the edit mode MUST close
  immediately

### Requirement: Create dialog uses searchable type and parent pickers

`<CreateOrganisationDialog>` SHALL present three controls in a stacked
single-column layout:

- `Naam` — text input, autofocus.
- `Type` — searchable combobox (shadcn `Command` inside `Popover`) whose
  options are the `OrganisationTypeCode` values; the option list SHALL
  show `type_display` as the label and `type_code` as the secondary
  text.
- `Bovenliggende organisatie` — searchable combobox listing every
  in-tenant organisation. The list SHALL render each option with an
  indent prefix proportional to its depth so the tree shape is visible
  inside the picker. A `Geen (root)` option SHALL appear first.

The dialog SHALL continue to submit to `POST /organisations`. The dialog
SHALL surface validation errors inline and remain open on failure.

#### Scenario: Type combobox filters as admin types

- **WHEN** the admin types `dep` into the type combobox
- **THEN** the option list MUST show the `dept` option and MUST hide
  unrelated options

#### Scenario: Parent combobox shows indented tree

- **WHEN** the admin opens the parent combobox in a tenant containing
  one root with one child and one grandchild
- **THEN** the option list MUST contain `Geen (root)` first and the
  three organisations rendered with depth-proportional indent so the
  hierarchy is recognisable

#### Scenario: Submit creates the organisation and closes

- **WHEN** the admin fills name, picks a type, picks a parent, and
  clicks `Aanmaken`
- **THEN** the orchestrator MUST `POST /organisations` with the
  selected values, close the dialog on `201`, refresh the tree, and
  toast a success message

### Requirement: Detail sheet uses a sectioned hero layout

`<OrganisationDetailSheet>` SHALL present:

- A header section with the organisation name (`text-2xl`,
  `font-semibold`), the type badge, and — when present — a
  `Sub-organisatie van: {parent name}` link that closes the current
  sheet and opens the parent's sheet.
- A scrollable body composed of stacked shadcn `Card` sections, each
  preceded by a `Separator`:
  - `Basisgegevens` — name, type, parent, audit (created/updated by +
    timestamp).
  - `Sub-organisaties` — count and a list of immediate children (each a
    link that opens that child's sheet).
  - `Aangesloten zorgverleners` — practitioner-role affiliations
    (existing behaviour).

Each Card SHALL render a centred empty-state line when it has no data,
using existing entity-page chrome conventions.

#### Scenario: Header links to parent organisation

- **WHEN** the admin opens the detail sheet for an organisation whose
  `parent_organisation_id` is non-null
- **THEN** the header MUST render a `Sub-organisatie van: {parent name}`
  link, and clicking it MUST close the current sheet and open the
  parent's sheet

#### Scenario: Children card lists immediate sub-organisations

- **WHEN** the admin opens the detail sheet for an organisation with
  two immediate children
- **THEN** the `Sub-organisaties` card MUST render a count of `2` and a
  list with one row per child, each row being a link to that child's
  sheet

#### Scenario: Children card empty state

- **WHEN** the admin opens the detail sheet for an organisation with
  zero children
- **THEN** the `Sub-organisaties` card MUST render the centred
  empty-state copy without an empty list element

