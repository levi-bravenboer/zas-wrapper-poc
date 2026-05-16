## Context

`tenant-base` is the SaaS-level boundary (one tenant = one subscription = one customer instance) and `user-base` ships authenticatable identities scoped to a tenant. There is no concept of *clinical unit* within a tenant. A tenant the size of ZAS Antwerpen has many wards, departments and care programs; treating the whole tenant as one undifferentiated bag breaks the moment we ask "who works in cardiology vs orthopedics" or "which patients belong to the Rugrevalidatie program".

Today's `Role` enum carries `external` as a value. This conflates two orthogonal things: identity (the human and where they come from) and authority (whether they can act on this patient). The chain that follows (`patients-base`, `care-teams-base`) needs both concepts cleanly separated; an org tree gives us the authority concept properly.

FHIR R4 has `Organization` with `partOf` (self-reference) — one resource for hospital, division, department, ward, program. HiX exports its dept tree this way. NewWave's caregiver federation will also speak `Organization` references at MVP. Building the same shape internally collapses three future migrations into one now.

## Goals / Non-Goals

**Goals:**
- One FHIR-canonical `organisations` table, self-referencing, any depth.
- `users.organisation_id` NOT NULL FK so every user has a clinical home — single-org-per-user for PoC.
- Remove `external` from `Role` enum; "external" becomes a query-time predicate over org trees, not an identity field.
- `require_role(*roles)` varargs primitive for the downstream chain.
- Seed produces a coherent demo tree (root hospital + 1-2 depts/programs) and assigns seeded users to nodes.

**Non-Goals:**
- No `PractitionerRole` M:N (user × organisation × period × role-at-org). Additive future change. PoC stays single-org-per-user.
- No org CRUD API. Orgs come from seed only in PoC; admin-managed CRUD is a later UX surface.
- No cross-tenant federation. An org belongs to exactly one tenant. Federation of orgs across tenants is MVP+.
- No org-level policy / permission rules engine yet. The seam is "rules can be keyed on `organisation_id` and walk up the tree" — but no engine ships here.
- No clinical fields on organisations (specialties, NPI, accreditation). Add later as needed.

## Decisions

### D1. FHIR `partOf` self-reference, one table, recursive CTEs

`organisations` carries `parent_organisation_id` (nullable FK self). Depth is unlimited. "All descendants" and "all ancestors" queries use Postgres `WITH RECURSIVE`. Closure table (materialised ancestor/descendant pairs) is deferred — additive optimisation if EXPLAIN shows trouble at MVP scale.

- **Alternative considered**: separate `departments` table or fixed two-level. Both fail when "program" or "ward" appears between dept and patient. Rejected.

### D2. Organisation type = FHIR CodeableConcept (free codes)

Match FHIR `Organization.type` exactly. Three columns:
- `type_code` (varchar NOT NULL) — e.g. `prov`, `dept`, `team`.
- `type_system` (varchar nullable, default `http://terminology.hl7.org/CodeSystem/organization-type`) — code system URI.
- `type_display` (varchar nullable) — human label.

Cardinality 1 in PoC (`type_code` NOT NULL). FHIR allows 0..*; multi-type is additive future (side table `organisation_types`).

`OrganisationTypeCode` StrEnum exists in Python as a **soft** helper for the standard FHIR value set (`prov | dept | team | govt | ins | pay | edu | reli | crs | cg | bus | other`), used for autocomplete/seed/typing. Unknown codes pass through unchecked — FHIR value set is `extensible`, not `required`.

- **Why not closed Postgres enum**: lossy HiX/NewWave import. Their unit/clinic/outpatient-dept codes do not all map to a 5-value closed set.
- **Why one row, not separate columns per concept**: matches FHIR CodeableConcept shape (`coding.system`, `coding.code`, `coding.display`); easy migration to side table when multi-type lands.

### D3. Tenant scope is non-negotiable

Every `organisations` row carries `tenant_id` NOT NULL. `parent_organisation_id` MUST reference an organisation in the same tenant (enforced by app-layer check + a CI test; Postgres can't express the cross-row tenant constraint cheaply without a trigger, and triggers are heavier than the check). Cross-tenant org references are rejected.

### D4. Users get a single mandatory org FK

`users.organisation_id` NOT NULL FK → `organisations.id`. Existing seeded admin + caregiver rows backfill to a seeded "default-tenant root hospital" node in the migration. No row left without an org.

- **Why NOT NULL**: forces every code path to handle "the user's org" — no "what if it's null" branches polluting downstream features.
- **Why single FK, not join table**: PoC has no moonlighters. M:N is additive (later change swaps FK for join table; users.organisation_id becomes computed as "the active row's organisation_id" via a view).

### D5. Drop `external` from `Role` enum

`Role` becomes `admin | caregiver` (StrEnum). Postgres enum type `role` rebuilt without `external`. No existing rows hold `external` (PoC hasn't shipped external login). Pydantic schemas update.

- **Authority concept that `external` carried** moves into a query-time predicate: `is_external_for(user, patient) := lca(user.org, patient.primary_org) != patient.primary_org_subtree_root`. Implemented as a helper in `app/services/organisation/predicates.py` for use by downstream chain.
- **Alternative considered**: keep `external` enum, ignore it. Rejected — having unused values invites misuse.

### D6. `require_role` becomes varargs

`def require_role(*roles: Role) -> Callable[[SessionUser], SessionUser]` — body checks `if user.role not in set(roles)`. Existing call sites `require_role(Role.ADMIN)` still compile (one-element varargs). Spec on `auth-stub` updates accordingly.

### D7. Org API surface (PoC minimum)

- `GET /organisations` — returns the full tree for the caller's tenant. Response shape: flat list of org rows with `parent_organisation_id` populated; FE materialises the tree. Pagination not needed at PoC scale.
- Create / update / delete deferred — orgs ship via seed only. Future change adds admin UI + endpoints.

### D8. Seed shape (demo)

Default demo tenant seeds:

```
ZAS Antwerpen (hospital, root)
├── Orthopedie (department)
│    └── Rugrevalidatie (program)        ← demo patients seeded here
└── Cardiologie (department)
```

Seeded admin → root hospital. Seeded caregiver → `Rugrevalidatie` program. Adjustments are trivial; demo only depends on the Rugrevalidatie program existing.

### D9. "External" derivation rule — R1 root-ancestor match (LOCKED)

Predicate: `is_external_for(user, patient) := root_ancestor(user.organisation_id) != root_ancestor(patient.primary_organisation_id)`. Two users sharing a root ancestor (i.e. same hospital tree) are internal to each other's patients; cross-root = external.

**Why R1, not R2 (patient-subtree) or R3 (exact node):** FHIR R4 does not specify an internal/external concept — it provides shape (`CareTeam.participant.onBehalfOf`, `Organization.partOf`, `PractitionerRole.organization`) and leaves trust boundaries to implementers. Every major FHIR implementation (Epic, HiX, NHS GP Connect, IHE XCA/XDS affinity domain) draws the trust boundary at the root-org level. Sub-tree boundaries are a permissions concept layered on top, not externality.

R2/R3 are reachable additively later as permission policy without changing this predicate.

## Risks / Trade-offs

- **[Risk] Backfilling existing user rows to a seeded org during the migration could race with running apps.** → Mitigation: PoC is single-deployment, no zero-downtime requirement. Apply in maintenance window. For MVP, downstream changes pattern this as expand-contract.
- **[Risk] Recursive CTEs become slow at scale.** → Mitigation: closure table is a future additive change. PoC scale (tens of orgs per tenant) makes it irrelevant.
- **[Risk] Dropping enum value `external` is a destructive Postgres operation (must rebuild type).** → Mitigation: migration scripts the standard "rename type → create new → cast column → drop old" dance. Downgrade restores `external`.
- **[Trade-off] Single-org-per-user vs PractitionerRole M:N.** Chose simpler now, locked-in path to additive future change. Moonlighting practitioners (one user, two orgs at the same time) is not a PoC use case.
- **[Trade-off] No CRUD endpoints for orgs in PoC.** Orgs come from seed. If the demo wants to demo "add a department", we'd need to add `POST /organisations` here; current plan defers.

## Migration Plan

1. Land Alembic revision: create `organisation_type` enum, create `organisations` table.
2. Same revision (or follow-up): seed default root hospital + demo nodes for existing tenants (in PoC: just the default tenant — there is only one).
3. Same revision: add `users.organisation_id` (initially nullable), backfill all existing user rows to the appropriate seeded node, then alter to NOT NULL.
4. Same revision: rename existing `role` enum → `role__old`; create new `role` enum without `external`; alter `users.role` column to new type via cast; drop `role__old`. Note: no `external` rows expected; cast asserts that.
5. Regenerate OpenAPI; orchestrator client gets `Organization` types.
6. Downgrade reverses (re-adds `external`, drops `organisation_id`, drops table + enum).

## Open Questions

- ~~**OQ1 — Default external policy.**~~ Resolved: R1 (root-ancestor match) per D9.
- ~~**OQ2 — Organisation `type` openness.**~~ Resolved: FHIR CodeableConcept (free codes) per D2.
- ~~**OQ3 — Org tree depth cap.**~~ Resolved: no cap. FHIR-pure. Expected depth ≤6 (system→hospital→division→department→ward→team); UI sizes for 6, deeper renders compressed. Revisit if CTE perf or UI breaks.
