# authz-tuple-sync Delta

> Stacks on `access-management-ory` (archived 2026-06-04).

## ADDED Requirements

### Requirement: New entitlement sources join the derivation
Tuple derivation SHALL additionally derive from: specialism links (`practitioner_role_specialisms` → `Specialism#practitioner`), carepath links (`pathway_specialisms` / `pathway_practitioners` → `Carepath#specialism` / `Carepath#assigned`, mutually exclusive per carepath per REQ-NON-12), break-glass grants (`access_grants` → `Patient#break_glass`), and consent-gated external grants (`external_grants` ∩ active consent ∩ type profile → `Patient#external_*` verb tuples). Mutations on every new source table SHALL enqueue outbox rows via the same before_flush hook, and the reconciler SHALL cover the new namespaces in derive-all and drift detection.

#### Scenario: Carepath link change propagates
- **WHEN** an admin links carepath C to a new specialism and the relay processes
- **THEN** practitioners of that specialism pass `check(Carepath:C, view)` without a reconcile run

#### Scenario: Assigned-XOR-specialism invariant holds
- **WHEN** the reconciler derives tuples for a carepath that has explicit practitioner assignments
- **THEN** the derived set contains `assigned` tuples and no `specialism` edges for that carepath

#### Scenario: Reconciler converges new namespaces
- **WHEN** the reconciler runs twice against an unchanged domain database seeded with specialisms, grants and consents
- **THEN** the second run reports zero drift across all namespaces

### Requirement: Expiry sweep closes time-bounded grants
A periodic sweep (same in-process cadence family as the relay loop) SHALL enqueue outbox rows for objects whose time-bounded sources lapsed since the last pass: expired break-glass grants and lapsed external grant periods. Sweep failures MUST NOT skip rows permanently (next pass re-detects).

#### Scenario: Expired break-glass swept
- **WHEN** a break-glass grant's `expires_at` passes without any other mutation
- **THEN** within the sweep interval the `Patient#break_glass` tuple is deleted via the outbox path

## MODIFIED Requirements

### Requirement: Episode end revokes access immediately
Closing an external grant (consent revoked, grant period ended explicitly, or lapsed via the expiry sweep) SHALL delete the corresponding `Patient#external_*` verb tuples through the outbox. After tuple deletion, the external user's next request touching that patient MUST be denied. The legacy single `external_carer` relation is retired by the one-shot backfill into `external_grants` + consents (see `external-collaboration`); after the backfill these tuples are fully derived and reconciled — no externally-managed relation set remains for patient access.

#### Scenario: Event-driven revocation
- **WHEN** the grant for external user G and patient P is closed and the relay has processed the outbox
- **THEN** G's next request for P returns 404

#### Scenario: Date-lapsed grant swept
- **WHEN** a grant's period end passes without an explicit close event
- **THEN** the sweeper enqueues it and the verb tuples are deleted via the same outbox path

#### Scenario: Consent revocation cascades
- **WHEN** the consent backing several grants for patient P is revoked
- **THEN** all dependent verb tuples for P are deleted after relay processing
