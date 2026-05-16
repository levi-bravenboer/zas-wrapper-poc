## MODIFIED Requirements

### Requirement: Care teams API exposes per-patient lifecycle endpoints

The backend SHALL expose the following routes, all guarded by `require_role(Role.ADMIN, Role.CAREGIVER)` and `require_patient_access(patient_id)` where the patient is in scope:

- `GET /patients/{patient_id}/care-teams` — list current + historical teams for a patient, with embedded participant rows
- `POST /patients/{patient_id}/care-teams` — create a new team; optionally pass initial participants
- `PATCH /care-teams/{id}` — update `name`, `category`, `status`, or close the team via `period_end`
- `POST /care-teams/{id}/participants` — add a participant (open row)
- `PATCH /care-teams/{id}/participants/{user_id}` — change `role_in_care` via close-and-reopen
- `DELETE /care-teams/{id}/participants/{user_id}` — close current open row

Every route handler that applies an auth guard SHALL carry an `# AUTH-HARDEN` source comment.

#### Scenario: List embeds participants with acting_as PractitionerRole

- **WHEN** a caregiver calls `GET /patients/{id}/care-teams` for a patient they can access
- **THEN** each team in the response MUST include a `participants` array with `{user_id, role_in_care, period_start, period_end, acting_as_practitioner_role_id}` for every row (open + closed), and MUST NOT include the legacy field `on_behalf_of_organisation_id`

#### Scenario: Cross-tenant patient returns 404

- **WHEN** any of the patient-scoped routes is called with a `patient_id` belonging to a different tenant
- **THEN** the API MUST respond `404 Not Found`

#### Scenario: AUTH-HARDEN markers present

- **WHEN** the source of `app/api/routers/care_team/care_team_router.py` is inspected
- **THEN** every route handler that applies a role or patient-access guard MUST carry an `# AUTH-HARDEN` comment

#### Scenario: Add-participant accepts NULL acting_as

- **WHEN** the body of `POST /care-teams/{id}/participants` sets `acting_as_practitioner_role_id = null`
- **THEN** the response MUST be `201 Created` and the row MUST persist with `acting_as_practitioner_role_id = NULL`
