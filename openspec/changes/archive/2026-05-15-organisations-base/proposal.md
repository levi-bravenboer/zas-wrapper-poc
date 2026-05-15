## Why

We need to model *who* a caregiver works for and *which clinical unit* a patient is affiliated with — at the SaaS-tenant level (subscriptions / billing) tenants already exist, but inside a tenant there is no concept of "hospital → department → ward → program". This blocks every downstream feature that needs to distinguish "the user's primary unit" from "another unit in the same hospital", and prevents getting rid of the `external` value on `users.role`, which conflates identity with authority.

FHIR R4 solves this directly with `Organization` (self-referencing via `partOf`) — one resource type, any depth. HiX exports its `Behandelteam` / dept / ward hierarchy via the same shape. Introducing it now, before `patients-base` and `care-teams-base` add columns that depend on it, avoids a multi-step migration during the chain.

## What Changes

- Add `organisations` table: self-referencing tree, tenant-scoped, FHIR `Organization.partOf` semantics. Types: `hospital | division | department | ward | program`.
- Add `users.organisation_id` FK (NOT NULL after seed migration) → `organisations.id`. Each user belongs to exactly one organisation node within their tenant. Multi-org-per-user (FHIR `PractitionerRole`) deferred — additive future change.
- **BREAKING (internal-only, no live data yet)**: drop `external` from `Role` enum. `Role` becomes `admin | caregiver`. "External" authority is derived from comparing the caregiver's organisation subtree against the patient's primary organisation subtree at query time.
- Extend `require_role` to accept varargs (`*roles: Role`). Existing single-arg call sites stay valid.
- Update `seed_tenant.py` + `seed_users.py`: seed creates a root hospital + 1-2 demo nodes (e.g. `Orthopedie` → `Rugrevalidatie`); seeded users get assigned to a node.
- Add `GET /organisations` (tree-shaped list, tenant-scoped). Create / update endpoints deferred; PoC reaches orgs via seed only.

## Capabilities

### New Capabilities

- `organisations-base`: FHIR-aligned Organization tree, tenant-scoped, foundation for patient and care-team affiliation.

### Modified Capabilities

- `user-base`: drop `external` from role enum; add `organisation_id` FK to users table; update seed to assign org.
- `auth-stub`: `require_role` accepts one-or-more roles via varargs.

## Impact

- **Code**: `apps/backend/app/models/organisation.py`, `app/schemas/organisation/organisation.py`, `app/services/organisation/`, `app/api/routers/organisation/organisation_router.py`, Alembic revision under `alembic/versions/`, edits to `app/core/enums/user.py`, `app/models/user.py`, `app/services/auth/deps.py`, `scripts/seed_tenant.py`, `scripts/seed_users.py`.
- **DB**: 1 new table (`organisations`), 1 new enum type (`organisation_type`), 1 new FK column on `users` (`organisation_id`, NOT NULL after backfill), 1 enum value drop on `role`.
- **APIs**: 1 new endpoint (`GET /organisations`).
- **Dependencies**: no new runtime deps.
- **Future seams reserved**: `PractitionerRole` M:N (replaces `users.organisation_id` FK with a join table) — additive future change.
- **Chain position**: change #1 of the FHIR-foundation chain (see `openspec/changes/CHAIN.md`). Must merge before `patients-base` and `care-teams-base`.
