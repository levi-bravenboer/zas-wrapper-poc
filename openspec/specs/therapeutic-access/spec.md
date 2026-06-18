# therapeutic-access Specification

## Purpose
The therapeutic relationship is the umbrella for patient-data access — open care-team participation, an open role in the treating-organisation chain, or an active break-glass grant. Break-glass provides temporary, reason-documented, time-capped emergency access that is logged as a FHIR `AuditEvent` (HL7 purposeOfUse `BTG`), with admin oversight and automatic expiry.
## Requirements
### Requirement: Therapeutic relationship gates patient data access
A practitioner SHALL have access to a patient's data only through an active therapeutic relationship, defined as the union of: open care-team participation for that patient, an open practitioner role in the patient's treating-organisation chain (campus and sub-organisations included), or an active break-glass grant. The check SHALL happen on every patient-scoped request (not only at login), via the existing Keto-backed guard. Absence of any leg of the union MUST deny with the existence-hiding 404 contract. (REQ-NON-8, REQ-NON-15)

#### Scenario: No relationship denies
- **WHEN** a caregiver with no care-team participation, no role in the treating-org chain, and no break-glass grant requests a patient's detail with the flag on
- **THEN** the response is 404

#### Scenario: Relationship end revokes within the sync window
- **WHEN** the last leg of a practitioner's therapeutic relationship to a patient is closed (participation ended, role closed, or grant expired)
- **THEN** after the outbox relay processes, the practitioner's next request for that patient is 404 while their session stays valid

### Requirement: Break-glass grants temporary audited access
The platform SHALL provide a break-glass mechanism: an active caregiver in the tenant's organisation tree can request temporary access to a patient with a mandatory free-text reason, a coded purpose-of-use (HL7 PurposeOfUse — default `BTG` break-the-glass, `ETREAT` emergency-treatment), and a duration capped by `authz_break_glass_max_hours` (default 4). The grant SHALL be persisted (`access_grants` row: patient, user, reason, purpose_of_use, granted_by, expires_at), emitted as a `Patient#break_glass` tuple through the outbox in the same transaction, and included in both `view` and `view_shielded` permits. Grants past `expires_at` MUST stop granting access within the sweep interval without manual action. Admins SHALL be able to list active grants. (REQ-NON-8)

> **Integration status:** the mandatory reason, duration cap, outbox-emitted tuple, expiry sweep and admin listing ship today. The coded `purpose_of_use` column is a FHIR-alignment addition not yet in the `access_grants` model — until it lands the grant carries the free-text reason only and `BTG` is the implicit purpose.

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

### Requirement: Break-glass activity is recorded as a FHIR AuditEvent
Break-glass is an emergency override of the normal therapeutic-relationship gate, so it SHALL leave a complete, queryable audit trail rather than only a stdout log line. Creating a grant SHALL emit a structured `AuditEvent` through the audit service (actor = grantee, resource = the patient/grant, reason and purpose-of-use carried, result = success). Every patient access subsequently served under a `Patient#break_glass` tuple SHALL likewise be recorded as a break-glass access event, attributable to the grantee with the patient as subject. (REQ-NON-8)

> **Integration status:** the audit service and `audit_events` model ship and are the intended sink, but `break_glass_service.create_grant` does not yet emit an `AuditEvent` (the grant row + a `require_patient_access` log line are the current trail). Per-access logging additionally needs an `accessed` / `read` verb — `AuditAction` today is `created` / `updated` / `deleted` / `login` — so the access-event hook and that verb are the pending part of this requirement.

#### Scenario: Grant creation writes an audit event
- **WHEN** a caregiver creates a break-glass grant for patient P with a reason
- **THEN** an `AuditEvent` is recorded attributing the grant to the grantee, naming P, and carrying the reason and purpose-of-use

#### Scenario: Break-glass read is attributable
- **WHEN** the grantee reads P's detail while the `break_glass` tuple is active
- **THEN** the access is recorded as a break-glass access event attributable to the grantee with P as subject

