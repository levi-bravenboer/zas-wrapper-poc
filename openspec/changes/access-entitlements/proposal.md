# Access Entitlements (Lastenboek alignment)

**Tier**: [poc]

> **Tier note.** Like `access-management-ory` (which this change builds on), the
> entitlement semantics below are naturally `[mvp]`-flavoured work pulled into
> the PoC window deliberately: the Lastenboek (tender requirements,
> `docs/diagrams/Lastenboek Telegeneeskunde-working version.xlsx`) makes
> fine-grained access a scored requirement, the question "did you account for
> caregivers-in-organisations, sub-orgs and care teams in permissions?" has
> already been asked by the client in person, and the June 24 demo is the
> forcing function. Slices deliberately deferred: post-closure read-only
> retention windows (REQ-FUN-145), federated IdPs/CSAM mandates (BL-067,
> `oidc-login-providers`), SCIM/IAM provisioning (REQ-NON-5/6), and the access
> audit-log dashboard (REQ-FUN-129/156) — each parked in `openspec/backlog.md`.

## Why

`access-management-ory` (PR #36) gives us the structural foundation: Kratos
sessions, Keto relation tuples derived from `practitioner_roles` /
`organisations.parent_organisation_id` / `care_team_participants`, org-tree
traversal, and the `view` vs `view_shielded` split. The Lastenboek now makes
the *entitlement semantics* on top of that structure explicit, and they are
exactly the dimensions the client probed in person: specialism-scoped carepath
access, therapeutic relationship with break-glass, consent-gated external
collaboration, configurable shielding, and one human acting in several roles.
None of these are modelled yet. The Keto namespaces were designed to be
extended this way — this change is the extension.

## What Changes

- **Therapeutic relationship as a first-class relation** (REQ-NON-8) — the
  care-team / org-tree tuples become the *derived* form of an explicit,
  time-bounded therapeutic relation; an audited **break-glass** override lets
  an authorised practitioner gain temporary access (vervanging / emergency)
  with mandatory reason capture and automatic expiry.
- **Specialism ↔ carepath ↔ practitioner scoping** (REQ-NON-10, REQ-NON-12,
  REQ-FUN-28) — specialisms become structured master data; carepaths
  (pathways) link to one or more specialisms; access to a carepath and its
  patient data requires a matching open `practitioner_roles.specialty` (or an
  explicit per-carepath practitioner assignment, which further narrows the
  specialism set). New Keto namespace `Carepath`.
- **Campus scoping** (REQ-NON-15) — campuses are modelled as organisations in
  the existing tree (ZAS root → campus → service); no new mechanism, but the
  seed data and derivation are made campus-aware and the requirement is made
  explicit in the spec.
- **Verb-granular external collaboration gated on consent** (REQ-FUN-1,
  REQ-FUN-42) — `Patient.external_carer` splits into verb relations
  (`read` / `write` / `record_measurement` / `message`) configured per
  external-professional type, and every external grant requires an active
  patient consent record; revoking consent revokes the tuples.
- **Shielding configuration with default-deny** (REQ-FUN-161) — the
  `view_shielded` permit becomes configurable per carepath and per role:
  which item categories (questionnaire answers, diary, attachments,
  parameters, documents) are released to which roles. Default behaviour:
  shielded unless explicitly released. Patient-initiated shielding of own
  items is supported at the model level.
- **Multi-role users with role chosen at login** (REQ-NON-3, REQ-FUN-4) — one
  human (one Kratos identity, one email) can hold several local user rows
  (the `users` table already keys uniqueness on tenant + email + **role**);
  login surfaces the available roles, the session binds to exactly one active
  role, and all authz, audit and shielding evaluate against that role's user
  row. Information entered under one role is invisible to the other roles of
  the same human (falls out naturally: different user rows are different Keto
  subjects). Single-role users log straight in (no picker).

**BREAKING**: none at the API contract level while `AUTHZ_KETO_ENABLED=false`;
with the flag on, routes additionally enforce carepath/specialism scoping, so
seeded demo users must carry matching specialties (seed scripts updated in
lockstep).

## Capabilities

### New Capabilities
- `therapeutic-access`: explicit time-bounded therapeutic relationship,
  derivation into Keto tuples, audited break-glass override with expiry.
- `carepath-access`: specialism master data, carepath↔specialism linking,
  optional per-carepath practitioner assignment, `Carepath` Keto namespace and
  route guards.
- `external-collaboration`: verb-granular relations for external
  professionals, per-type permitted-activity configuration, consent gate.
- `shielding-config`: per-carepath / per-role shielding configuration model
  with default-deny, patient-initiated shielding, uniform enforcement point.
- `multi-role-login`: role discovery at login, active-role session binding,
  role-scoped actor resolution and audit context.

### Modified Capabilities
- `keto-authz`: namespace model extended (`Carepath`, `Specialism` edges, verb
  relations on `Patient`, `treating_org` chain reaffirmed as the campus
  mechanism); `view_shielded` re-derived from shielding config.
- `authz-tuple-sync`: new derivation sources (therapeutic relations, carepath
  links, consent state, shielding releases) join the outbox/reconciler flow.
- `auth-session`: session carries an active role; role switch = new session
  binding; `resolve_actor_from_request` resolves identity → (human, active
  role) → user row.
- `kratos-identity`: one Kratos identity per human email; import and lookup
  handle multiple local user rows per identity.

> Note: the four modified capabilities are still pending deltas inside
> `access-management-ory` (not yet archived to `openspec/specs/`). This
> change's deltas stack on top; archive order is `access-management-ory`
> first, then this change.

## Impact

- **Backend**: `app/services/access/` (permissions OPL + derivation +
  relays), new domain models (`specialisms`, `pathway_specialisms`,
  `therapeutic_relations` or equivalent, `consents`, `shielding_rules`,
  break-glass grants), `require_patient_access` and a new
  `require_carepath_access`, login/actor resolution in
  `app/services/access/identity/`.
- **Ory config**: `infra/ory/keto/namespaces.keto.ts` grows `Carepath` and
  verb relations; smoke script extended.
- **Frontend (orchestrator)**: role picker at login (only when >1 role),
  break-glass affordance with reason capture, carepath/patient screens honour
  scoping (404 semantics preserved).
- **Seeds/demo data**: specialisms, carepath links, a multi-role demo human,
  an external professional with partial verbs, a shielded item category.
- **Out of scope here**: notifications-leak prevention UI (no notification
  stack in PoC), CSAM/eHealth mandate intake, retention windows, audit
  dashboard.
