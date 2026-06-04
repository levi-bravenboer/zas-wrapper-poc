# external-collaboration Specification

## Purpose
TBD - created by archiving change access-entitlements. Update Purpose after archive.
## Requirements
### Requirement: External access is verb-granular per professional type
External healthcare professionals SHALL receive access through verb relations on `Patient` (`external_reader`, `external_writer`, `external_recorder`, `external_messager`) instead of the single binary `external_carer` relation. The verbs grantable to an external SHALL be bounded by an `external_access_profiles` configuration row for their professional type (GP, physiotherapist, home nurse, …), manageable by admins. Externals MUST NOT gain `view_shielded` through any verb. (REQ-FUN-1, REQ-FUN-42)

#### Scenario: Partial verb grant
- **WHEN** external GP G holds a grant whose type profile permits read + record but not write for patient P
- **THEN** G can read P's detail and record a measurement, and a write attempt is denied 404

#### Scenario: Shielded data stays internal
- **WHEN** external user G holds every verb for patient P
- **THEN** `check(Patient:P, view_shielded, G)` is still denied

### Requirement: External grants require active patient consent
Every external grant (`external_grants` row) SHALL reference an active consent record (`consents` row: patient, scope, status). Tuple derivation SHALL emit verb tuples only while both the grant period is open and the referenced consent is active. Revoking the consent SHALL drop all dependent verb tuples through the outbox without touching the grant rows. (REQ-FUN-1, REQ-FUN-42)

#### Scenario: Consent revocation revokes access
- **WHEN** the consent backing external user G's grant for patient P is revoked and the relay has processed
- **THEN** G's next request touching P is 404 while G's session remains valid

#### Scenario: Grant without consent emits nothing
- **WHEN** an external grant row exists whose consent is not active
- **THEN** the reconciler derives no verb tuples for it

### Requirement: Existing external episodes migrate to grants
Existing `Patient#external_carer` tuples SHALL be converted by a one-shot backfill into `external_grants` + consent rows **before** the reconciler first runs with the new derivation. After the backfill, `external_carer` leaves the externally-managed relation set and is fully derived/reconciled. (Migration safety for the D4 cutover.)

#### Scenario: Backfill preserves access across the cutover
- **WHEN** the backfill and subsequent reconcile run against a database with pre-existing external episodes
- **THEN** every previously-permitted external user still passes `check(Patient, view)` afterwards

