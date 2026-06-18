## MODIFIED Requirements

### Requirement: Keto check guards patient-scoped routes
The backend SHALL export `check_patient_permission(relation)` from `app/services/access/permissions/` answering one Keto `check` per patient-scoped request. `require_patient_access` in `app/services/patient/deps.py` SHALL be the single wiring point so every guarded patient route inherits the rule, with a caller holding the `patient.accessAll` permission short-circuiting to allow (tenant-wide read preserved). The bypass is no longer keyed on the `Role.ADMIN` enum value — that enum is removed by the `rbac-roles` change — but on the permission, which the seeded `admin` role holds. Denials MUST surface as 404 (the codebase's existence-hiding contract), not 403.

Patient **list** endpoints SHALL keep deriving their visible set in SQL from the same domain facts the tuples are derived from (care-team participation, practitioner-role org roots) — Keto's read API walks direct tuples only, so set-derivation stays in Postgres; per-object checks go to Keto. The reconciler guarantees the two views agree.

#### Scenario: Bypass via permission
- **WHEN** a caller holding `patient.accessAll` requests any patient detail in their tenant with the flag on
- **THEN** the response is 200 without a Keto check being required

#### Scenario: Single wiring point
- **WHEN** a new patient-scoped route is added using `require_patient_access`
- **THEN** it enforces the relation check with no additional authz code in the router

#### Scenario: Denial hides existence
- **WHEN** a caregiver without any relation to patient P (and without `patient.accessAll`) requests P's detail with the flag on
- **THEN** the response is 404 with the patient-not-found envelope

#### Scenario: List scoping agrees with checks
- **WHEN** a caregiver with relations to exactly 3 patients requests the patient list and then each detail
- **THEN** exactly those 3 patients are listed (SQL-derived) and each detail check (Keto) allows
