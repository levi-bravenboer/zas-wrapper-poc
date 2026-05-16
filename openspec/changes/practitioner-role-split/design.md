## Context

`user-base`, `organisations-base`, `patients-base`, and `care-teams-base` ship a flattened identity model: `User.organisation_id` is the single source of "where this person works". It demos, but it conflates **auth identity** (the FHIR `Practitioner`) with **employment** (the FHIR `PractitionerRole`). Care-team participation already provides a per-engagement workaround via `on_behalf_of_organisation_id`, but employment history, simultaneous affiliations, and specialty/code on the affiliation itself have no home.

FHIR R4 is explicit:
- `Practitioner` — the person. Identifiers, name, qualification. No org.
- `Organization` — the practice / hospital / department.
- `PractitionerRole` — links Practitioner ↔ Organization, M:N, with `code` (role), `specialty`, `period`. THIS is where employment lives. Multiple concurrent rows model "Dr. Smith works at clinic A and consults at hospital B".

The orchestrator-admin-ux chain is about to build UI for users, organisations, affiliations, and care-team membership. Building any of that against the pre-split shape means re-writing it as soon as the first freelance caregiver appears. This change lifts the data shape first; UI specs build on top.

## Goals / Non-Goals

**Goals:**
- Two-table addition (`practitioners` + `practitioner_roles`) matching FHIR `Practitioner` and `PractitionerRole`.
- Drop `users.organisation_id` — the employment FK that no longer fits.
- Replace `care_team_participants.on_behalf_of_organisation_id` with `acting_as_practitioner_role_id` — strictly more precise (records the specific affiliation under which the participation occurred).
- Visibility predicate rerouted through PractitionerRole; semantics strictly more permissive (ORs across all open roles).
- Backfill migration is reversible; legacy single-affiliation users see no behavioural change.
- Audit / history of role changes is append-only (period_start / period_end on PractitionerRole; closed rows preserved).

**Non-Goals:**
- No FHIR wire-format serialization. API speaks our own typed DTOs.
- No open CodeableConcept for `role` or `specialty` — start with narrow enums (`gp | physiotherapist | psychologist | nurse | physician | other`); widen later (additive).
- No cross-tenant Practitioner federation. Both Practitioner and its Organizations MUST share the tenant. (Federation = MVP+, BL-063.)
- No CareTeam.managingOrganization column. Per-participant affiliation is enough today (BL-060).
- No PractitionerRole.identifier (FHIR-`identifier`) yet — additive future.
- No UI. This change is backend-only; the chain's #2 (`caregiver-shell`) and beyond consume the new shape.

## Decisions

### D1. Two new tables: `practitioners` + `practitioner_roles`

`practitioners (id, tenant_id, user_id [unique], given_name, family_name, qualification nullable, audit cols)`. Exactly one per caregiver `User`. Admin users do not get a Practitioner row (auth-only identity).

`practitioner_roles (id, tenant_id [denorm], practitioner_id, organisation_id, code enum, specialty nullable, is_primary boolean, period_start, period_end nullable, audit cols)`. Period right-open (NULL `period_end` = currently active).

Rationale for splitting `User` ↔ `Practitioner` 1:1 rather than merging:
- Admins are Users but not Practitioners. Forcing every admin to carry clinical-name columns is wrong.
- Future: a Practitioner may not even be a User (referenced by HiX with no login). The seam is needed eventually.
- Auth/IdP code (sessions, password reset, JWT issuance) needs nothing from Practitioner; the split keeps auth simple.

### D2. Drop `users.organisation_id`

The column is the visible artefact of the conflation. Once `PractitionerRole.is_primary=TRUE` rows exist, every consumer should route through them. Keeping both = drift risk.

The migration drops the column **after** backfill is verified. Test `tests/source/test_no_user_organisation_id_references.py` greps the codebase for residual reads (migration files excluded).

### D3. `acting_as_practitioner_role_id` replaces `on_behalf_of_organisation_id`

`on_behalf_of_organisation_id` was an org-only reference. `acting_as_practitioner_role_id` points at the **specific employment** the user invoked when joining the team. Strictly more precise:
- Captures the role/specialty active at engagement time
- Picks the right org even if the practitioner later updates their primary affiliation
- Matches FHIR `CareTeam.participant.member` semantics (Reference to PractitionerRole, not Organization)

Nullable because PoC has rows from `care-teams-base` where the on-behalf-of was unspecified. Backfill resolves where possible; otherwise NULL.

### D4. `is_primary` boolean + partial unique

Some consumers (UI list "who works where", patient `managingOrganization` semantics) need one canonical affiliation per practitioner. FHIR doesn't enforce this; we do at the DB level via:

```sql
CREATE UNIQUE INDEX practitioner_role_one_primary
  ON practitioner_roles (practitioner_id)
  WHERE is_primary = TRUE AND period_end IS NULL;
```

Setting `is_primary=TRUE` on a new open role automatically demotes any existing open primary (service-layer enforced transactionally, before insert).

### D5. Code as enum, not CodeableConcept

FHIR `PractitionerRole.code` is `CodeableConcept` (open). We constrain to a 6-value enum for MVP:
- `gp` — general practitioner
- `physiotherapist`
- `psychologist`
- `nurse`
- `physician` — hospital physician/specialist
- `other` — catch-all; do not let it block onboarding

Rationale: hospitals don't have authored role vocabularies for this tool yet; an open code system without a value set is just free text with extra steps. Widen to `CodeableConcept` (additive: add `system` + `code` strings, keep enum as fallback view) when the first hospital needs custom codes (BL-062).

### D6. Visibility predicate rewrite

Pre-split: caregiver sees patient iff (a) open CareTeam participant row exists, OR (b) `root(user.organisation_id) == root(patient.primary_organisation_id)`.

Post-split: same (a); (b) becomes "ANY open `PractitionerRole.organisation_id` shares a root with `patient.primary_organisation_id`". Single-role users see identical results. Multi-role users see strictly more (their union).

Implemented via new helper `practitioner_root_orgs_for(user) -> set[UUID]` queried by `PatientService` and `require_patient_access`. Admin bypass unchanged.

### D7. Endpoint shape

`GET /practitioners/{user_id}` returns Practitioner + embedded roles (open + closed, ordered by `is_primary DESC, period_start DESC`). Admin write endpoints under `/practitioner-roles/*`. Why not nest under `/practitioners/{user_id}/roles`? Because a role is queried/edited by id from admin UI; nesting forces redundant path components.

`POST /practitioner-roles` admin-only. The "caregiver can edit their own affiliations" question is deferred — current model is admin-managed.

### D8. Backfill safety

Two backfill steps:
1. For each caregiver `User`, materialise Practitioner + 1 primary `PractitionerRole` row.
2. For each `CareTeamParticipant`, resolve `acting_as_practitioner_role_id` from `on_behalf_of_organisation_id`:
   - First: open role matching exactly `(practitioner=user.practitioner, organisation=on_behalf_of_organisation_id)`
   - Fallback: the `is_primary` role of the participant's practitioner
   - Else: NULL

Migration prints a per-step count: `materialised N practitioners`, `materialised N roles`, `resolved N/M participant on-behalf-of (exact: A, primary-fallback: B, null: C)`. Helps the human reviewer spot data anomalies before running in prod.

Downgrade reverses: re-add `users.organisation_id` (NOT NULL, populated from `is_primary` role), re-add `care_team_participants.on_behalf_of_organisation_id` (populated from `acting_as.organisation_id`), drop new tables and enum.

## Risks

- **R1 — admin auth.** Dropping `users.organisation_id` could break admin filters or RBAC checks. **Mitigation**: grep test (8.6) + manual audit; `role` enum + `tenant_id` are unchanged, so the auth path stays intact.
- **R2 — backfill data loss.** Lossy if a user has multiple historical affiliations not captured pre-split (we only had one column). **Acceptable**: pre-split model only had one anyway; nothing to lose.
- **R3 — visibility expansion.** Multi-role users now see more patients than before. **Mitigation**: by design — that's what M:N unlocks. Regression suite confirms single-role users see identical sets.
- **R4 — Performance.** Visibility predicate now joins through `practitioner_roles` instead of single FK lookup. **Mitigation**: indexes on `practitioner_id` + partial `WHERE period_end IS NULL`; typical caregiver has 1-2 open roles. Benchmark in tests if necessary.

## Open questions

- Should an admin be deletable when they're the `created_by`/`updated_by` reference on dozens of rows? Not changed by this proposal; current `RESTRICT` semantics keep admins immortal until rows are reassigned. Out of scope.
- Should `Practitioner.qualification` be structured (degree code + institution + year)? Today: free text. Future: FHIR `Qualification` backbone element. Track as BL.
