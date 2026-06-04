## ADDED Requirements

### Requirement: Patient row may be referenced by `users.patient_id`

A `patients` row MAY be referenced by zero or one `users` row via the `users.patient_id` FK introduced in `user-base`. The reference SHALL NOT add credential columns to the `patients` table and SHALL NOT make the `patients` row itself authenticatable. The auth entity is the referencing `users` row, not the referenced `patients` row.

#### Scenario: Patients table still carries no credential columns after the link is added

- **WHEN** the schema is inspected after the migration applying `users.patient_id`
- **THEN** the `patients` table contains no column named `password_hash`, `auth_provider_sub`, `session_token`, `session_id`, `last_login_at`, or `mfa_*`

#### Scenario: Auth routes still never accept patient_id in their request bodies

- **WHEN** any `/auth/*` or `/mobile/auth/*` route's Pydantic request schema is inspected
- **THEN** no schema field is named `patient_id` and no schema field is typed against the Patient resource
- **AND** the only client-supplied identifier in `/mobile/auth/login/password` is `email`

#### Scenario: Soft-deleting a patient is blocked while a user references it

- **WHEN** a soft-delete or hard-delete of a `patients` row is attempted while a `users` row references it via `patient_id`
- **THEN** the database rejects the operation with a foreign-key-violation error citing the ON DELETE RESTRICT clause
- **AND** the orchestrator surface that exposes patient deletion displays a clear error directing the operator to remove the linked login first (handled by the future `mobile-patient-users-admin-ui` change; this change documents the constraint)
