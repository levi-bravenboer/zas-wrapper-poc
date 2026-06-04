# carepath-access Specification

## Purpose
TBD - created by archiving change access-entitlements. Update Purpose after archive.
## Requirements
### Requirement: Specialisms are structured master data
The platform SHALL maintain a `specialisms` master table (code, display, source) and link practitioner roles to specialisms via a many-to-many `practitioner_role_specialisms` table (FHIR `PractitionerRole.specialty`, 0..*). A practitioner role MAY carry multiple specialisms. The legacy free-text `practitioner_roles.specialty` column SHALL be backfilled into the link table and no longer consulted for authorization. Specialism links SHALL be manageable by admins. (REQ-FUN-26, REQ-FUN-28)

#### Scenario: Multiple specialisms per affiliation
- **WHEN** an admin links a practitioner role to both `surgery` and `orthopedics`
- **THEN** both links persist and both contribute to the practitioner's carepath access

#### Scenario: Backfill preserves existing data
- **WHEN** the migration runs against a database with free-text specialty values
- **THEN** each distinct value exists in `specialisms` and each role carries the corresponding link

### Requirement: Carepath access scoped by specialism with explicit-assignment override
Carepaths (pathway definitions) SHALL link to one or more specialisms (`pathway_specialisms`), and MAY additionally name specific practitioners (`pathway_practitioners`). Access derivation SHALL implement REQ-NON-12's rule: when explicit practitioner assignments exist for a carepath, only those practitioners receive access tuples; when none exist, all practitioners holding an open role with a linked specialism receive access via the `Specialism` namespace. The two emission modes are mutually exclusive per carepath. (REQ-NON-10, REQ-NON-12)

#### Scenario: Specialism membership grants access
- **WHEN** carepath C is linked to specialism S with no explicit assignments, and practitioner L holds an open role linked to S
- **THEN** `check(Carepath:C, view, L)` is allowed

#### Scenario: Wrong specialism denies
- **WHEN** practitioner M holds open roles linked only to specialisms not linked to carepath C
- **THEN** `check(Carepath:C, view, M)` is denied and the carepath detail route returns 404 with the flag on

#### Scenario: Explicit assignment narrows the specialism set
- **WHEN** carepath C is linked to specialism S and practitioner L (of S) is explicitly assigned, while practitioner N (also of S) is not
- **THEN** L's check is allowed and N's check is denied

### Requirement: Carepath routes enforce the scoping through one wiring point
The backend SHALL export `require_carepath_access` from `app/services/access/permissions/`, applied to carepath detail and mutation routes. `Role.ADMIN` SHALL short-circuit to allow. With `AUTHZ_KETO_ENABLED=false` the guard MUST no-op (pre-existing behavior). Denial MUST surface as 404. Carepath **list** endpoints SHALL derive the visible set in SQL from the same domain facts (specialism links, explicit assignments), consistent with the patient-list pattern. (REQ-NON-10)

#### Scenario: Flag off preserves behavior
- **WHEN** `AUTHZ_KETO_ENABLED=false` and any caregiver requests any carepath
- **THEN** the response is identical to pre-change behavior

#### Scenario: List and detail agree
- **WHEN** a caregiver whose specialisms grant access to exactly 2 carepaths lists carepaths and then requests each detail
- **THEN** exactly those 2 are listed and each detail check allows

