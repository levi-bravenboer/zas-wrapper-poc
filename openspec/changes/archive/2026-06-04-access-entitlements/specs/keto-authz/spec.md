# keto-authz Delta

> Stacks on `access-management-ory` (archived 2026-06-04).

## MODIFIED Requirements

### Requirement: Namespace model mirrors the domain
The OPL config SHALL define namespaces `Organisation` (relations: `parent`, `member` with subject-set inheritance down the tree), `CareTeam` (relation: `member`), `Specialism` (relation: `practitioner`), `Carepath` (relations: `specialism`, `assigned`, `owner_org`), and `Patient` (relations: `treating_org`, `care_team`, `break_glass`, `external_reader`, `external_writer`, `external_recorder`, `external_messager`) with permits:
- `Patient.view_shielded` — care-team members, users reachable through the treating organisation tree, and break-glass grantees.
- `Patient.view` — `view_shielded` plus `external_reader` subjects.
- `Patient.edit` — care-team members, break-glass grantees, and `external_writer` subjects.
- `Patient.record` — `edit` plus `external_recorder` subjects.
- `Patient.message` — `view` plus `external_messager` subjects.
- `Carepath.view` — explicitly assigned practitioners, practitioners of linked specialisms, and users covered by `owner_org`'s view.

Campus scoping (REQ-NON-15) SHALL be realised through the existing `Organisation.parent` chain — campuses are organisation rows under the tenant root — with no separate mechanism. Conditional emission rules (e.g. assigned-XOR-specialism for carepaths) live in derivation, never in permits; OPL stays pure set algebra.

#### Scenario: Care-team member can view
- **WHEN** practitioner L is a participant in a care team linked to patient P and the relation tuples are synced
- **THEN** `check(Patient:P, view, L)` is allowed

#### Scenario: Org-tree reachability grants view
- **WHEN** practitioner L holds an open role in organisation O, and O is an ancestor of patient P's treating organisation
- **THEN** `check(Patient:P, view, L)` is allowed

#### Scenario: Campus-level role covers the campus subtree
- **WHEN** practitioner L holds an open role at a campus organisation and patient P's treating organisation is a descendant of that campus
- **THEN** `check(Patient:P, view_shielded, L)` is allowed

#### Scenario: External reader sees normal but not shielded
- **WHEN** external user G holds an `external_reader` tuple for patient P
- **THEN** `check(Patient:P, view, G)` is allowed AND `check(Patient:P, view_shielded, G)` is denied

#### Scenario: Break-glass grants shielded sight
- **WHEN** user B holds a `break_glass` tuple for patient P
- **THEN** `check(Patient:P, view_shielded, B)` and `check(Patient:P, edit, B)` are allowed

#### Scenario: Verb separation enforced
- **WHEN** external user G holds only `external_reader` for patient P
- **THEN** `check(Patient:P, edit, G)` and `check(Patient:P, record, G)` are denied
