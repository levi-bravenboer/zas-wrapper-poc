## Context

We have `tenant-base`, `user-base`, and (chain prerequisite) `organisations-base` shipped: every domain row is `TenantOwnedEntity` (tenant FK + audit cols + soft delete), enums live under `app/core/enums/`, audit cols are stamped by the SQLAlchemy session hook off `session.info[SESSION_ACTOR_KEY]`, every user has a mandatory `organisation_id`, the `external` role is gone (replaced by org-tree comparison). `patients-base` is the next domain entity. Two forces shape it:

1. **PoC needs a working patient list for the Rugrevalidatie demo.** Caregiver logs in, sees patients in their tenant, opens one, runs a pathway against them.
2. **MVP will source patients from HiX via SMART-on-FHIR launch.** Local rows become a projection/cache, not the source of truth. Per `openspec/project.md`: "FHIR-ready seam, not FHIR-built" — no `fhir.resources` dependency (BL-025 still deferred), but field shapes must align with FHIR R4 Patient so an adapter mapping is trivial later.

Constraints inherited from project rules:
- No real PHI anywhere (synthetic only).
- Never an MDR medical device — patient row stores identifiers + demographics only, no clinical state.
- Belgian hosting / data residency for any productionised deployment.
- GDPR-Art.17 erasure must be feasible without breaking audit.

## Goals / Non-Goals

**Goals:**
- PoC-usable patient API today (list / get / create / patch / soft-delete), tenant-scoped, caregiver-authenticated.
- **FHIR R4 Patient is the shape authority.** Column names, value sets, identifier system URIs, and list-search param names map 1:1 to FHIR (`family`, `given`, `birthdate`, `identifier`, administrative-gender codes). Mapping to a real `fhir.resources` Patient is a future adapter concern; the table is structurally compatible.
- Multi-identifier model from day one (`patient_identifiers` child table) — FHIR `Patient.identifier` is `0..*`. INSZ today, MRN / HiX-FHIR-id / itsme-sub tomorrow add zero migration.
- Adapter slot reserved at `app/adapters/hix/patients.py` so MVP HiX wiring lands in a known location.
- Sync seams baked: `source` enum on row (`local` | `hix` | `luscii`), `external_system` + `external_ref` + `external_version` + `last_synced_at` columns. Default `source=local` for PoC seeds.
- Seed script generates deterministic synthetic patients with checksum-valid (but fake) INSZ.
- Per-row stub for future GDPR erasure: soft-delete + `deleted_by`. Erasure endpoint deferred to MVP, but column shape supports it.

**Non-Goals:**
- **Patient is NOT an authenticatable entity.** Patients never log in — not to our app, not via HiX-embedded patient portals, not via itsme®/eID-for-patients. The `patients` table SHALL NOT carry credentials, password hashes, session refs, or any auth-pathway column. It is distinct from `users`. Patient surfaces (if any future product wants them) are a separate capability with their own auth story.
- No live HiX call. Adapter is a stub. MVP work item.
- No FHIR Patient resource serialisation in the API response, no `fhir.resources` import. FHIR is the shape contract, not the wire format. Our API speaks our own typed DTOs; FHIR-to-DTO mapping is the adapter's job.
- No patient-level ACL beyond tenant scope. External-caregiver row-level ACL deferred to MVP (`BL-010` cluster).
- No `patient_names` / `addresses` / `telecoms` child tables in PoC. Single name on row; multi-name table added in MVP if HiX returns multiple `name` entries.
- No clinical fields. No diagnosis, no medication, no observation. MDR boundary stays.
- No patient self-service surface. Patient as user is deferred (`BL-014`) and the moment it becomes a thing, it is a NEW table for the auth side — `patients` row stays clinical-subject-only.
- No encryption-at-column-level for INSZ in PoC (synthetic data only). MVP must revisit before real PHI.

## Decisions

### D1. Identifiers as a child table from day one

`patient_identifiers (id, patient_id, system, value, use, created_at, updated_at)` with partial unique `(patient_id, system, value) WHERE deleted_at IS NULL`. Tenant scope is inherited through `patient_id`.

- **Why**: FHIR `Patient.identifier` is `0..*`. HiX will return at least `{ INSZ, HiX-MRN, FHIR-Patient.id }`. A single `insz` column would force a migration the day we wire HiX. Child table is cheap now (~20 LOC), expensive later.
- **Alternative considered**: single `insz` column + add table later. Rejected — moves the migration into the HiX-integration sprint when we have no margin.
- **Trade-off**: one more join for list queries. Acceptable; we'll eager-load identifiers via `selectinload` and cap list page size.

### D2. INSZ stored as identifier row with Belgian OID system

System value: `urn:oid:2.16.840.1.113883.2.8.4.1.1` (Belgian INSZ OID). Use code: `official`. Validated by Mod-97 checksum in a Pydantic validator. Seed values are checksum-valid but generated from a fixed seed in `seed_patients.py` — never real.

- **Why**: Aligns with FHIR identifier semantics so the HiX adapter maps 1:1. Mod-97 validation catches malformed input at the API boundary.

### D3. FHIR-shaped denormalised columns on `patients`

`given_name`, `family_name`, `birth_date`, `gender` live on the patients row even though FHIR models name as a `HumanName[]` structure.

- **Why**: 99% of UI rendering needs one name + DOB + gender. Denormalising avoids a join for the common path. When HiX returns `name[]`, the adapter picks `use=official` (or first entry) and writes the row columns; the full `name[]` can move to `patient_names` later behind the same adapter without API changes.
- **Trade-off**: lose the ability to store multiple names today. Acceptable — PoC has no use case.

### D4. `source` + `external_*` columns for projection/sync semantics

Columns: `source` (`local|hix|luscii` enum, NOT NULL, default `local`), `external_system` (varchar, nullable), `external_ref` (varchar, nullable), `external_version` (varchar, nullable), `last_synced_at` (timestamptz, nullable). Partial unique `(tenant_id, external_system, external_ref) WHERE external_ref IS NOT NULL AND deleted_at IS NULL`.

- **Why**: declares the row's authority. PoC rows are `source=local`. When MVP launches, HiX-sourced rows are `source=hix`, `external_system='hix'`, `external_ref=<FHIR Patient.id>`. Sync layer uses `last_synced_at` + `external_version` for ETag-style conflict detection without delete-recreate. Audit trail stays intact.
- **Alternative considered**: separate `patient_external_links` table. Rejected for PoC — premature normalisation; HiX is the only foreseen upstream short-term. If a second upstream appears, the columns migrate to a child table cleanly.

### D5. Gender enum mirrors FHIR R4 administrative gender codes

`app/core/enums/patient.py`: `class Gender(StrEnum): male = "male"; female = "female"; other = "other"; unknown = "unknown"`. Postgres enum type `gender`.

- **Why**: Direct FHIR mapping. No translation table needed in the adapter.

### D6. Adapter seam shape

`app/adapters/hix/patients.py` exposes `class HixPatientAdapter` with two methods: `fetch(external_ref: str) -> PatientUpsertIn` and `upsert_from_hix(payload) -> Patient`. Both raise `NotImplementedError("HiX patient adapter is MVP scope")` in PoC. Module is import-tested so the import path is locked.

- **Why**: Reserving the file + class shape now means MVP wiring is a method-body change, not a code-layout discussion. Matches the pattern in `external-adapters` capability.

### D7. API surface

Repo convention: no `/v1` prefix today; routes mount bare. Domain layout: `app/api/routers/patient/patient_router.py`, `app/services/patient/`, `app/schemas/patient/`. Mirrors `user`, `auth`, `system_router`.

- `GET /patients` — paginated list (`limit`, `offset`), tenant-scoped, identifiers eager-loaded. Search uses **FHIR-aligned discrete params**, all optional, AND-combined:
  - `?family_name=jans` → `family_name ILIKE 'jans%'`
  - `?given_name=anna` → `given_name ILIKE 'anna%'`
  - `?birth_date=1985-03-12` → exact match
  - `?identifier=<value>` → exact match on `patient_identifiers.value` (any system) — short-circuits other filters when present (returns the at-most-one match)
  - Rationale: maps 1:1 to FHIR R4 `Patient?family=…&given=…&birthdate=…&identifier=…`. PoC FE controls how to compose params; HiX adapter MVP reuses same shape.
- `GET /patients/{id}` — single, 404 outside tenant.
- `POST /patients` — create (admin + caregiver). Body accepts identifiers inline. Supports manual entry today and future "enroll-from-HiX" flow (FE pulls HiX patient via adapter, then POSTs the projection).
- `PATCH /patients/{id}` — partial update of demographics only. PoC: 422 if body contains `identifiers`.
- `DELETE /patients/{id}` — soft delete (stamps `deleted_by`, `deleted_at`).

No bulk endpoints. No `/patients/{id}/identifiers` sub-resource in PoC.

### D8. Authorisation: build on org-aware guards, mark hardening points

Repo (after `organisations-base`) has `require_role(*roles)`, `CurrentUserDep`, `SessionUser`, and the org tree available via `OrganisationService`. Patients endpoints in THIS change use tenant-scope-only filtering — caregivers + admins in the tenant see all patients in the tenant. Care-team-based row filtering lands in `care-teams-base` as a MODIFIED delta on this capability.

PoC rules in this change:
- `Role` is now `admin | caregiver`. Both allowed on every `/patients` route via `require_role(Role.ADMIN, Role.CAREGIVER)`. (Externality is a property of the org tree, computed by predicates from `organisations-base`; not relevant until `care-teams-base` consumes it.)
- Tenant scope read from `CurrentUserDep.tenant_id`. Every query MUST filter on it.
- Cross-tenant reads return **404** (not 403) to avoid existence disclosure.

**Seam reserved**: a single FastAPI dependency `require_patient_access(patient_id)` is introduced; in this change body checks tenant only; `care-teams-base` swaps body to consult care-team participant rows + admin bypass.

Auth quality on the underlying session / role layer is known-shaky (scope of weakness TBD — see follow-up). Approach: wire current guards as the minimum bar, mark every auth surface with an `# AUTH-HARDEN` comment, and open separate follow-up tasks for the underlying hardening (tracked outside this change). `# AUTH-HARDEN` comments are grep-able for the cleanup pass.

### D9. Synthetic-INSZ generation in seed

`scripts/seed_patients.py` uses a fixed `random.Random(seed=2026)` to generate 10 demo patients with checksum-valid INSZ (Mod-97 on the 9-digit body, two-check-digit suffix). Birth dates land in 1940–2005 window. Names drawn from a tiny hand-picked list (Belgian-plausible, all clearly fictional: "Janssens", "De Vries", "Peeters", etc.). Comment in the file: "SYNTHETIC ONLY — see openspec/project.md no-PHI invariant."

### D10. Tests cover the seams, not just the happy path

- Migration test: fresh DB → table exists, indexes exist, enum types exist.
- Audit hook test: caregiver creates a patient → `created_by`, `tenant_id` auto-stamped from session actor.
- Tenant isolation test: tenant A's caregiver cannot read tenant B's patient (404, not 403, to avoid existence disclosure).
- INSZ validator test: malformed checksum → 422.
- Identifier unique test: same (system, value) under same patient → 400.
- Adapter import test: `from app.adapters.hix.patients import HixPatientAdapter` succeeds and raises on use.
- API contract test: OpenAPI lists 5 routes with expected response schemas.

## Risks / Trade-offs

- **[Risk] Denormalised name columns drift from `patient_names` table when MVP adds the table** → Mitigation: when the child table lands, the adapter is the single writer; row columns become "canonical display name" derived in the adapter. Document the rule in the spec at that time.
- **[Risk] Identifier table without tenant column → tenant leak via direct joins on `patient_identifiers`** → Mitigation: never query `patient_identifiers` standalone; always join through `patients` (which carries `tenant_id`). Add a CI lint candidate or repo-pattern rule. Documented in capability spec.
- **[Risk] FHIR-shape divergence**: if HiX returns gender codes outside the FHIR R4 administrative gender value set, the enum will reject. → Mitigation: adapter normalises unknown codes to `unknown` rather than failing. Documented in adapter docstring (MVP work).
- **[Risk] INSZ in DB even in PoC**: synthetic INSZ in a real DB still trains people to be casual with the column. → Mitigation: header comment on the column + `seed_patients.py`, plus a `BL-034` follow-up to add column-level encryption before any real-PHI deployment.
- **[Trade-off] Five endpoints for PoC** vs. read-only minimal. We chose write endpoints so caregivers can create demo subjects during the demo without DB access; cost is low (Pydantic + audit hook handles most of it).

## Migration Plan

1. Land Alembic revision adding enum types (`gender`, `patient_source`), `patients`, `patient_identifiers`, indexes.
2. Land ORM + schemas + API + adapter stub + seed script.
3. Run `seed_patients.py` in dev / CI test DB.
4. Regenerate OpenAPI; regenerate orchestrator client.
5. No rollback complexity — fresh tables, no migration of existing data. Downgrade drops both tables + enum types.

## Open Questions

- **OQ1 — INSZ encryption at rest in PoC**: do we accept plaintext for synthetic-only PoC and gate encryption behind the real-PHI switch, or build it now? Lean: defer to MVP under a tracked task; gain little from encrypting fake data.
- ~~**OQ2 — Search behaviour**~~: Resolved — discrete FHIR-aligned params `family_name` (prefix), `given_name` (prefix), `birth_date` (exact), `identifier` (exact, short-circuits).
- **OQ3 — Adapter contract DTO shape**: `PatientUpsertIn` not finalised. Defer to MVP HiX-integration proposal; PoC adapter raises `NotImplementedError` and exposes a type alias only.
- **OQ4 — List response shape (raw vs envelope)**: blocked on `feat/datatable-component` merge. Decide pagination envelope (`{ items, total, limit, offset }`) vs raw array before `/opsx:apply patients-base`.
