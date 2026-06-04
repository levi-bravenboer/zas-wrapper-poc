# keto-authz Delta

## ADDED Requirements

### Requirement: Keto runs as the Access Management Engine
The platform SHALL run Ory Keto (pinned version, OPL config under `infra/ory/keto/`) as the relation-tuple store for patient-scoped authorization. Local development SHALL provide `keto` + `keto-migrate` compose services; deployed environments run Keto as a Forge app with a dedicated PG project. Keto outage or the feature flag `AUTHZ_KETO_ENABLED=false` MUST degrade to the pre-existing role-only guards (fail-closed on relation routes is NOT acceptable while the flag is off).

#### Scenario: Flag off preserves current behavior
- **WHEN** `AUTHZ_KETO_ENABLED=false`
- **THEN** all routes behave exactly as before this change (role + tenant guards only)

#### Scenario: Flag on enforces relation checks
- **WHEN** `AUTHZ_KETO_ENABLED=true` and a caregiver without any relation to patient P requests P's detail
- **THEN** the response is 403

### Requirement: Namespace model mirrors the domain
The OPL config SHALL define namespaces `Organisation` (relations: `parent`, `member` with subject-set inheritance down the tree), `CareTeam` (relation: `member`), and `Patient` (relations: `treating_org`, `care_team`, `external_carer`) with permits:
- `Patient.view` — granted to care-team members, users reachable through the treating organisation tree, and external carers.
- `Patient.view_shielded` — identical to `view` but excluding `external_carer` subjects.

#### Scenario: Care-team member can view
- **WHEN** practitioner L is a participant in a care team linked to patient P and the relation tuples are synced
- **THEN** `check(Patient:P, view, L)` is allowed

#### Scenario: Org-tree reachability grants view
- **WHEN** practitioner L holds an open role in organisation O, and O is an ancestor of patient P's treating organisation
- **THEN** `check(Patient:P, view, L)` is allowed

#### Scenario: External carer sees normal but not shielded
- **WHEN** external user G holds an `external_carer` tuple for patient P
- **THEN** `check(Patient:P, view, G)` is allowed AND `check(Patient:P, view_shielded, G)` is denied

### Requirement: require_permission dependency guards patient-scoped routes
The backend SHALL export a `require_patient_permission(relation)` dependency from `app/services/authz/` that resolves the patient id from the path, short-circuits allow for `Role.ADMIN` (tenant-wide read preserved), calls Keto `check` for other roles, and raises the existing 403 error envelope on deny. `require_patient_access` in `app/services/patient/deps.py` SHALL be the single wiring point so every guarded patient route inherits the rule. Patient list endpoints SHALL scope results using Keto relation queries (one query per request, not one check per row).

#### Scenario: Admin bypass
- **WHEN** an admin requests any patient detail in their tenant with the flag on
- **THEN** the response is 200 without a Keto check being required

#### Scenario: Single wiring point
- **WHEN** a new patient-scoped route is added using `require_patient_access`
- **THEN** it enforces the relation check with no additional authz code in the router

#### Scenario: List scoping
- **WHEN** a caregiver with relations to exactly 3 patients requests the patient list
- **THEN** only those 3 patients are returned, derived from a relation query rather than per-row checks
