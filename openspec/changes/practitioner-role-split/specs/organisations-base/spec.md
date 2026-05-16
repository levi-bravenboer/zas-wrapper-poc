## ADDED Requirements

### Requirement: Practitioner root-organisation predicate consumes open PractitionerRole rows

The backend SHALL provide a helper `practitioner_root_orgs_for(user) -> set[UUID]` returning, for a given caregiver `User`, the set of organisation-tree root UUIDs reachable via **any** open `PractitionerRole` rows belonging to that user's `Practitioner`. The helper SHALL be implemented under `app/services/practitioner_role/predicates.py` (or re-exported from `app/services/organisation/predicates.py`) and SHALL resolve each role's `organisation_id` to its root through the existing `OrganisationRepository.get_root_ancestor` recursive CTE. The pure `is_external_for_root(user_root_org_id, patient_root_org_id)` helper (introduced by `organisations-base`) is unchanged in signature and semantics; what changes is **how callers obtain `user_root_org_id`**: pre-split they read `user.organisation_id`; post-split they enumerate the set returned by `practitioner_root_orgs_for(user)` and OR across it.

If a caregiver has no open `PractitionerRole`, the helper SHALL return the empty set; callers SHALL treat that as "no external-tree access" without raising.

#### Scenario: Single open role returns single root

- **WHEN** `practitioner_root_orgs_for(user)` is called for a caregiver with one open `PractitionerRole` at organisation `O` whose root is `R`
- **THEN** the result MUST equal `{R}`

#### Scenario: Multiple open roles return the union of roots

- **WHEN** `practitioner_root_orgs_for(user)` is called for a caregiver with two open `PractitionerRole` rows at organisations under different roots `R1` and `R2`
- **THEN** the result MUST equal `{R1, R2}`

#### Scenario: Caregiver with no open role returns empty set

- **WHEN** `practitioner_root_orgs_for(user)` is called for a caregiver whose Practitioner has zero rows in `practitioner_roles` with `period_end IS NULL`
- **THEN** the result MUST equal `set()` and the call MUST NOT raise

#### Scenario: Closed roles are excluded

- **WHEN** `practitioner_root_orgs_for(user)` is called for a caregiver whose only `PractitionerRole` row has `period_end < now()`
- **THEN** the result MUST equal `set()`
