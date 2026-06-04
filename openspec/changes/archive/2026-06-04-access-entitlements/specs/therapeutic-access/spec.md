# therapeutic-access Delta

## ADDED Requirements

### Requirement: Therapeutic relationship gates patient data access
A practitioner SHALL have access to a patient's data only through an active therapeutic relationship, defined as the union of: open care-team participation for that patient, an open practitioner role in the patient's treating-organisation chain (campus and sub-organisations included), or an active break-glass grant. The check SHALL happen on every patient-scoped request (not only at login), via the existing Keto-backed guard. Absence of any leg of the union MUST deny with the existence-hiding 404 contract. (REQ-NON-8, REQ-NON-15)

#### Scenario: No relationship denies
- **WHEN** a caregiver with no care-team participation, no role in the treating-org chain, and no break-glass grant requests a patient's detail with the flag on
- **THEN** the response is 404

#### Scenario: Relationship end revokes within the sync window
- **WHEN** the last leg of a practitioner's therapeutic relationship to a patient is closed (participation ended, role closed, or grant expired)
- **THEN** after the outbox relay processes, the practitioner's next request for that patient is 404 while their session stays valid

### Requirement: Break-glass grants temporary audited access
The platform SHALL provide a break-glass mechanism: an active caregiver in the tenant's organisation tree can request temporary access to a patient with a mandatory free-text reason and a duration capped by `authz_break_glass_max_hours` (default 4). The grant SHALL be persisted (`access_grants` row: patient, user, reason, granted_by, expires_at), emitted as a `Patient#break_glass` tuple through the outbox in the same transaction, and included in both `view` and `view_shielded` permits. Grants past `expires_at` MUST stop granting access within the sweep interval without manual action. Admins SHALL be able to list active grants. (REQ-NON-8)

#### Scenario: Break-glass with reason grants full sight
- **WHEN** a caregiver posts a break-glass request with a non-empty reason and a valid duration for patient P
- **THEN** the grant row exists, and after relay processing the caregiver can read P's detail including shielded data

#### Scenario: Missing reason is rejected
- **WHEN** a break-glass request is posted with an empty reason
- **THEN** the response is a validation error and no grant or tuple is created

#### Scenario: Expiry revokes automatically
- **WHEN** a grant's `expires_at` passes
- **THEN** the sweep enqueues the patient object, the tuple is removed, and the grantee's next request is 404

#### Scenario: Admin oversight
- **WHEN** an admin lists active access grants
- **THEN** every unexpired, unrevoked grant is returned with patient, grantee, reason, grantor and expiry
