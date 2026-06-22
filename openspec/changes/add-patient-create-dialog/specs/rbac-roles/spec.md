## MODIFIED Requirements

### Requirement: Permissions come from a code-defined catalog

The catalog of assignable permissions SHALL be defined in code (`app/core/enums/permission.py`) as `resource.action` slugs, each backed by a real route/action guard. Admins assign existing slugs to roles; they cannot invent permissions no guard enforces. The catalog SHALL include patient-onboarding permissions:

- `patient.create` — authorises creating a patient via `POST /patients`. It is an app-function permission (RBAC), distinct from `patient.accessAll` (Keto data access): holding `patient.create` does NOT by itself grant patient data access. (The create flow separately adds the creator to the new patient's care team, so the creator can see that one patient — see `patients-base`.)
- `patient.createCrossOrg` — authorises creating a patient in an organisation other than the caller's own affiliated organisation(s). Without it, a caller may only create patients in their own organisation.

Neither new permission is a crown permission.

#### Scenario: New patient permissions are present and guarded

- **WHEN** the permission catalog is enumerated
- **THEN** it MUST contain `patient.create` and `patient.createCrossOrg`
- **AND** `patient.create` MUST be enforced by a `require_permission` guard on `POST /patients`

#### Scenario: patient.create does not grant data access

- **WHEN** a caregiver holds `patient.create` but has no open care-team participant row for a patient they did NOT create (and lacks `patient.accessAll`)
- **THEN** that patient MUST be absent from the caregiver's `GET /patients` results (visibility stays governed by care-team membership / `patient.accessAll`)

### Requirement: Seeded roles bootstrap the model

The role bootstrap SHALL seed the baseline roles with permission bundles. In addition to the existing assignments, the seeded **admin** role SHALL hold both `patient.create` and `patient.createCrossOrg`. No other seeded role SHALL hold `patient.create` or `patient.createCrossOrg` by default; non-admin onboarding is enabled per tenant by an admin granting a role that holds them.

#### Scenario: Admin can create patients in any tenant organisation

- **WHEN** the seeded admin role's permissions are inspected
- **THEN** they MUST include `patient.create` and `patient.createCrossOrg`

#### Scenario: Caregiver role has no create permission by default

- **WHEN** the seeded caregiver role's permissions are inspected
- **THEN** they MUST NOT include `patient.create` and MUST NOT include `patient.createCrossOrg`
