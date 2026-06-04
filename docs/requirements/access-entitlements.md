# REQ traceability — access-entitlements

Lastenboek source: `docs/diagrams/Lastenboek Telegeneeskunde-working version.xlsx`
(Functional + Non-Functional sheets). Mapping per `openspec/project.md` →
"REQ traceability". Spec deltas live in `openspec/changes/access-entitlements/specs/`
(applied to `openspec/specs/` at archive time).

| REQ | Requirement (short) | Module(s) | Tests |
|---|---|---|---|
| REQ-NON-8 | Therapeutic relationship check on every patient access + break-glass override | `app/services/access/permissions/deps.py` (`require_patient_relation`), `app/services/access/grants/break_glass_service.py`, `app/services/access/sync/{derive,sweep}.py`, OPL `Patient.{view,view_shielded,edit}` ∋ `break_glass` | `tests/api/routers/access/test_break_glass_api.py`, `tests/services/access/sync/test_entitlement_sync.py::test_break_glass_expiry_via_sweep`, `infra/ory/smoke.sh` |
| REQ-NON-10 | Specialism linkage decisive for carepath access | `pathway_specialisms` + `Carepath` namespace, `require_carepath_access`, `hidden_carepath_ids` (list mirror) | `tests/api/routers/access/test_carepath_scoping_api.py` |
| REQ-NON-12 | Explicit practitioner assignment narrows the specialism set | `derive.derive_carepath_tuples` (assigned-XOR-specialism), `pathway_practitioners`, `ScopingService.set_pathway_practitioners` | `tests/services/access/sync/test_entitlement_sync.py::test_assigned_xor_specialism_invariant`, smoke `carepath` block |
| REQ-NON-15 | Rights checked per login/access: roles + therapeutic relation + specialism + campus | Campuses = organisation rows in the `Organisation.parent` chain (no new mechanism); seeded by `scripts/seed_access_entitlements.py` | `tests/api/routers/patient/test_patient_keto_access.py` (org-ancestor), live demo checks (campus doctor) |
| REQ-FUN-28 | Provider ↔ one-or-more specialisms, admin-manageable | `specialisms`, `practitioner_role_specialisms`, `ScopingService`, `/admin/specialisms*` routes | `test_carepath_scoping_api.py::test_matching_specialism_grants_carepath` (multi-link seeded: demo caregiver = ortho + physio) |
| REQ-FUN-1 / REQ-FUN-42 | External professionals: scoped, consent-gated, role-based read/write/record/message | `external_access_profiles`, `external_grants`, `consents`, OPL verb relations, `require_patient_relation("edit")` on writes | `test_multi_role_and_verbs_api.py::test_external_verbs_read_but_not_write`, `test_tuple_sync.py::test_external_grant_derives_verbs_not_shielded` |
| REQ-FUN-161 | Selective shielding, default-deny, per-carepath/per-audience config, patient-initiated | `app/services/access/shielding/` (`ShieldingPolicy`, `apply_shielding`, `shielded_items`), `/admin/shielding-rules` | `tests/services/access/test_shielding_policy.py` |
| REQ-NON-3 / REQ-FUN-4 | Multiple roles per user, role chosen at login, role-scoped session, cross-role shielding | One Kratos identity per email → role-scoped `users` rows; `session_role_bindings`; `POST /auth/session/role`; 409 contract; orchestrator `RolePicker` + menu switch | `test_multi_role_and_verbs_api.py`, `apps/orchestrator/tests-e2e/multi-role-login.spec.ts` |

Deferred REQs are parked in `openspec/backlog.md`: REQ-FUN-145 → BL-068,
REQ-FUN-122/128–131/156 → BL-069, REQ-NON-5/6 → BL-070, REQ-FUN-3 (CSAM
mandates) → BL-071.
