## 0. Prerequisites

- [ ] 0.1 Confirm every `Role` enum read site (grep `Role.ADMIN`, `Role.CAREGIVER`, `Role.PATIENT`, `require_role`, `role ==`) across backend + mobile + orchestrator; list them as the migration target set
- [ ] 0.2 Confirm the actor shape carries enough to resolve the bound role (`SessionUser`) and where the Keto bypass lives (`app/services/patient/deps.py`)
- [ ] 0.3 Confirm `multi-role-login` uniqueness + session-binding code paths that key on the enum
- [ ] 0.4 Confirm mobile patient-login path reads (`role == "patient"` / `users.patient_id`) so they can move to the `patient_id` check (no `patient` role exists)

## 1. Permission catalog

- [x] 1.1 Create `app/core/enums/permission.py::Permission(StrEnum)` with the `resource.action` catalog (D3): canonical CRUD verbs `create/read/update/delete` (no synonyms) + domain verbs (`request`/`oversee`/`manageRuntime`), no wildcard; re-export from `app/core/enums/__init__.py`. Added `CROWN_PERMISSIONS` set.
- [ ] 1.2 Conformance test: every catalog slug is referenced by at least one backend guard, or explicitly listed as frontend-only (R6)

## 2. RBAC models + migration

- [x] 2.1 `app/db/models/access/role.py::Role` table (tenant-scoped: `slug`, `name`, `is_system`; inherits `TenantOwnedEntity`; unique `(tenant_id, slug)`; `__audited__`) — D2
- [x] 2.2 `app/db/models/access/role_permission.py::RolePermission` (`role_id` FK CASCADE, `permission` text catalog-validated, composite PK `(role_id, permission)`) — D4
- [x] 2.3 Register in `app/db/models/__init__.py` (+ `access/__init__.py`)
- [ ] 2.4 Alembic migration (D9): create tables; seed `admin` (full catalog) + `default` (`breakGlass.request` only) per tenant; add `users.role_id` nullable, backfill (enum `admin`→`admin` role, everyone else→`default`), set NOT NULL; drop `users.role` + the `role` pg enum; switch `multi-role-login` uniqueness to partial indexes — `UNIQUE (tenant_id, email, role_id) WHERE patient_id IS NULL` + `UNIQUE (tenant_id, email) WHERE patient_id IS NOT NULL`; emit operator note (R1)
- [ ] 2.5 Test: fresh migrate → tables + seeds exist; backfill maps `admin`→`admin` role and all others→`default`; admin user holds `admin`; patient/mobile path intact
- [ ] 2.6 Tenant provisioning (`tenant-base`): seed `admin` + `default` on tenant creation; bind the bootstrap admin to `admin` (D15)
- [ ] 2.7 Test: a newly provisioned tenant has both roles + an admin-bound bootstrap user
- [ ] 2.8 Seed scripts (D17): `seed_users.py`/`seed_practitioners.py` move to `role_id`; seed one admin user + `admin` role + `default`; seed patients (with `patient_id`); REMOVE Luscii data seeding

## 3. Effective permissions + guard

- [ ] 3.1 `app/services/access/rbac/resolver.py::effective_permissions(user) -> frozenset[str]` (`admin` role → full catalog) — D6
- [ ] 3.2 `app/services/access/rbac/deps.py::require_permission(slug)` dependency (403 when slug absent) — D6
- [ ] 3.3 Swap the Keto bypass in `app/services/patient/deps.py`: `Role.ADMIN` → `"patient.accessAll" in effective_permissions(...)` — D1/D6
- [ ] 3.4 Re-point `require_role(...)` call sites per the D12 boundary: config/admin + app-action routes → `require_permission(slug)`; patient-data routes stay authenticated + Keto with NO RBAC permission (do not add a slug); mobile patient routes guard on `users.patient_id IS NOT NULL` (D16)
- [ ] 3.5 Tests: permission present/absent → allow/deny; `default`-role caregiver keeps Keto patient access but is denied admin routes (D12); patient.accessAll reproduces the old admin bypass (re-run keto-access suite on the permission path — R4); mobile patient login unaffected via `patient_id` (R5)

## 4. Role-management service + escalation guard

- [ ] 4.1 `app/services/access/rbac/role_service.py` — roles CRUD + assignment, tenant-scoped
- [ ] 4.2 Role-edit escalation guard (D7): no-amplification (can't grant a permission the actor lacks); `patient.accessAll` + `role.*` writes admin-only to grant; `is_system` roles admin-only to edit, never deletable
- [ ] 4.3 Tests: actor able to edit roles cannot self-grant `patient.accessAll`/`role.*` writes; cannot grant a permission it lacks; non-admin cannot edit `is_system` role; system role undeletable
- [ ] 4.4 User→role assignment guard (D7a): assign gated by `user.update`/`role.update`; crown floor — assigning the `admin` role or any `patient.accessAll`-holding role is admin-only; normal roles need only the assign permission (no subset check)
- [ ] 4.5 Role deletion safety (D13): `ON DELETE RESTRICT` on `users.role_id`; block delete while members exist; allow purge of an empty non-system role + its `role_permissions`
- [ ] 4.6 Last-admin safeguard (D14): reject any op leaving a tenant with zero admin-capable users (delete/edit-away `admin` role, unbind last admin)
- [ ] 4.7 Tests: non-admin cannot self-assign the `admin` role (crown floor); normal role assignment needs only the permission; delete-with-members rejected; empty role purged; last-admin removal rejected

## 5. Role-management API

- [ ] 5.1 Router under `/roles`: list/create/edit/delete (guarded by `role.read`/`role.create`/`role.update`/`role.delete`); assign-role-to-user (guarded by `user.update`/`role.update` + crown floor)
- [ ] 5.2 Permission-catalog read endpoint (so the UI can render the matrix)
- [ ] 5.3 Tests: CRUD happy paths + guard denials; cross-tenant 404

## 6. Audit

- [ ] 6.1 Role create/update/delete + permission-assignment + role-to-user assignment emit audit events (D11) via `audit-trail-base`
- [ ] 6.2 Tests: each management action produces an audit row attributing actor + change

## 7. Session permissions API (Phase 2)

- [ ] 7.1 Add `permissions: list[str]` (effective slugs) + role `slug` to the session / `/auth/me` payload
- [ ] 7.2 Regenerate `openapi.json` + orchestrator typed client
- [ ] 7.3 Test: session payload carries the bound role's effective permissions

## 8. Frontend gating (Phase 3)

- [ ] 8.1 `apps/orchestrator/src/modules/auth/permissions.ts`: drop static `ROLE_CAPABILITIES`; `can(slug)`/`useCan(slug)` read session `permissions`; remove stale `external` role literal; role → slug
- [ ] 8.2 Route guards on admin management pages; action-button gating off `can(...)`; refetch session permissions on navigation (D10a)
- [ ] 8.3 Tests: gated route redirects without the slug; gated button hidden without the slug; permissions refresh on navigation after a role change

## 9. Admin UI (Phase 4)

- [ ] 9.1 Roles list/create/edit/delete UI
- [ ] 9.2 Permission-toggle matrix (catalog × role), respecting the escalation guard (disable crown-jewel toggles for non-admins)
- [ ] 9.3 Assign-role-to-user on the users-admin surface (crown-role assignment hidden for non-admins)
- [ ] 9.4 i18n (nl) strings; tests

## 10. Verification

- [ ] 10.1 `/verify` backend + orchestrator (lint + typecheck + tests)
- [ ] 10.2 Manual: deploy sequence rehearsal — migrate → non-admins keep patient care + break-glass, admin grants `default` role its app-action slugs → admin surfaces restored
- [ ] 10.3 Grep sweep: no remaining `Role` enum literals / `require_role` references
