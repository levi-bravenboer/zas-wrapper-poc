# Change Chain — FHIR foundation (tenant → org → user → patient → care-team)

OpenSpec has no native cross-change dependency field, so the order below is the source of truth. Each change in the chain depends on **all** prior changes being archived (or at minimum applied + tests green on the integration branch). Do not start a downstream change before its upstream is in.

## Order

```
1. organisations-base
     └─ requires: tenant-base (archived), user-base (archived), auth-stub (archived)
     └─ modifies: user-base (role enum + users.organisation_id FK), auth-stub (require_role varargs)
     └─ adds:    organisations-base capability

2. patients-base
     └─ requires: organisations-base (this chain)
     └─ adds:    patients-base capability

3. care-teams-base
     └─ requires: patients-base (this chain), organisations-base (this chain)
     └─ modifies: patients-base (GET /patients visibility filter applies care-team rules for caregiver role)
     └─ adds:    care-teams-base capability
```

## Why this order

- **organisations-base first**: introduces the FHIR `Organization` tree and the user-organisation affiliation FK. `patients-base` needs `patients.primary_organisation_id` to exist; `care-teams-base` needs `on_behalf_of_organisation_id` to exist. Also drops the `external` value from `users.role` and replaces the concept with org-tree comparison — this enum migration must land before any new feature uses the role.
- **patients-base second**: introduces the `Patient` entity, identifiers, API, HiX adapter seam. Cannot start before orgs because `patients.primary_organisation_id` is mandatory and `external` role no longer exists when this change ships.
- **care-teams-base third**: requires both prior changes — joins users to patients across periods, scoped by organisation, with visibility filter that rewrites `patients-base` list semantics.

## Concurrency rule

The three changes MUST merge sequentially on `main`. They MAY be drafted in parallel in separate worktrees, but apply / merge order is strictly chain order. If a downstream change needs a tweak to an upstream spec, the change goes in the upstream proposal — never in the downstream one.

## Tracking

| # | Change | Worktree | Status |
| --- | --- | --- | --- |
| 1 | `organisations-base` | `.worktrees/feat-patients-base-setup/` | applied locally (awaiting integration merge) |
| 2 | `patients-base` | `.worktrees/feat-patients-base-setup/` | draft (this worktree) |
| 3 | `care-teams-base` | (draft in this worktree alongside patients-base) | draft |

Update this file whenever a change advances state (draft → in-review → applied → archived).

## Cross-change requirement matrix

| Concern | organisations-base | patients-base | care-teams-base |
| --- | --- | --- | --- |
| `organisations` table | adds | reads (`primary_organisation_id` FK) | reads (`on_behalf_of_organisation_id` FK) |
| `users.organisation_id` FK | adds | reads | reads |
| `users.role` enum (drop `external`) | modifies | uses new enum | uses new enum |
| `require_role(*roles)` varargs | modifies | uses | uses |
| `patients` table | — | adds | reads (FK from participants) |
| `patient_identifiers` table | — | adds | — |
| `care_teams` + `care_team_participants` | — | — | adds |
| `GET /patients` visibility filter | — | tenant-only filter | applies care-team filter (modifies) |

## Out of scope for this chain

- Cross-tenant federation (specialist from another SaaS account). MVP+ work.
- Hosted-guest identity for freelance/independent practitioners. MVP+.
- `PractitionerRole` M:N (user × organisation × period × role-at-org). Additive future change; current chain assumes single-org-per-user FK.
- `Encounter`, `EpisodeOfCare`, `Condition`, `Procedure`, `Observation` — all out of this chain; bundled into future clinical-data work.

## Follow-ups (queued from organisations-base)

- **`PractitionerRole` M:N** — replace single-org-per-user FK with a periodised user × organisation × role-at-org join. Likely lands after care-teams-base ships and we have real usage data.
- **Organisation CRUD API** — admin-only `POST/PATCH/DELETE /organisations`. PoC seeds the tree; mutable org management deferred until org-admin tooling enters scope.
- **Closure-table optimisation** — current `get_root_ancestor` / `get_descendant_ids` use recursive CTEs. If perf becomes a problem at scale, add a closure table maintained by triggers (org trees are deep but not wide; perf risk is low at PoC).
- **Role enum migration test** (`tests/db/test_role_enum_migration.py`) — fresh DB → head → assert `role` enum has only `admin | caregiver`. Deferred; covered indirectly by the backend test suite running against the live migrated schema.
- **Cross-tenant `users.organisation_id` FK guard test** (`tests/db/test_user_organisation_fk.py`) — column is NULLABLE for PoC (bootstrap chicken-and-egg), so the DB-level NOT-NULL assertion no longer applies. Cross-tenant rejection is covered by service-layer tests.
- **Backend OpenAPI contract test** — assert `GET /organisations` present + `Role` enum has only `admin | caregiver`. Currently verified by hand against the diff at regen time.
