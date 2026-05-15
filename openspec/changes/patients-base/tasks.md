## 0. Chain prerequisite

- [ ] 0.1 Verify `organisations-base` change is APPLIED to the branch this patients-base implementation rebases onto; bail if not (see `openspec/changes/CHAIN.md`)

## 1. Enums and core types

- [ ] 1.1 Create `apps/backend/app/core/enums/patient.py` with `Gender` (FHIR R4 administrative-gender codes: `male|female|other|unknown`) and `PatientSource` (`local|hix|luscii`) enums; re-export from `app/core/enums/__init__.py`
- [ ] 1.2 Create `app/core/identifiers.py` with constants: `INSZ_SYSTEM = "urn:oid:2.16.840.1.113883.2.8.4.1.1"` plus reserved placeholders `HIX_MRN_SYSTEM`, `HIX_FHIR_PATIENT_SYSTEM` (commented as MVP)
- [ ] 1.3 Add Mod-97 INSZ checksum validator at `app/core/validators/insz.py`; unit tests cover valid, invalid checksum, wrong length, non-digit

## 2. ORM models

- [ ] 2.1 Create `app/models/patient.py` (`Patient(TenantOwnedEntity)`) with FHIR-shaped columns (`given_name`, `family_name`, `birth_date` nullable, `gender`) + `primary_organisation_id` FK → `organisations.id` (RESTRICT, NOT NULL) + sync columns (`source`, `external_system`, `external_ref`, `external_version`, `last_synced_at`)
- [ ] 2.2 Create `app/models/patient_identifier.py` (`PatientIdentifier`) with FK to `patients.id` ON DELETE CASCADE; columns `system`, `value`, `use`, audit timestamps, soft-delete
- [ ] 2.3 Add `Patient.identifiers` relationship with `selectinload` default + cascade `all, delete-orphan`
- [ ] 2.4 Register both models in the SQLAlchemy metadata import root so Alembic autogenerate sees them

## 3. Migration

- [ ] 3.1 Generate Alembic revision creating `gender` + `patient_source` Postgres enum types
- [ ] 3.2 Add `patients` table with all columns, FKs (audit FKs ON DELETE RESTRICT, `tenant_id` FK ON DELETE RESTRICT), and indexes
- [ ] 3.3 Add `patient_identifiers` table with FK CASCADE to patients, partial unique `(patient_id, system, value) WHERE deleted_at IS NULL`
- [ ] 3.4 Add partial unique `(tenant_id, external_system, external_ref) WHERE external_ref IS NOT NULL AND deleted_at IS NULL` on `patients`
- [ ] 3.5 Add non-unique index on `patients(tenant_id, family_name)` for list search prefix path
- [ ] 3.6 Verify downgrade drops tables, indexes, enum types in correct order
- [ ] 3.7 Migration test: fresh DB → head → expected DDL present (extend existing migration test pattern)

## 4. Pydantic schemas

- [ ] 4.1 Create `app/schemas/patient/patient_identifier.py` with `PatientIdentifierRead`, `PatientIdentifierCreate` (validator runs Mod-97 when `system == INSZ_SYSTEM`)
- [ ] 4.2 Create `app/schemas/patient/patient.py` with `PatientRead`, `PatientCreate` (accepts identifiers inline), `PatientUpdate` (model_config rejects `identifiers` field → 422)
- [ ] 4.3 Add `PatientListResponse` with pagination meta (`total`, `limit`, `offset`) + `items: list[PatientRead]`
- [ ] 4.4 Schema unit tests: INSZ validator pass/fail, PATCH-rejects-identifiers, gender enum round-trip

## 5. Service layer

- [ ] 5.1 Create `app/services/patient/__init__.py` and `app/services/patient/patient_service.py` (`PatientService`)
- [ ] 5.2 Implement `list_in_tenant(tenant_id, filters, limit, offset)` with FHIR-aligned filters: `family_name`, `given_name`, `birth_date`, `identifier`; identifier short-circuits other filters
- [ ] 5.3 Implement `get_by_id(tenant_id, patient_id)` → returns row or None (route translates to 404)
- [ ] 5.4 Implement `create(actor, payload)` — patient + identifiers in one transaction; relies on audit hook for `created_by`/`updated_by`/`tenant_id`
- [ ] 5.5 Implement `update(actor, patient_id, payload)` — demographics only; raise typed error if identifiers present (route maps to 422)
- [ ] 5.6 Implement `soft_delete(actor, patient_id)` — stamps `deleted_at`, `deleted_by`
- [ ] 5.7 Create `app/services/patient/deps.py` with `PatientServiceDep = Annotated[PatientService, Depends(...)]`

## 6. Router

- [ ] 6.1 Create `app/api/routers/patient/__init__.py` and `app/api/routers/patient/patient_router.py` (mirrors `user_router.py` shape: `tags=["patients"]`, `operation_id` per route)
- [ ] 6.2 Implement `GET /patients` (`operation_id="list_patients"`) returning `PatientListResponse`, accepting `limit/offset/family_name/given_name/birth_date/identifier`
- [ ] 6.3 Implement `GET /patients/{id}` (`operation_id="get_patient"`) returning `PatientRead`; 404 outside tenant
- [ ] 6.4 Implement `POST /patients` (`operation_id="create_patient"`) returning `PatientRead`, status 201
- [ ] 6.5 Implement `PATCH /patients/{id}` (`operation_id="update_patient"`); 422 if `identifiers` in body
- [ ] 6.6 Implement `DELETE /patients/{id}` (`operation_id="soft_delete_patient"`) status 204
- [ ] 6.7 Apply `_CAREGIVER_OR_ADMIN_GUARD = Depends(require_role(Role.ADMIN, Role.CAREGIVER))` (varargs primitive shipped by `organisations-base`); add `# AUTH-HARDEN` comment beside every guard application
- [ ] 6.8 Add `require_patient_access(patient_id)` FastAPI dependency in `app/services/patient/deps.py` — PoC body: tenant scope check only; carries `# AUTH-HARDEN` + MVP-ACL TODO
- [ ] 6.9 Register `patient_router` in `app/api/__init__.py` alongside existing routers

## 7. Adapter seam

- [ ] 7.1 Create `app/adapters/hix/__init__.py` and `app/adapters/hix/patients.py`
- [ ] 7.2 Define `HixPatientAdapter` class with `fetch(external_ref: str)` and `upsert_from_hix(payload)` methods raising `NotImplementedError("HiX patient adapter is MVP scope")`
- [ ] 7.3 Add adapter import-test + method-raises test under `tests/adapters/hix/test_patients_stub.py`

## 8. Seed script

- [ ] 8.1 Create `scripts/seed_patients.py` with header comment "SYNTHETIC ONLY — see openspec/project.md no-PHI invariant"
- [ ] 8.2 Implement Mod-97-valid synthetic INSZ generator using `random.Random(seed=2026)` for determinism
- [ ] 8.3 Insert ~10 demo patients into the default tenant, each with `primary_organisation_id` referencing the demo `Rugrevalidatie` program org seeded by `organisations-base`, after setting `session.info[SESSION_ACTOR_KEY]` to the seeded caregiver
- [ ] 8.4 Use deterministic `external_ref` per patient (e.g. `seed:patient:<n>`); second run MUST NOT duplicate
- [ ] 8.5 Wire seed entry into `scripts/seed_all.py` (or equivalent) AFTER `seed_users.py`
- [ ] 8.6 Seed script test: run twice → row count stable; all INSZ values validate

## 9. Integration tests

- [ ] 9.1 `tests/api/test_patients_list.py`: pagination, `family_name` prefix, `given_name` prefix, `birth_date` exact, `identifier` short-circuit, AND combination, tenant isolation
- [ ] 9.2 `tests/api/test_patients_create.py`: caregiver creates with INSZ → 201, audit cols stamped, identifier persisted
- [ ] 9.3 `tests/api/test_patients_update.py`: PATCH demographics OK; PATCH with `identifiers` → 422
- [ ] 9.4 `tests/api/test_patients_delete.py`: soft delete sets `deleted_at` + `deleted_by`; subsequent GET → 404
- [ ] 9.5 `tests/api/test_patients_authz.py`: external role → 403; cross-tenant read → 404 (not 403); unauthenticated → 401
- [ ] 9.6 `tests/db/test_patient_identifier_uniqueness.py`: same (system, value) per patient → integrity error; same value across patients → OK
- [ ] 9.7 `tests/db/test_patient_audit_hook.py`: insert via session with actor → audit cols stamped
- [ ] 9.8 `tests/source/test_auth_harden_markers.py`: grep `app/api/routers/patient/patient_router.py` — every guarded route MUST carry `# AUTH-HARDEN`
- [ ] 9.9 `tests/db/test_patients_no_credentials.py`: assert `patients` table has no `password_hash`, `auth_provider_sub`, `session_*`, `last_login_at`, or `mfa_*` columns
- [ ] 9.10 `tests/schemas/test_fhir_shape.py`: identifier `system` must be URI-formatted; gender enum strictly FHIR codes; search params expose `family_name/given_name/birth_date/identifier` named per FHIR mapping

## 10. OpenAPI contract + frontend client

- [ ] 10.1 Regenerate OpenAPI schema export (`apps/backend` build step)
- [ ] 10.2 Regenerate orchestrator typed client from OpenAPI in `apps/orchestrator`
- [ ] 10.3 Contract test: 5 patient routes present with expected request/response shapes
- [ ] 10.4 Commit generated client diff in its own commit (per repo convention)

## 11. Docs, follow-ups, verification

- [ ] 11.1 At archive time: capability docs land at `openspec/specs/patients-base/`
- [ ] 11.2 Add line to `openspec/mdr-watchlist.md` confirming `patients-base` stores identifiers + demographics only — re-verify on any future field addition
- [ ] 11.3 Open follow-up: auth hardening pass (sweep `# AUTH-HARDEN` markers once auth surface scope is determined)
- [ ] 11.4 Open follow-up: INSZ column encryption before any real-PHI deployment (gated by `BL-034`)
- [ ] 11.5 Open follow-up: patient-level ACL (`BL-010`) wiring on `require_patient_access`
- [ ] 11.6 Open follow-up: `patient_names` / `addresses` / `telecoms` child tables when HiX adapter lands
- [ ] 11.7 Run `apps/backend` test + lint + type-check; quote results
- [ ] 11.8 Run `apps/orchestrator` build + type-check after client regen; quote results
- [ ] 11.9 `openspec validate patients-base --strict` clean
