**Tier**: [poc]
**Promotes**: a configurable role-based access-control layer for app functions — admins define roles and assign permissions, instead of the fixed `admin | caregiver | patient` enum.

## Why

Authorization today has two halves:

- **Keto ReBAC** governs per-patient **data** access (care-team participation, treating-org chain, break-glass) — relation tuples derived from Postgres. This is solid and stays.
- **App-function access** (which screens and actions a user may use) is a fixed `Role` Postgres enum (`admin | caregiver | patient`) checked by `require_role(...)` on the backend and a near-empty `ROLE_CAPABILITIES` map on the frontend (two capabilities, used in one component, with a stale `external` role).

The fixed enum cannot express the workforce reality: a tenant wants its own roles (e.g. "ward nurse", "scheduler", "read-only auditor") with tailored permission sets, editable without a code change and migration. The product needs **admins to define roles and set their permissions**.

This change replaces the fixed `Role` enum with a dynamic, tenant-scoped RBAC layer: roles are data, permissions are a code-defined catalog, and the assignment between them is admin-editable. A role is purely a **permission bundle** — clinical identity-types (patient / caregiver / external) are derived from data, not from the role. Keto is untouched as the data-access layer; the only seam between them is the former `Role.ADMIN` Keto bypass, which becomes the `patient.accessAll` permission.

## What Changes

### New backend capability — `rbac-roles`

- **New tables**:
  - `roles` — tenant-scoped: `id`, `tenant_id`, `slug`, `name`, `is_system`, audit columns. `is_system` marks seeded, undeletable roles.
  - `role_permissions` — M:N between a role and a permission slug (text, catalog-validated at the write boundary; not a Postgres enum — migration-free, as with the audit `resource_type`).
- **Code-defined permission catalog** — a `Permission` registry in `app/core/enums/permission.py` (StrEnum), each entry a `resource.action` slug (standard RBAC shape) mapping to a real route/action guard. Canonical CRUD verbs (`create/read/update/delete`, no synonyms) plus domain verbs where real (`request`, `oversee`, `manageRuntime`); no wildcard. RBAC gates config/admin resources + app actions only — patient *data* verbs stay in Keto. Resources: `organisation`, `user`, `role`, `practitionerRole`, `shieldingRule`, `breakGlass`, `pathway`, `audit`, `patient.accessAll` (the Keto bypass).
- **`users.role` enum → `users.role_id` FK** — one user row per role preserved; the row points at a `roles` row instead of carrying an enum value.
- **Two seeded roles only** (`is_system`, undeletable):
  - `admin` — holds every permission incl. `patient.accessAll`; the bootstrap that can manage roles. Existing `admin`-enum users map here.
  - `default` — holds only `breakGlass.request` (so caregivers keep emergency access day one), otherwise empty. **Every** existing non-admin user (former caregivers, patients, externals) maps here.
  - No `patient` / `caregiver` / `external` roles — those identities are **derived**: patient = `users.patient_id` set; caregiver = has a `Practitioner` row; external = org-tree derivation.
- **Enforcement swap** — `require_permission(slug)` replaces `require_role(...)` at config/admin + app-action routes. The `Role.ADMIN` short-circuit in `app/services/patient/deps.py` becomes a `patient.accessAll` check (Keto bypass preserved). Patient-data routes stay authenticated + Keto. Patient (mobile) routes identify the patient via `users.patient_id`, not a role.
- **Privilege-escalation guards** — (a) editing a role MUST NOT grant a permission the actor lacks, and `patient.accessAll` + `role.*` writes are admin-only; (b) assigning a user to the `admin` role or any `patient.accessAll`-holding role is admin-only (the crown floor) — normal role assignment needs only the assign permission. `is_system` roles are editable only by admins.
- **Lifecycle safety** — role delete blocked while members exist (`ON DELETE RESTRICT`), purge once empty; the last admin in a tenant cannot be removed.
- **Audit** — role create/update/delete, permission-assignment changes, and role-to-user assignment recorded through the existing audit service (`audit-trail-base`).
- **Seed scripts** — updated to seed one admin user + the `admin` role (and `default`), seed patients, and **remove the Luscii data seeding** (bundled in this change).

### Modified capabilities

- **`keto-authz`** — the patient-access guard's admin bypass changes from `Role.ADMIN` to `patient.accessAll`. Relation model and permits unchanged.
- **`multi-role-login`** — the per-role user row carries `role_id` (FK) instead of the enum; session binding, role selection, actor resolution otherwise unchanged. "Role" in the login response becomes the role slug.
- **`practitioner-role-split`** — caregiver identity is "has a Practitioner row"; admin-role and patient users may not have one. Guards move to `require_permission`.
- **`user-base`** — the user model drops the `role` enum column for a `role_id` FK; the `Role` enum requirement is removed.

### Frontend

- The session API returns the caller's **effective permission slugs** + role slug; `permissions.ts` replaces the static `ROLE_CAPABILITIES` with session permissions, exposing `can(slug)` / `useCan(slug)`. Permissions refetched on navigation.
- Route gating (admin management pages) and action-button gating wired off `can(...)`. Stale frontend `Role` type aligned.
- **Admin UI** — roles CRUD + a permission-toggle matrix + assign-role-to-user.

## Capabilities

### Added Capabilities

- `rbac-roles` — tenant-scoped `roles` + `role_permissions`; code-defined `resource.action` catalog; `users.role_id` FK (one-row-per-role preserved); seeded `admin` + `default` roles (identity-types derived from data, not roles); `require_permission(slug)` guard; role-edit + assignment escalation guards (crown floor); delete/last-admin lifecycle safety; effective-permissions resolution exposed to the client; audit of role/permission/assignment changes; admin roles-management API + UI; seed-script update incl. Luscii-seeding removal.

### Modified Capabilities

- `keto-authz` — admin bypass becomes the `patient.accessAll` permission.
- `multi-role-login` — per-role user row keys on `role_id`; login response carries the role slug.
- `practitioner-role-split` — caregiver identity derived from the Practitioner row; guards move to permissions.
- `user-base` — `users.role` enum → `users.role_id` FK; `Role` enum removed.

## Impact

- **DB**: two new tables (`roles`, `role_permissions`); `users.role` enum column → `users.role_id` FK; drop the `role` Postgres enum type. One alembic migration with a data step (map enum `admin`→`admin` role, everyone else→`default`, backfill `role_id`).
- **Backend** (`apps/backend/app/`): new `core/enums/permission.py`; `db/models/access/role.py` + `role_permission.py`; `services/access/rbac/` (catalog, resolver, `require_permission`, escalation + assignment guards, lifecycle safety); rewrite `require_role` call sites; swap the Keto bypass; patient-id mobile guard; role-management router + service; tenant-provisioning seeding; audit hooks.
- **Seeds**: `scripts/seed_users.py` / `seed_practitioners.py` move to `role_id`; seed one admin + `admin` role + `default`; seed patients; **remove Luscii data seeding**.
- **Mobile**: patient login preserved (identity via `patient_id`); grep + convert any enum-literal `role == "patient"` reads.
- **Frontend** (`apps/orchestrator/`): session schema gains `permissions[]` + role slug; `permissions.ts` rewrite; route/button gating; refetch-on-navigation; admin roles UI; align `Role` types.
- **OpenAPI / typed client**: regenerated (role-management operations + `permissions[]` on the session payload).

## Risks and mitigations

- **R1 — `default` role mostly empty on deploy.** Non-admins keep patient care (Keto) and emergency break-glass (`default` carries `breakGlass.request`); only admin/app-action surfaces wait on an admin granting slugs. **Mitigation**: documented post-migration admin step; operator note in migration.
- **R2 — Escalation via role edit.** **Mitigation**: no-amplification + `patient.accessAll`/`role.*` writes admin-only (D7).
- **R2a — Escalation via role assignment.** Self-assigning the existing `admin` role bypasses the edit guard. **Mitigation**: crown floor — assigning the `admin` / `patient.accessAll`-holding roles is admin-only (D7a).
- **R3 — Bootstrap chicken-and-egg.** **Mitigation**: `admin` role seeded onto the existing admin user; admin-only to grant the admin role (D8).
- **R4 — Keto bypass regression.** **Mitigation**: `patient.accessAll` admin-only; re-run keto-access tests on the permission path.
- **R5 — Mobile patient auth breakage.** **Mitigation**: identity via `patient_id` (D16); explicit mobile-login test; grep enum-literal reads.
- **R6 — Unenforced permissions.** **Mitigation**: code catalog + conformance test (every slug guarded).
- **R7 — Two-layer confusion (RBAC vs Keto).** **Mitigation**: hybrid boundary (D12); patient-data routes carry no RBAC permission; the only seam is `patient.accessAll`.
- **R8 — Role deletion orphans / management lockout.** **Mitigation**: `ON DELETE RESTRICT` + purge-when-empty; last-admin removal forbidden (D13/D14).
- **R9 — Tenant created without roles.** **Mitigation**: `admin` + `default` seeded by migration and by tenant provisioning (D15).

## Out of scope

- Any change to the Keto relation model / permits / tuple-sync (besides the bypass seam).
- Per-patient effective-permission exposure to the UI (button-level gating off Keto per-object permits).
- Many-to-many user↔roles with multiple simultaneous active roles — one-row-per-role + single active binding preserved.
- Free-form / DB-authored permissions with no code enforcement.
- A permission *catalog* admin UI (catalog is code; only role↔permission assignment is editable).
- Time-bounded or conditional role assignments.
