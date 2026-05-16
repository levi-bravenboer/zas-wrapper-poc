## ADDED Requirements

### Requirement: Caregiver patient visibility is the union of care-team membership and PractitionerRole tree access

The backend SHALL restrict caregiver patient visibility (both `PatientService.list_in_tenant` and the `require_patient_access(patient_id)` dependency) to patients matching at least one of the following predicates, evaluated within the caller's `tenant_id`:

1. **Care-team predicate** — there exists an open `CareTeamParticipant` row for the caregiver on a `CareTeam` belonging to the patient, OR
2. **PractitionerRole predicate** — there exists at least one organisation root `R ∈ practitioner_root_orgs_for(caregiver)` such that `root(patient.primary_organisation_id) == R`.

Admin users SHALL bypass both predicates (tenant scope still enforced). Cross-tenant rows SHALL return `404`, never `403`. The predicate SHALL produce results strictly more permissive than the pre-split single-FK lookup against `users.organisation_id`: a caregiver with one open primary role at the same organisation as their pre-split `users.organisation_id` MUST see exactly the same patient set as before; a caregiver with multiple open roles MUST see the union of their roots' subtrees.

#### Scenario: Caregiver sees patients via open care-team membership

- **WHEN** caregiver `C` has an open `CareTeamParticipant` row on the care team of patient `P`, and `C` has no open `PractitionerRole` at the root of `P.primary_organisation_id`
- **THEN** `GET /patients/{P.id}` for `C` MUST return `200` and `GET /patients` MUST include `P`

#### Scenario: Caregiver sees patients via PractitionerRole tree access

- **WHEN** caregiver `C` has at least one open `PractitionerRole` whose organisation root equals the root of `P.primary_organisation_id`, and `C` is not on any care team for `P`
- **THEN** `GET /patients/{P.id}` for `C` MUST return `200` and `GET /patients` MUST include `P`

#### Scenario: Caregiver outside both predicates gets 404

- **WHEN** caregiver `C` is not on any care team for patient `P` and has no open `PractitionerRole` whose root matches `P.primary_organisation_id`'s root
- **THEN** `GET /patients/{P.id}` for `C` MUST return `404`

#### Scenario: Single-role caregiver post-migration sees identical patient set

- **WHEN** caregiver `C` is migrated by `practitioner-role-split` from a pre-split state with `users.organisation_id = O` into a single open primary `PractitionerRole` at `O`
- **THEN** `GET /patients` for `C` MUST return the same set of patient ids it returned pre-migration (no regression for single-affiliation caregivers)

#### Scenario: Multi-role caregiver sees union of roots

- **WHEN** caregiver `C` has two open `PractitionerRole` rows at organisations under different roots `R1` and `R2`, both within the same tenant
- **THEN** `GET /patients` for `C` MUST include patients whose `primary_organisation_id` resolves to either `R1` or `R2`

#### Scenario: Admin bypass unchanged

- **WHEN** an admin user with no `PractitionerRole` rows calls `GET /patients`
- **THEN** the response MUST contain every patient in the admin's tenant (the new predicate MUST NOT apply to admins)
