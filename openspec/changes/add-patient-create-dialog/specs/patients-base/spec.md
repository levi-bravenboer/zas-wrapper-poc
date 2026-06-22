## ADDED Requirements

### Requirement: Caller can read their own organisations for patient creation

The backend SHALL expose `GET /me/organisations` returning the organisations the authenticated caller is currently affiliated with (organisations referenced by the caller's open `practitioner_roles` rows), scoped to the caller's tenant. The route SHALL require an authenticated user only (no extra RBAC permission), since it returns only the caller's own affiliations. The create-patient dialog SHALL use this route to populate the organisation selector when the caller holds `patient.create` but not `patient.createCrossOrg`.

#### Scenario: Returns only the caller's affiliated organisations

- **WHEN** an authenticated caller requests `GET /me/organisations`
- **THEN** the response MUST contain exactly the in-tenant organisations referenced by the caller's open `practitioner_roles` rows, and no others

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated request calls `GET /me/organisations`
- **THEN** the API MUST respond `401 Unauthorized`

## MODIFIED Requirements

### Requirement: Patients API exposes tenant-scoped CRUD for authenticated caregivers and admins

The backend SHALL expose under `/patients` exactly these routes: `GET /patients` (list), `GET /patients/{id}` (read), `POST /patients` (create), `PATCH /patients/{id}` (update demographics), `DELETE /patients/{id}` (soft delete). All routes SHALL require an authenticated user and SHALL be tenant-scoped via the session actor's `tenant_id`. Cross-tenant reads SHALL return `404`, never `403`.

`POST /patients` SHALL additionally require the `patient.create` permission via `Depends(require_permission(Permission.PATIENT_CREATE))`. The request body `primary_organisation_id` SHALL be optional; the service SHALL resolve and authorise the target organisation as follows:

- A caller holding `patient.createCrossOrg` MAY set `primary_organisation_id` to any organisation in their tenant (cross-tenant orgs are rejected).
- A caller NOT holding `patient.createCrossOrg` MAY only create a patient in one of their own affiliated organisations (open `practitioner_roles` rows). If `primary_organisation_id` is omitted and the caller has exactly one own organisation, the service SHALL use it. If the caller passes an organisation that is not one of their own, the API MUST respond `403`.

On successful create, the service SHALL make the creating actor an open participant on the patient's care team (via `CareTeamService.ensure_membership`): it SHALL reuse the patient's active care team or create a default team when none exists, and add the actor as an open participant. This guarantees the creator can see the patient they created under the existing care-team visibility rules.

The visibility rules for `GET` routes are otherwise unchanged. Every route handler that applies an auth guard SHALL carry an `# AUTH-HARDEN` source comment.

#### Scenario: Creator becomes a care-team participant

- **WHEN** a caller successfully creates a patient via `POST /patients`
- **THEN** the caller MUST have an open `care_team_participants` row on an active care team for that patient
- **AND** a subsequent `GET /patients` by that caller MUST include the new patient

#### Scenario: Create requires the patient.create permission

- **WHEN** an authenticated caller without `patient.create` issues `POST /patients`
- **THEN** the API MUST respond `403 Forbidden` and MUST NOT create a patient

#### Scenario: Own-organisation create defaults the organisation

- **WHEN** a caller holding `patient.create` (but not `patient.createCrossOrg`) issues `POST /patients` omitting `primary_organisation_id`, and the caller has exactly one open organisation affiliation
- **THEN** the patient MUST be created with `primary_organisation_id` set to that organisation

#### Scenario: Cross-organisation create requires the cross-org permission

- **WHEN** a caller WITHOUT `patient.createCrossOrg` issues `POST /patients` with a `primary_organisation_id` that is not one of their own affiliated organisations
- **THEN** the API MUST respond `403 Forbidden`

#### Scenario: Cross-org holder may target any tenant organisation

- **WHEN** a caller holding `patient.createCrossOrg` issues `POST /patients` with a `primary_organisation_id` belonging to a different in-tenant organisation
- **THEN** the patient MUST be created in that organisation

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated request calls any `/patients` route
- **THEN** the API MUST respond `401 Unauthorized`

### Requirement: Orchestrator exposes a patients overview screen built on `DataTable<T>`

The orchestrator SHALL ship `/_auth/patients` as the canonical caregiver/admin patients overview, satisfying PoC feature `F4` (Patients overview). The page SHALL compose `<FilterableListPage<PatientRead>>` around `<DataTable<PatientRead>>`. Row click SHALL navigate `/_auth/patients/$patientId`, which renders the real `<PatientProfilePage>`.

The overview SHALL render a "Create patient" affordance in the `FilterableListPage` `primaryAction` slot **only when** the session holds `patient.create` (`useCan('patient.create')`). Activating it SHALL open a create-patient dialog. The dialog SHALL collect `given_name`, `family_name`, `gender` (required) and `birth_date` (optional), mirroring the edit-patient dialog.

The dialog SHALL decide the organisation field as follows:

- Caller holds `patient.createCrossOrg`: show an organisation selector populated from `GET /organisations` (any in-tenant org).
- Caller lacks `patient.createCrossOrg` and has more than one own organisation (`GET /me/organisations`): show an organisation selector limited to those own organisations.
- Caller lacks `patient.createCrossOrg` and has exactly one own organisation: omit the selector; the patient is created in that organisation (server-resolved, body omits `primary_organisation_id`).

On success the dialog SHALL invalidate the patients list and close.

Column shape, filter set, default sort, search, kebab actions, realtime topic, and state persistence are otherwise unchanged.

#### Scenario: Create button hidden without permission

- **WHEN** a user without `patient.create` opens `/_auth/patients`
- **THEN** the overview MUST NOT render the "Create patient" button

#### Scenario: Create button opens the dialog

- **WHEN** a user with `patient.create` clicks "Create patient"
- **THEN** the create-patient dialog MUST open with `given_name`, `family_name`, `gender`, and `birth_date` fields

#### Scenario: Cross-org holder sees a tenant-wide organisation selector

- **WHEN** a user holding `patient.createCrossOrg` opens the create dialog
- **THEN** the dialog MUST show an organisation selector populated from `GET /organisations`

#### Scenario: Single-own-org caller sees no selector

- **WHEN** a user with `patient.create`, without `patient.createCrossOrg`, who has exactly one own organisation opens the create dialog
- **THEN** the dialog MUST NOT show an organisation selector

#### Scenario: Multi-own-org caller sees an own-org selector

- **WHEN** a user with `patient.create`, without `patient.createCrossOrg`, who has more than one own organisation opens the create dialog
- **THEN** the dialog MUST show an organisation selector limited to the caller's own organisations (`GET /me/organisations`)

#### Scenario: Successful create refreshes the list

- **WHEN** the create-patient form is submitted successfully
- **THEN** the dialog MUST close and the patients list MUST refetch
