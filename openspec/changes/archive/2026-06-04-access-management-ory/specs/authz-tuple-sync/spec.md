# authz-tuple-sync Delta

## ADDED Requirements

### Requirement: Postgres is the source of truth; Keto is derived
All access-relevant facts (practitioner roles, care-team participation, organisation edges, external episodes) SHALL continue to live in Postgres. Keto tuples SHALL be derivable in full from Postgres at any time; no tuple may encode a fact absent from the domain database.

#### Scenario: Full rebuild equals incremental state
- **WHEN** the reconciler derives the expected tuple set from Postgres and diffs it against Keto after a period of normal operation
- **THEN** the diff is empty

### Requirement: Transactional outbox propagates access changes
Domain mutations that affect access (open/close practitioner role, add/remove care-team participant, organisation reparent, external episode start/end) SHALL append a row to an `authz_outbox` table in the same database transaction. A relay SHALL apply pending outbox rows to Keto as tuple inserts/deletes in commit order and mark them processed. Relay failures MUST retry; outbox rows MUST NOT be lost on process crash.

#### Scenario: Participant added becomes a tuple
- **WHEN** a practitioner is added to a care team and the transaction commits
- **THEN** an outbox row exists, and after relay processing the corresponding Keto tuple exists

#### Scenario: Crash before relay does not lose the change
- **WHEN** the process crashes after commit but before the relay ran
- **THEN** the outbox row is still pending at restart and the tuple is applied then

### Requirement: Episode end revokes access immediately
Closing an external episode (event-driven or via the date sweeper for lapsed windows) SHALL delete the corresponding `external_carer` tuple through the outbox. After tuple deletion, the external user's next request touching that patient MUST be denied.

#### Scenario: Event-driven revocation
- **WHEN** an episode for external user G and patient P is closed and the relay has processed the outbox
- **THEN** G's next request for P's pathway returns 403

#### Scenario: Date-lapsed episode swept
- **WHEN** an episode's window end passes without an explicit close event
- **THEN** the sweeper closes it and the tuple is deleted via the same outbox path

### Requirement: Reconciler rebuilds and detects drift
A reconciler SHALL derive the complete expected tuple set from Postgres and converge Keto to it (insert missing, delete orphaned). It SHALL run as the initial migration (first population), on demand, and on a schedule. A non-empty drift diff outside the initial run SHALL be logged as a warning with counts per namespace.

#### Scenario: Initial population
- **WHEN** the reconciler runs against a Keto with no tuples and a seeded domain database
- **THEN** Keto afterwards contains exactly the derived tuple set

#### Scenario: Orphaned tuple removed
- **WHEN** a tuple exists in Keto with no corresponding open domain fact
- **THEN** the reconciler deletes it and logs the drift
