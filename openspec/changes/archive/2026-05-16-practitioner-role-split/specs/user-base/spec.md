## REMOVED Requirements

### Requirement: Users carry a mandatory organisation affiliation

**Reason**: `user-base` collapsed authentication identity and clinical affiliation into a single `users.organisation_id` FK. This conflicts with FHIR R4, which separates `Practitioner` (the person) from `PractitionerRole` (their period-bounded M:N affiliations with `Organization`). The single-FK shape cannot express simultaneous affiliations (e.g. a freelance GP at two clinics), affiliation history, or per-affiliation `code`/`specialty`. The new `practitioner-role-split` capability lifts the data into `practitioners` + `practitioner_roles`, leaving `users` strictly an authentication-identity table.

**Migration**: The Alembic revision under `practitioner-role-split` (1) materialises one `Practitioner` + one open primary `PractitionerRole` row per caregiver `User` from the user's existing `organisation_id`, then (2) drops the `users.organisation_id` column, its FK, and its index. Auth-related columns (`tenant_id`, `role` enum, IdP fields) are untouched; the login flow, password reset, and session/JWT issuance paths are unaffected. The "where does this user work" question is answered post-migration through `PractitionerRole.is_primary = TRUE AND period_end IS NULL`. The downgrade re-adds `users.organisation_id` (NOT NULL) populated from each user's current primary role before dropping the new tables.

The source-test `tests/source/test_no_user_organisation_id_references.py` asserts no production code reads `user.organisation_id` after this change (migration files excluded).
