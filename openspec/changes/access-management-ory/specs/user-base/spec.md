# user-base Delta

## ADDED Requirements

### Requirement: Users are projections of Kratos identities
Every active `users` row SHALL carry `external_idp = 'kratos'` and `external_subject = <Kratos identity id>` after the identity import. New users created through admin flows SHALL be created in Kratos first (or atomically alongside) so the projection columns are never null for an active login-capable user. The `password_hash` column SHALL no longer be consulted by any login path; it is retained for rollback until a later cleanup change removes it.

#### Scenario: Active user has a Kratos mapping
- **WHEN** any active user row is inspected after the import
- **THEN** `external_idp = 'kratos'` and `external_subject` holds a valid Kratos identity id

#### Scenario: Login never reads password_hash
- **WHEN** a user logs in via `/auth/login/password`
- **THEN** the local `password_hash` value is not read on that code path

### Requirement: User lifecycle propagates to Kratos
Deactivating a user SHALL revoke all their Kratos sessions; reactivating SHALL NOT restore old sessions. Hard-deleting (not in PoC surface) or soft-deleting a user SHALL disable the corresponding Kratos identity so it cannot start new login flows.

#### Scenario: Deactivation disables login
- **WHEN** an admin sets `is_active = False` on a user
- **THEN** the user's existing sessions stop working and a fresh login attempt with valid credentials fails
