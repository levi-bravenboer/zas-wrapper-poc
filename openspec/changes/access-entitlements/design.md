# Design — access-entitlements

## Context

`access-management-ory` ships Kratos sessions + Keto relation authz with a
deliberately small OPL model (`Organisation` parent-chain, `CareTeam.member`,
`Patient.{treating_org,care_team,external_carer}`, permits `view` /
`view_shielded`) and a Postgres-is-truth derivation pipeline (before_flush
outbox → relay → reconciler). The Lastenboek requirements
(REQ-NON-8/10/12/15, REQ-FUN-1/4/28/42/161, REQ-NON-3) add entitlement
semantics on top: therapeutic relationship + break-glass, specialism-scoped
carepath access, campus scoping, verb-granular consent-gated external
collaboration, configurable shielding, multi-role sessions.

Hard constraints inherited from the parent change:
- Postgres stays the source of truth; Keto tuples are always derived.
- OPL has no conditionals — set algebra only; conditional logic lives in
  `derive.py` (which tuples get emitted), not in permits.
- Keto deny surfaces as 404 (existence-hiding); flag
  `AUTHZ_KETO_ENABLED=false` must reproduce pre-Ory behavior.
- List endpoints derive visible sets in SQL from the same domain facts.

Relevant existing schema facts:
- `practitioner_roles` is period-bounded M:N (practitioner ↔ organisation)
  with a free-text `specialty` column (single-valued).
- `users` uniqueness is (tenant, lower(email), **role**) — the same human can
  already hold multiple user rows, one per role. `external_identities` maps a
  Kratos identity to a user row.
- There is **no** patient↔pathway enrollment table yet; pathways are
  definitions only.

## Goals / Non-Goals

**Goals:**
- Express all five entitlement dimensions in the existing derive/outbox/
  reconcile architecture without changing its shape.
- Keep OPL permits pure set algebra; push every "if configured then…" into
  derivation.
- Demo-able by June 24: wrong-specialism caregiver blocked from a carepath,
  break-glass with reason, external professional with partial verbs, a
  multi-role human picking a role at login.

**Non-Goals:**
- Item-level shielding UI and notification-leak handling (no notification
  stack in PoC).
- CSAM/eHealth mandate intake, eID/itsme federation (BL-067 /
  `oidc-login-providers`).
- Post-closure retention windows (REQ-FUN-145), SCIM provisioning
  (REQ-NON-5/6), audit-log dashboard (REQ-FUN-129/156).
- Patient↔pathway enrollment itself — `carepath-access` guards pathway
  definitions now and is written to extend to enrollments when they land.

## Decisions

### D1 — Therapeutic relationship is an umbrella permit, not a new truth table
REQ-NON-8's "therapeutic relationship" is defined as the union the OPL
already computes: care-team participation ∪ org-chain treating relation ∪
break-glass grant. We do **not** introduce a `therapeutic_relations` table
that duplicates `care_team_participants` / `practitioner_roles` — that would
recreate the drift problem the reconciler exists to kill. The only missing
leg is break-glass, which gets its own table:

```
access_grants(id, tenant_id, patient_id, user_id, reason TEXT NOT NULL,
              granted_by, granted_at, expires_at NOT NULL, revoked_at NULL)
```

Derivation emits `Patient:<id>#break_glass@User:<uuid>` for open, unexpired
grants. OPL adds `break_glass: User[]` to `Patient` and includes it in
`view` **and** `view_shielded` (a substitute clinician needs full sight).
Expiry: grants are time-capped (settings: `authz_break_glass_max_hours`,
default 4); a periodic sweep (same in-app loop cadence as the relay) enqueues
outbox rows for patients with grants that expired since the last pass, so
tuples drop within seconds of expiry without a cron dependency.

*Alternative considered*: explicit therapeutic-relation table consolidating
all sources — rejected (duplicated truth, double bookkeeping).

### D2 — Specialisms become master data; carepath scoping via a `Carepath` namespace
`specialisms(code PK, display, source)` master table +
`practitioner_role_specialisms(practitioner_role_id, specialism_code)` M:N —
FHIR `PractitionerRole.specialty` is 0..*, and REQ-FUN-28 explicitly needs
surgeon-and-orthopedist on one affiliation. The existing free-text
`practitioner_roles.specialty` column is backfilled into the link table and
deprecated (kept readable until MVP master-data sync, BL entry).

Carepath side: `pathway_specialisms(pathway_id, specialism_code)` and
`pathway_practitioners(pathway_id, user_id)` (explicit assignment,
REQ-NON-12).

OPL:

```
class Specialism { related: { practitioner: User[] } }
class Carepath {
  related: { specialism: Specialism[], assigned: User[], owner_org: Organisation[] }
  permits = { view: assigned ∋ subject ∪ specialism.traverse(s => s.practitioner ∋ subject)
                    ∪ owner_org.traverse(o => o.permits.view)  // admin/org fallback kept narrow
  }
}
```

REQ-NON-12's conditional ("if specific practitioners are assigned, only they
get access; otherwise everyone in the linked specialisms") is **not**
expressible in OPL — so it lives in derivation: if `pathway_practitioners`
rows exist for a pathway, emit only `assigned` tuples; otherwise emit
`specialism` edges. Never both. This mirrors the existing pattern (conditions
decide which tuples exist, permits stay unions).

Route guard: new `require_carepath_access` dependency on pathway
detail/update routes (admin short-circuits, deny = 404). Patient-scoped
enforcement extends to enrollments when an enrollment table exists — the
permit is already written for it (`Patient.view` will additionally traverse
the enrolled carepath at that point, not in this change).

### D3 — Campuses are organisations; no new mechanism
REQ-NON-15's campus scoping rides the existing `Organisation.parent` chain:
ZAS root → campus → department orgs. The change here is data + spec, not
mechanism: seeds model the two ZAS campuses as child orgs, practitioner roles
attach at campus or department level, and the spec states the requirement so
the guarantee is tested. `organisations` needs no schema change.

### D4 — External verbs are relations; consent is a derivation gate
`Patient.external_carer` (binary) is replaced by verb relations:

```
Patient.related: { external_reader, external_writer,
                   external_recorder, external_messager: User[] }
permits:
  view            = view_shielded ∪ external_reader
  edit            = care_team.member ∪ break_glass ∪ external_writer
  record          = edit ∪ external_recorder
  message         = view ∪ external_messager   // anyone who can see can message, plus explicit grants
```

Domain side:
- `external_access_profiles(professional_type, verbs[])` — which verbs a GP /
  physio / home-nurse type may receive (REQ-FUN-42 "configuration of
  permitted activities per type").
- `external_grants(id, tenant_id, patient_id, user_id, professional_type,
  consent_id FK NOT NULL, period_start, period_end NULL)`.
- `consents(id, tenant_id, patient_id, scope, status, granted_at,
  revoked_at)` — minimal consent record (full informed-consent flow stays
  BL-017).

Derivation emits verb tuples = `profile.verbs ∩ grant active ∩ consent
active`. Revoking consent touches the patient object → outbox → tuples drop.

**Migration note**: `Patient#external_carer` currently sits in
`EXTERNAL_RELATIONS` (preserved by the reconciler because it had no domain
source). It now *gains* a domain source, so it leaves the frozenset and
becomes fully managed: a backfill script converts existing `external_carer`
tuples into `external_grants` + consent rows before the reconciler first runs
with the new derivation, otherwise it would delete them.

### D5 — Shielding config lives in Postgres, not in Keto tuples
REQ-FUN-161 wants per-item-category × per-role × per-carepath release with
default-deny. Modelling that as tuples means (patients × categories × roles)
cardinality and constant churn — wrong tool. Split:

- **Keto answers the subject question** (two tiers, unchanged):
  `view_shielded` (internal/full sight) vs `view` (limited sight).
- **Postgres answers the shape question**: `shielding_rules(id, tenant_id,
  pathway_id NULL=global, item_category enum{questionnaire_answers, diary,
  attachments, parameters, documents}, audience enum{representative,
  external_professional, patient_other_role}, released bool)` — evaluated by
  one policy service `shielding.is_released(category, audience, pathway)`
  at response-shaping time. **Absence of a rule = shielded** (default-deny
  per the requirement).
- Patient-initiated shielding: `shielded_items(patient_id, item_ref,
  audience)` rows mark specific items private regardless of release rules
  (model + service in this change; authoring UI later).

Single enforcement point: serializers for patient-scoped payloads call the
policy service; routes never hand-roll shielding. Audit of attempts rides the
existing audit fields; the dashboard is out of scope.

### D6 — Multi-role: one Kratos identity per human, role binding per session
Kratos enforces unique email per credential identifier, and the `users`
table already allows one row per role for the same email — so the natural
model is:

- **Identity** = the human (one Kratos identity per email).
- **User row** = the human acting in a role (existing schema, untouched).
- `external_identities` becomes many-rows-per-identity: each user row of the
  same human links to the same `(idp, external_subject)`; the unique
  constraint moves to `(tenant_id, idp, external_subject, user_id)`.
- New `session_role_bindings(kratos_session_id PK, user_id, bound_at)` —
  written at login (auto when the identity resolves to exactly one user row;
  after an explicit role choice when it resolves to several).

Login flow: `authenticate_password` resolves the identity's user-row roster.
One row → bind and proceed exactly as today (no UX change for every existing
user, including the mobile patient flow). Several rows → login response
returns `requires_role_selection` + the role list; `POST /auth/session/role`
(authenticated by the fresh session token) writes the binding; protected
routes 409 until a binding exists. Role switch = same endpoint, rewrites the
binding, audit-logged with old/new role; no re-authentication required
(REQ-NON-3 "log in once, choose role").

`resolve_actor_from_request` becomes: cookie → whoami → identity →
binding → user row. All Keto subjects, audit attribution and shielding
audiences flow from the bound user row — which makes REQ-FUN-4's
"information entered under one role is shielded from the other roles"
automatic: the human's other roles are simply different subjects with no
tuples.

*Alternative considered*: role claim in Kratos session/identity
`metadata_public` — rejected: metadata is identity-scoped (one human, many
concurrent sessions would fight over it) and writable only via admin API
round-trips; a local binding table keyed by session id is cheaper and
revocation-safe (session revoked → binding row is dead weight, swept lazily).

### D7 — Break-glass authorisation and audit
Who may break glass: any active user with `Role.CAREGIVER` whose
practitioner has an open role in the patient's treating-org **root tenant
tree** (i.e. colleagues, not externals), via
`POST /patients/{id}/access-grants {reason, hours<=max}`. The endpoint
requires reason (non-empty, persisted verbatim), caps duration, writes the
`access_grants` row + outbox in one transaction, and the grant is visible to
admins (`GET /admin/access-grants?active=true`). Every use of break-glass
access is distinguishable in audit context (actor + active grant id resolved
by the guard). Deny stays 404 for outsiders — the break-glass affordance is
only offered when the user can name the patient through legitimate search
flows (demo: direct link from handover).

### D8 — Single feature flag, additive guards
Everything stays behind `AUTHZ_KETO_ENABLED`. No sub-flags: carepath guards,
verb checks and break-glass all no-op to pre-Ory behavior when the flag is
off (`require_carepath_access` returns early, serializer shielding falls back
to the current binary internal/external rule). Seeds always write the new
domain rows so flipping the flag needs no reseed.

## Risks / Trade-offs

- [OPL conditional emulated in derivation (D2) drifts if someone edits OPL
  without reading derive.py] → both files carry a pointer comment to the
  other; reconciler tests assert the assigned-XOR-specialism invariant.
- [`external_carer` leaves `EXTERNAL_RELATIONS`; reconciler would delete
  unbackfilled tuples] → backfill script ordered **before** first reconcile
  in the upgrade path; smoke test asserts grant survival.
- [Tuple cardinality grows (verbs × externals, specialism members)] →
  specialism membership is per-specialism (not per-patient) so growth is
  linear; verb tuples only for externals (rare). Reconciler stats logged.
- [Multi-role login adds a state (`requires_role_selection`) to the auth
  contract] → single-role users bypass it entirely; e2e covers both paths;
  mobile (patients) never sees it.
- [Shielding policy service is a second authority next to Keto] → strict
  split documented: Keto = *who sees the patient at all*, policy service =
  *which categories inside the response*; neither overrides the other.
- [Bulk SQL updates still bypass the outbox (known caveat)] → unchanged;
  `scripts/reconcile_authz_tuples` remains the repair tool, now covering the
  new namespaces.

## Migration Plan

1. Alembic: `specialisms`, `practitioner_role_specialisms`,
   `pathway_specialisms`, `pathway_practitioners`, `consents`,
   `external_access_profiles`, `external_grants`, `access_grants`,
   `shielding_rules`, `shielded_items`, `session_role_bindings`,
   `external_identities` constraint widening. Backfill
   `practitioner_roles.specialty` → link table in the same revision.
2. OPL: extend `namespaces.keto.ts` (new namespaces + verb relations);
   restart Keto (config-only).
3. Run `external_carer` → `external_grants` backfill, then
   `scripts/reconcile_authz_tuples` (now derives the new namespaces).
4. Deploy backend (new guards inert while flag off), flip
   `AUTHZ_KETO_ENABLED=true` in demo env, re-run smoke.
   Rollback = flag off (pre-Ory behavior preserved end-to-end).

## Open Questions

- Verb set for internal roles: should org-chain (non-care-team) practitioners
  get `edit` or read-only? PoC keeps them read-capable (`view_shielded`)
  without `edit`; revisit with clinical input.
- `message` semantics are speculative until the communication module exists —
  the relation is cheap to keep, the route guard lands with messaging.
- Where the role picker lives on mobile if a patient is also a caregiver
  (deferred; orchestrator-only UI in this change).
