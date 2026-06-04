# Tasks — access-entitlements

> Depends on `access-management-ory` (PR #36) being merged. Archive order:
> parent change first, then this one.

## 1. Schema & master data

> 1.1–1.6 consolidated into a single autogen revision `e5f48e021dbe` (`20260604_1435_access_entitlements_tables.py`) — one dependency-ordered create set + the specialty backfill; six separate revisions added ceremony without value.

- [x] 1.1 Alembic revision: `specialisms`, `practitioner_role_specialisms` (+ backfill of free-text `practitioner_roles.specialty` into the link table in the same revision)
- [x] 1.2 Alembic revision: `pathway_specialisms`, `pathway_practitioners`
- [x] 1.3 Alembic revision: `consents`, `external_access_profiles`, `external_grants`
- [x] 1.4 Alembic revision: `access_grants` (break-glass) with reason NOT NULL + expires_at NOT NULL
- [x] 1.5 Alembic revision: `shielding_rules`, `shielded_items`
- [x] 1.6 Alembic revision: `session_role_bindings`; widen `external_identities` uniqueness to `(tenant_id, idp, external_subject, user_id)`
- [x] 1.7 SQLAlchemy models + `models/__init__.py` registration for all of the above

## 2. OPL & derivation

- [x] 2.1 Extend `infra/ory/keto/namespaces.keto.ts`: `Specialism`, `Carepath`, `Patient` verb relations + `break_glass`; permits per `keto-authz` delta; cross-pointer comments to `derive.py`
- [x] 2.2 `derive.py`: specialism membership (`Specialism#practitioner` from open roles × link table)
- [x] 2.3 `derive.py`: carepath tuples with the assigned-XOR-specialism emission rule (REQ-NON-12)
- [x] 2.4 `derive.py`: `Patient#break_glass` from open unexpired grants; verb tuples from `external_grants` ∩ active consent ∩ type profile
- [x] 2.5 `outbox.py`: extend `_affected_objects` for all new source tables; remove `Patient#external_carer` from `EXTERNAL_RELATIONS`
- [x] 2.6 Expiry sweep: in-process loop enqueuing outbox rows for expired break-glass grants and lapsed external grant periods
- [x] 2.7 `FakeKetoClient`: evaluate the extended permits in the in-memory graph
- [x] 2.8 One-shot backfill script: `external_carer` tuples → `external_grants` + `consents`; document required ordering before first reconcile

## 3. Therapeutic access & break-glass

- [x] 3.1 `POST /patients/{id}/access-grants` (reason required, duration capped by `authz_break_glass_max_hours` setting) + outbox in one transaction
- [x] 3.2 `GET /admin/access-grants?active=true` admin listing; revoke endpoint
- [x] 3.3 Guard integration: break-glass grant id surfaces in audit context for requests it enables
- [ ] 3.4 Orchestrator: break-glass affordance with reason capture on the patient-blocked path; admin grants list view

## 4. Carepath scoping

- [x] 4.1 `require_carepath_access` dependency in `app/services/access/permissions/`; wire pathway detail/mutation routes (admin short-circuit, 404 deny, flag-off no-op)
- [x] 4.2 Carepath list scoping in SQL from specialism links + explicit assignments (mirror of patient-list pattern)
- [x] 4.3 Admin CRUD: specialisms, role↔specialism links, carepath↔specialism links, per-carepath practitioner assignment
- [ ] 4.4 Orchestrator: specialism management UI on practitioner-role admin; carepath link config in builder settings

## 5. External collaboration

- [x] 5.1 `external_access_profiles` admin CRUD (verbs per professional type)
- [x] 5.2 External grant endpoints (create with consent reference, end); consent record create/revoke (minimal — full IC flow stays BL-017)
- [x] 5.3 Verb guards: map route verbs to `Patient.{view,edit,record,message}` permits in `check_patient_permission`
- [x] 5.4 Run/verify backfill (2.8) in dev + demo env

## 6. Shielding config

- [x] 6.1 `shielding.is_released(category, audience, carepath)` policy service with default-deny + carepath-over-global precedence
- [x] 6.2 Serializer wiring: patient-scoped payload shaping passes through the policy service for non-`view_shielded` subjects; structural omission (no shielded values serialized) — *the PoC API serializes none of the five categories yet; `apply_shielding` is the mandatory wiring point for the MVP surfaces (questionnaires/diary) and is unit-tested for default-deny + precedence*
- [x] 6.3 `shielded_items` model-level support in the policy service
- [x] 6.4 Admin CRUD for `shielding_rules` (audit-attributed)

## 7. Multi-role login

- [x] 7.1 Import script: group user rows by email → one Kratos identity, multiple `external_identities` links
- [x] 7.2 `authenticate_password`: resolve roster; auto-bind single-row; `requires_role_selection` response for multi-row
- [x] 7.3 `POST /auth/session/role`: write/rewrite `session_role_bindings`, audit old/new role; 409 contract on unbound protected routes
- [x] 7.4 `resolve_actor_from_request`: cookie → whoami → roster → binding → user row; deactivated bound row → 401 + revocation queue
- [ ] 7.5 Orchestrator: role picker on `requires_role_selection`, 409 interception preserving destination, active-role display + switch in user menu
- [x] 7.6 `FakeKratosClient`: multi-row roster support

## 8. Seeds & demo data

- [x] 8.1 Seed specialisms + role links (incl. one multi-specialism practitioner); ZAS campuses as child organisations with campus-level roles
- [x] 8.2 Seed carepath↔specialism links (Rugrevalidatie → its specialism) + one explicitly-assigned carepath
- [x] 8.3 Seed external professional with partial verbs + active consent; one shielding release rule + one default-deny demo case
- [x] 8.4 Seed a multi-role human (caregiver + admin) wired through the grouped Kratos import

## 9. Tests & smoke

- [x] 9.1 Sync tests: new derivations, assigned-XOR-specialism invariant, sweep expiry, consent revocation cascade, backfill survival
- [x] 9.2 API tests: carepath 404 for wrong specialism, break-glass grant/expiry, verb separation, shielding shape filtering, multi-role 409/binding/switch
- [ ] 9.3 Orchestrator tests: role picker paths (single-role unchanged, multi-role picks), break-glass affordance
- [x] 9.4 Extend `infra/ory/smoke.sh`: Carepath check, verb tuples, break-glass tuple lifecycle
- [ ] 9.5 `/verify` green on backend + orchestrator; e2e covers multi-role login

## 10. Docs & ledger

- [ ] 10.1 Update `apps/backend/AGENTS.md` access-plane section (new namespaces, sweep, policy service, binding)
- [ ] 10.2 `openspec/scope.md`: F12 entry + mocks/delta rows; `backlog.md`: BL entries for deferred slices (retention windows, audit dashboard, SCIM/IAM) — done at proposal time, re-verify
- [ ] 10.3 REQ traceability: map REQ-NON-8/10/12/15, REQ-FUN-1/4/28/42/161, REQ-NON-3 → modules + tests under `docs/requirements/`
- [ ] 10.4 Archive after merge: apply deltas to `openspec/specs/` (after `access-management-ory` archives first)
