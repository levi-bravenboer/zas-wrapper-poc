## MODIFIED Requirements

### Requirement: Audit enums are verb-only actions plus orthogonal outcome

The backend SHALL define three Postgres-backed `StrEnum`s in `app/core/enums/audit.py`: `ActorType` (`user | system | anonymous`), `AuditAction` (`created | updated | deleted | login | published`), and `AuditResult` (`success | failure`). `AuditAction` SHALL hold the operation VERB only; the noun SHALL live in the free-text `resource_type` column so auditing a new model reuses `created` / `updated` / `deleted` with no enum migration. A new verb SHALL be added ONLY for a state transition that cannot be expressed as create/update/delete (e.g. `published`, the concept→published transition), and such a verb SHALL be generic and reusable across resource types rather than resource-specific. Outcome SHALL be the orthogonal `AuditResult`, not a `login_failed` verb.

#### Scenario: Failed login recorded as login + failure

- **WHEN** a login attempt fails
- **THEN** the audit row MUST have `action = login` and `result = failure` (not a distinct failure verb)

#### Scenario: Publish recorded with the published verb

- **WHEN** a resource undergoes a publish state transition (e.g. a pathway version is published)
- **THEN** the audit row MUST have `action = published` — a generic state-transition verb usable by any publishable resource type — and the resource noun lives in `resource_type`
