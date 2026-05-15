## 0. Chain prerequisite

- [x] 0.1 Verify `organisations-base` change is APPLIED to the branch this patients-base implementation rebases onto; bail if not (see `openspec/changes/CHAIN.md`) — applied locally at commits `d039c7f`/`93a5dfc`/`165f21d`/`45d6f9f`/`73b28cb` on this worktree

## 1. Enums and core types

- [x] 1.1 Create `apps/backend/app/core/enums/patient.py` with `Gender` (FHIR R4 administrative-gender codes: `male|female|other|unknown`) and `PatientSource` (`local|hix|luscii`) enums; re-export from `app/core/enums/__init__.py`
- [x] 1.2 Create `app/core/identifiers.py` with constants: `INSZ_SYSTEM = "urn:oid:2.16.840.1.113883.2.8.4.1.1"` plus reserved placeholders `HIX_MRN_SYSTEM`, `HIX_FHIR_PATIENT_SYSTEM` (commented as MVP)
- [x] 1.3 Add Mod-97 INSZ checksum validator at `app/core/validators/insz.py`; unit tests cover valid, invalid checksum, wrong length, non-digit

## 2. ORM models

- [x] 2.1 Create `app/db/models/patient/patient.py` (`Patient(TenantOwnedEntity)`) with FHIR-shaped columns (`given_name`, `family_name`, `birth_date` nullable, `gender`) + `primary_organisation_id` FK → `organisations.id` (RESTRICT, NOT NULL) + sync columns (`source`, `external_system`, `external_ref`, `external_version`, `last_synced_at`) — repo convention is `app/db/models/<domain>/<domain>.py`, not `app/models/`
- [x] 2.2 Create `app/db/models/patient/patient_identifier.py` (`PatientIdentifier(AuditableEntity)`) with FK to `patients.id` ON DELETE CASCADE; columns `system`, `value`, `use`, audit timestamps, soft-delete
- [x] 2.3 Add `Patient.identifiers` relationship with `lazy="selectin"` + cascade `all, delete-orphan`
- [x] 2.4 Register both models in `app/db/models/__init__.py` so Alembic autogenerate sees them

## 3. Migration

- [x] 3.1 Created `alembic/versions/20260515_1400_patients_base.py` (hand-written; `gender` + `patient_source` Postgres enum types via `op.execute("CREATE TYPE ...")` to avoid SA `Enum.create()` collisions with `alembic_postgresql_enum` autogen helpers)
- [x] 3.2 Added `patients` table with all columns, FKs (audit FKs ON DELETE RESTRICT, `tenant_id` FK ON DELETE RESTRICT, `primary_organisation_id` FK RESTRICT), indexes on `(tenant_id)` and `(primary_organisation_id)`
- [x] 3.3 Added `patient_identifiers` table with FK CASCADE to patients, partial unique `uq_patient_identifiers_patient_system_value (patient_id, system, value) WHERE deleted_at IS NULL`, non-unique `(system, value)` lookup index
- [x] 3.4 Added partial unique `uq_patients_tenant_external (tenant_id, external_system, external_ref) WHERE external_ref IS NOT NULL AND deleted_at IS NULL`
- [x] 3.5 Added non-unique index `ix_patients_tenant_family_name (tenant_id, family_name)` for list search prefix path
- [x] 3.6 Downgrade drops indexes → tables → enum types in correct order (verified locally: `alembic downgrade 340430029268` leaves only `role` enum + non-patient tables)
- [ ] 3.7 Migration test: fresh DB → head → expected DDL present — deferred to follow-up (test suite still bootstraps via `Base.metadata.create_all`, not alembic; matches the deferral pattern from organisations-base 4.6)

## 4. Pydantic schemas

- [x] 4.1 Create `app/schemas/patient/patient_identifier.py` with `PatientIdentifierRead`, `PatientIdentifierCreate` (validator runs Mod-97 when `system == INSZ_SYSTEM`)
- [x] 4.2 Create `app/schemas/patient/patient.py` with `PatientRead`, `PatientCreate` (accepts identifiers inline), `PatientUpdate` (`extra="forbid"` rejects any field outside demographics → 422)
- [x] 4.3 Add `PatientListResponse` with pagination meta (`total`, `limit`, `offset`) + `items: list[PatientRead]`
- [x] 4.4 Schema unit tests: INSZ validator pass/fail, PATCH-rejects-identifiers, gender enum round-trip

## 5. Service layer

- [x] 5.1 Create `app/services/patient/__init__.py` and `app/services/patient/patient_service.py` (`PatientService`); repo at `app/repositories/patient/patient_repository.py` with `PatientFilters` dataclass
- [x] 5.2 Implement `list_in_tenant(tenant_id, filters, limit, offset)` with FHIR-aligned filters: `family_name` (ilike prefix), `given_name` (ilike prefix), `birth_date` (exact), `identifier` (exact any-system, short-circuits other filters); returns `(items, total)` for pagination meta
- [x] 5.3 Implement `get_by_id(tenant_id, patient_id)` → returns row or None (route translates to 404)
- [x] 5.4 Implement `create(actor, payload)` — patient + identifiers in one transaction; relies on audit hook for `created_by`/`updated_by`/`tenant_id`; cross-tenant `primary_organisation_id` rejected via `OrganisationRepository.get_by_id`
- [x] 5.5 Implement `update(actor, patient_id, payload)` — demographics only; raises `PatientIdentifiersImmutableError` if `identifiers` in payload (schema-level `extra="forbid"` already gives 422; service guard defends seeds/adapters)
- [x] 5.6 Implement `soft_delete(actor, patient_id)` — stamps `deleted_at`, `deleted_by` via `BaseRepository.soft_delete`
- [x] 5.7 Create `app/services/patient/deps.py` with `PatientServiceDep = Annotated[PatientService, Depends(...)]`; `require_patient_access` deferred to §6.8

## 6. Router

- [x] 6.1 Create `app/api/routers/patient/__init__.py` and `app/api/routers/patient/patient_router.py` (mirrors `organisation_router.py` shape: `tags=["patients"]`, `operation_id` per route)
- [x] 6.2 Implement `GET /patients` (`operation_id="list_patients"`) returning `PatientListResponse`, accepting `limit (1..100, default 25) / offset (>=0) / family_name / given_name / birth_date / identifier`
- [x] 6.3 Implement `GET /patients/{patient_id}` (`operation_id="get_patient"`) returning `PatientRead`; 404 outside tenant via `PatientAccessDep`
- [x] 6.4 Implement `POST /patients` (`operation_id="create_patient"`) returning `PatientRead`, status 201
- [x] 6.5 Implement `PATCH /patients/{patient_id}` (`operation_id="update_patient"`); schema `extra="forbid"` yields 422 on `identifiers`
- [x] 6.6 Implement `DELETE /patients/{patient_id}` (`operation_id="soft_delete_patient"`) status 204
- [x] 6.7 Apply `_CAREGIVER_OR_ADMIN_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))` (varargs primitive shipped by `organisations-base`); `# AUTH-HARDEN` comment beside every guard application
- [x] 6.8 Add `require_patient_access(patient_id)` FastAPI dependency in `app/services/patient/deps.py` — tenant-scope fetch raising `PatientNotFoundError` on miss; carries `# AUTH-HARDEN` + MVP-ACL TODO; exported as `PatientAccessDep`
- [x] 6.9 Register `patient_router` in `app/api/__init__.py` alongside existing routers

## 7. Adapter seam

- [x] 7.1 `app/adapters/hix/__init__.py` already existed (hosts `HixClient`/`HixStubClient`); added `app/adapters/hix/patients.py` and re-exported `HixPatientAdapter`
- [x] 7.2 Defined `HixPatientAdapter` class with `fetch(external_ref: str)` and `upsert_from_hix(payload)` methods raising `NotImplementedError("HiX patient adapter is MVP scope")`
- [x] 7.3 Added import + method-raises test at `tests/adapters/test_hix_patients_stub.py` (flat layout, matching existing `test_hix_stub.py` / `test_luscii_stub.py`; deviates from the `tests/adapters/hix/` suggested path)

## 8. Seed script

- [x] 8.1 Created `apps/backend/scripts/seed_patients.py` with "SYNTHETIC ONLY — see openspec/project.md no-PHI invariant" banner
- [x] 8.2 Implemented Mod-97-valid synthetic INSZ generator (`_synthetic_insz`) using `random.Random(2026)` over the post-2000 eHealth rule; verified all 10 cohort INSZs pass `is_valid_insz` host-side
- [x] 8.3 Inserts 10 demo patients into the `zas` tenant under `RUGREVAL_TEAM_ORG_ID`; sets `session.info[SESSION_ACTOR_KEY]` to a `SessionUser` built from the seeded caregiver so the audit hook stamps `tenant_id`/`created_by`/`updated_by`
- [x] 8.4 `external_system="seed"`, `external_ref=f"seed:patient:{n:02d}"`; idempotency check queries `(tenant_id, external_system, external_ref)` before insert, advancing the RNG to keep the INSZ stream deterministic across re-runs
- [x] 8.5 Wired `seed_patients` into `scripts/seed_all.py` AFTER `seed_organisations`
- [x] 8.6 Added `tests/scripts/test_seed_patients.py` covering cohort insert, INSZ validity, idempotency (run-twice row count == 10), and the two missing-prereq guards (deferred docker run for full pytest until daemon is up)

## 9. Integration tests

- [x] 9.1-9.5 Consolidated into `tests/api/routers/patient/test_patient_router.py` (+ `conftest.py`) matching repo convention (existing pattern is `tests/api/routers/<domain>/`, not flat `tests/api/test_*`). Covers pagination, family/given prefix, birth_date exact, identifier short-circuit, AND filter combo, tenant isolation, create (201 + identifier persisted), PATCH demographics OK / 422 on identifiers, soft-delete → 204 then 404, unauthenticated → 401, cross-tenant get → 404. `external` role 403 test omitted — role enum dropped `external` in `organisations-base`, no third role exists to deny
- [x] 9.6 `tests/db/test_patient_identifier_uniqueness.py`: same `(patient_id, system, value)` → `IntegrityError`; same value across two patients → OK
- [x] 9.7 `tests/db/test_patient_audit_hook.py`: actor in `session.info` → `tenant_id`/`created_by`/`updated_by` stamped on flushed patient
- [x] 9.8 AUTH-HARDEN marker check folded into `test_router_source_marks_auth_harden` inside `test_patient_router.py` (matches `organisation_router` pattern) instead of a separate `tests/source/` file
- [x] 9.9 `tests/db/test_patients_no_credentials.py`: asserts no `password*`, `auth_provider*`, `session_*`, `last_login*`, or `mfa_*` columns on `Patient.__table__`
- [x] 9.10 `tests/schemas/test_fhir_shape.py`: `INSZ_SYSTEM` URI-shaped, `Gender` values are FHIR R4 codes, `list_patients` signature exposes `family_name/given_name/birth_date/identifier`, gender JSON round-trip
- [x] 9.11 Run full pytest suite — `moon run backend:test` → 144 passed (fixed identifier-uniqueness test: stamp `created_by/updated_by` on `PatientIdentifier` rows + rollback after expected `IntegrityError` so the autouse `clean_tenants` TRUNCATE can run)

## 10. OpenAPI contract + frontend client

- [x] 10.1 Ran `moon run backend:openapi` → refreshed `apps/backend/openapi.json` with the 5 `patient` operations (verified `operationId` set: `list_patients`, `get_patient`, `create_patient`, `update_patient`, `soft_delete_patient`)
- [x] 10.2 Regenerated `apps/orchestrator/src/lib/api/schema.d.ts` via `npx openapi-typescript ../backend/openapi.json` (host moon task `orchestrator:typegen` points at a running backend on `localhost:18000`; Docker offline so used the static file path)
- [x] 10.3 Added `tests/api/test_patients_openapi_contract.py` asserting all 5 routes + `PatientListResponse`/`PatientRead` refs + 204 on delete
- [x] 10.4 Generated client diff staged for a dedicated commit alongside the backend regeneration (single regen pair: `openapi.json` + `schema.d.ts`, +345 LOC in the client)

## 11. Orchestrator patients overview UI (F4)

- [ ] 11.1 Add `src/modules/patient/api.ts` exporting the list query-key helper (`paginatedQueryKey('/patients', state)`) and a `softDeletePatient(id)` mutation that calls `DELETE /patients/{id}` and invalidates the `patients` key
- [ ] 11.2 Add `src/modules/patient/components/PatientsColumns.tsx` with `patientColumns: ColumnDef<PatientRead>[]` (Naam sticky, INSZ pill, Geboortedatum, Geslacht, Organisatie lookup, Bijgewerkt), `patientFilters: DataTableFilter<PatientRead>[]` (birth-date range + organisation select bound to `GET /organisations`), and a `patientRowActions(p)` factory exposing the destructive `Verwijderen` action
- [ ] 11.3 Add `src/modules/patient/types.ts` re-exporting `PatientRead` from the generated `lib/api/schema` as `PatientRow` (keeps the rest of the module schema-free)
- [ ] 11.4 Add `src/routes/_auth/patients/index.tsx` as a thin composer wiring `useRouteSearchTableState` + `usePaginatedQuery<PatientRead>('/patients', state)` into `<DataTable<PatientRead>>` with `realtimeTopic="patients"`, `selectable={false}`, the imports from §11.2, and the row-click navigator to `/_auth/patients/$patientId`
- [ ] 11.5 Add `src/routes/_auth/patients/$patientId/index.tsx` as a placeholder ("Detailpagina komt binnenkort") so row clicks never 404 before F5 lands
- [ ] 11.6 Add `src/i18n/locales/nl/patients.json` with all user-visible keys (page header, filter labels, kebab actions, empty / error / loading copy); zero inline Dutch literals in `.tsx`
- [ ] 11.7 File follow-up `BL-NNN — Create-patient dialog (POST /patients) for the overview` in `openspec/backlog.md` (deferred from this change to keep the PR scope tight; overview header ships without a create action)
- [ ] 11.8 `moon run orchestrator:typecheck` / `:lint` / `:test -- src/modules/patient src/routes/_auth/patients` all green; quote the result in the PR description

## 12. Docs, follow-ups, verification

- [ ] 12.1 At archive time: capability docs land at `openspec/specs/patients-base/` (deferred to archive step — `openspec-archive-change` skill handles the move)
- [x] 12.2 Added a `2026-05-15 — patients-base scope check` entry to `openspec/mdr-watchlist.md` confirming the row stores identifiers + demographics + sync metadata only; re-verify on any future column addition
- [x] 12.3 Filed follow-up `BL-051 — AUTH-HARDEN sweep` in `openspec/backlog.md` (renumbered after merging origin/main which had already claimed BL-042..BL-045 for auth-compliance gaps)
- [x] 12.4 Filed follow-up `BL-052 — Patient identifier column encryption` in `openspec/backlog.md` (gated by `BL-034`)
- [x] 12.5 Filed follow-up `BL-053 — Patient-level ACL wiring on require_patient_access` in `openspec/backlog.md` (deepens `BL-020` for patients)
- [x] 12.6 Filed follow-up `BL-054 — Patient names / addresses / telecoms child tables` in `openspec/backlog.md` (lands alongside the HiX adapter, BL-001)
- [x] 12.7 `moon run backend:format` / `:lint` / `:typecheck` / `:test` all green (`backend:test` → 144 passed in 12.97s)
- [x] 12.8 `moon run orchestrator:typecheck` green; `moon run orchestrator:build` fails for environment reasons (Node 20.18 < required 20.19 + missing `@rolldown/binding-darwin-arm64` native binding); blocker is unrelated to this change (cf. commit `4b02bd2`) — re-run on a clean install before merging
- [x] 12.9 `npx openspec validate patients-base --strict` → `Change 'patients-base' is valid`
