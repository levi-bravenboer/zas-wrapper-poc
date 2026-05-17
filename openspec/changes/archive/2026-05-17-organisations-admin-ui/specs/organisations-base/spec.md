## MODIFIED Requirements

### Requirement: Organisations API exposes tenant-scoped read-only tree

The backend SHALL expose `GET /organisations` returning a flat list of all non-soft-deleted `organisations` rows in the caller's tenant, each carrying `parent_organisation_id` so the client can materialise the tree. The endpoint SHALL require an authenticated `admin` or `caregiver` user. Admin-only write endpoints (`POST /organisations`, `PATCH /organisations/{id}`, `DELETE /organisations/{id}`) MAY be added by downstream capabilities (specifically `organisations-admin-ui`); they are scoped to `Role.ADMIN` and carry their own `# AUTH-HARDEN` markers.

#### Scenario: List returns full tenant tree

- **WHEN** a caregiver in tenant T calls `GET /organisations`
- **THEN** the response MUST contain every non-soft-deleted organisation row whose `tenant_id == T` and MUST NOT contain any row whose `tenant_id != T`

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated request hits `GET /organisations`
- **THEN** the API MUST respond `401 Unauthorized`

#### Scenario: Caregivers cannot reach write endpoints

- **WHEN** a caregiver attempts `POST /organisations`, `PATCH /organisations/{id}`, or `DELETE /organisations/{id}`
- **THEN** the API MUST respond `403 Forbidden` with `ErrorResponse{ code: "forbidden.auth.role" }`
