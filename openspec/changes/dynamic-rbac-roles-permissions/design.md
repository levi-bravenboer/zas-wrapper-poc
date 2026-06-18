## Context

Two authorization layers exist and must stay distinct:

- **Keto ReBAC** (`keto-authz`, `authz-tuple-sync`) — answers "may subject S touch patient P's data?" from relation tuples derived from Postgres (care-team, org tree, break-glass, external grants). Untouched here.
- **App-function access** — answers "may user U use screen/action X?". Today a fixed `Role` Postgres enum (`admin | caregiver | patient`) + `require_role(...)` (backend) + a near-empty static `ROLE_CAPABILITIES` map (frontend). This is what becomes dynamic.

Relevant existing shape:
- `app/core/enums/user.py::Role` — StrEnum `admin | caregiver | patient` (the `external` value was already retired; external-vs-internal is derived from the org tree).
- `app/services/patient/deps.py` — `require_patient_access` short-circuits to allow when `current_user.role == Role.ADMIN` (the Keto bypass).
- `multi-role-login` — one human = one Kratos identity = several `users` rows, one per role (`tenant + email + role` unique); a session binds to one row via `session_role_bindings`.
- `practitioner-role-split` — `Practitioner` exists only for caregivers; admins have none.
- Sessions are async, `autoflush=False`, unit-of-work commit-on-return; services never `commit()`.
- `audit-trail-base` provides `emit()` / `__audited__` for recording changes.

## Goals / Non-Goals

**Goals:**
- Tenant-scoped, admin-defined roles carrying a configurable set of permissions.
- A code-defined permission catalog — every assignable permission is backed by a real guard.
- Replace the fixed `Role` enum end to end (DB, backend guards, frontend, mobile), preserving the one-row-per-role login model.
- Preserve the Keto bypass as the `patient.accessAll` permission; keep Keto otherwise untouched.
- A privilege-escalation-safe role-management surface.
- Effective permissions exposed to the frontend for route/button gating.

**Non-Goals:**
- Changing the Keto relation model, permits, or tuple-sync.
- Per-patient (per-object) permission gating in the UI.
- Multiple simultaneously-active roles per session.
- Free-form permissions without code enforcement.
- A catalog-editing UI (catalog is code; only assignment is data).

## Decisions

### D1 — Two layers, one seam

RBAC gates **app functions**; Keto gates **patient data**. The only crossing point is `patient.accessAll`: holding it reproduces the old `Role.ADMIN` Keto bypass (skip the per-patient check). No RBAC permission feeds a Keto tuple; no Keto relation grants an app-function permission.

### D1a — Role = permission bundle; identity-type is derived, not a role

A `role` is purely a **bundle of app-function permissions**, not an identity classification. The clinical identity-types are derived from data, never from the role:
- **patient** = `users.patient_id IS NOT NULL`
- **caregiver** = the user has a `Practitioner` row (`practitioner-role-split`)
- **external** = org-tree derivation (`is_external_for`, `organisations-base`)

So only two roles are seeded — `admin` and `default` — and "patient"/"caregiver"/"external" are NOT roles. This keeps RBAC about *capability* and leaves *who someone is* to the data model that already encodes it.

### D2 — `roles` table (tenant-scoped, system-protected)

| column | type | notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | tenant-scoped; system roles seeded per tenant |
| `slug` | text | stable identifier (`admin`, `default`, or custom); unique per tenant |
| `name` | text | display name |
| `is_system` | bool | seeded, undeletable, admin-only to edit |
| audit cols | | inherits `TenantOwnedEntity` (created_by/updated_by/tenant) |

Unique `(tenant_id, slug)`. `is_system` roles cannot be deleted and are editable only by an admin-role holder (D7).

### D3 — Permission catalog is code-defined `resource.action` slugs

`app/core/enums/permission.py::Permission(StrEnum)` — the closed set of grantable permissions, each a `resource.action` pair tied to a guard (industry-standard RBAC shape: AWS IAM / k8s RBAC / OAuth scopes). Stored on `role_permissions` as **text** (validated against the catalog at the write boundary), not a Postgres enum, so adding a permission is a code change with no enum migration (mirrors the audit `resource_type` rationale).

**Verb vocabulary is canonical and explicit (D3a):** CRUD verbs are `create | read | update | delete` only — no synonyms (`edit`/`write` are not used). Domain verbs only where a real action exists (`request`, `oversee`, `manageRuntime`). **No wildcard / `manage`-all alias** — each `resource.action` is granted explicitly, so the no-amplification guard and audit reason about exact slugs, never an expanding `*`.

**RBAC does not duplicate Keto (D3b):** patient *data* verbs (read/edit/record/shielded) are Keto's job. The catalog gates **config/admin resources + app actions** only. `patient.accessAll` is the single seam (the Keto bypass).

Starter catalog (final set tuned in implementation):

| resource | actions | gates |
|---|---|---|
| `organisation` | create, read, update, delete | organisations-admin |
| `user` | create, read, update, delete | users-admin (+ role assignment) |
| `role` | create, read, update, delete | roles-admin + assignments |
| `practitionerRole` | create, read, update, delete | practitioner-roles-admin |
| `shieldingRule` | read, update | shielding-rule config |
| `specialism` | create, read, update, delete | specialism master data + carepath/role scoping (scoping_router) |
| `externalCollaboration` | create, read, update, delete | external access profiles / consents / grants (external_router); the data unlocked stays Keto |
| `breakGlass` | request, oversee | request a grant / list+revoke grants |
| `pathway` | read, manageRuntime | view / drive the runtime |
| `audit` | read | read the audit trail |
| `patient` | accessAll | Keto bypass — admin-only to grant |

A conformance test asserts every catalog slug is referenced by at least one backend guard or marked frontend-only (R6).

### D4 — `role_permissions` (M:N)

`role_permissions`: `role_id` FK, `permission` text (catalog-validated), unique `(role_id, permission)`. A role's permission set is its rows; the `admin` role's set is the full catalog (seeded, kept in sync by a test).

### D5 — `users.role` enum → `users.role_id` FK

The one-row-per-role model is unchanged in shape: each `users` row represents one role for a human, but now carries `role_id` (FK → `roles.id`, NOT NULL) instead of the enum. Because patient/caregiver identity is derived (D1a), the `multi-role-login` uniqueness moves to partial indexes — `UNIQUE (tenant_id, email, role_id) WHERE patient_id IS NULL` (one staff row per role) and `UNIQUE (tenant_id, email) WHERE patient_id IS NOT NULL` (one patient row) — so a human can hold staff rows AND a patient row without collision (a patient row and a caregiver row both carry the `default` role and are distinguished by `patient_id`). Session binding, role selection (now including the patient facet), swap, and actor resolution are otherwise untouched; the login response's `role` field carries the role **slug**.

### D6 — Enforcement: `require_permission(slug)`

`app/services/access/rbac/` provides:
- `effective_permissions(user) -> frozenset[str]` — the bound role's permission set (`admin` → full catalog).
- `require_permission(slug)` — a FastAPI dependency that 403s when the slug is absent. Replaces `require_role(...)` at config/admin + app-action call sites.
- `patient/deps.py` bypass: `current_user.role == Role.ADMIN` → `"patient.accessAll" in effective_permissions(current_user)`.

### D7 — Privilege-escalation guard

Role-management writes (`role.create` / `role.update` / `role.delete`) enforce:
1. **No amplification** — an actor editing a role may grant a permission only if they themselves hold it (an admin-role holder holds all, so is unconstrained).
2. **Crown jewels admin-only** — `patient.accessAll` and the `role.*` write actions are grantable only by an admin-role holder.
3. **System roles admin-only** — `is_system` roles are editable only by an admin-role holder; never deletable.

### D7a — User→role assignment guard

Assigning a user to a role is a distinct escalation path and is guarded separately:
- The assign action is gated by its permission (`user.update` / `role.update`).
- **No subset check** for normal roles — holding the assign permission is sufficient to assign any non-crown role.
- **Crown floor (security)** — assigning a user to the `admin` role, or to any role holding `patient.accessAll`, is **admin-only**. Without this floor the D7 guard is moot: an attacker would self-assign the existing all-powerful role instead of editing one.

### D8 — Seeded roles (admin + default only)

Per tenant, two `is_system` roles are seeded:
- `admin` — the full catalog incl. `patient.accessAll`; the bootstrap that can manage roles. Existing `admin`-enum users map here.
- `default` — seeded with **only `breakGlass.request`** (so caregivers keep emergency access day one), otherwise empty. **Every** existing non-admin user (former caregivers, patients, externals) maps here.

No `patient` / `caregiver` / `external` roles — those identities are derived (D1a). Admins create further roles themselves.

### D9 — Migration

One alembic migration:
1. Create `roles` + `role_permissions`; seed `admin` (full catalog) + `default` (`breakGlass.request`) per tenant.
2. Add `users.role_id` (nullable), backfill: enum `admin` → `admin` role; **everyone else** → `default`. Set NOT NULL.
3. Drop `users.role` column and the `role` Postgres enum type; adjust the `multi-role-login` unique constraint to `(tenant_id, email, role_id)`.
4. Emit an operator note: an admin must grant the `default` role its app-action slugs before non-admins regain admin/app-action surfaces (patient care is unaffected — D12).

Rollback: reverse — re-add enum, backfill from role slug, drop tables.

### D10 — Frontend

- Session payload gains `permissions: string[]` (effective slugs) + the role `slug`.
- `apps/orchestrator/src/modules/auth/permissions.ts`: drop the static `ROLE_CAPABILITIES`; `can(slug)` / `useCan(slug)` read from session permissions. Remove the stale `external` `Role` literal; role becomes a slug string.
- Route guards (admin management pages) and action buttons gate off `can(...)`.
- **Staleness (D10a)** — session permissions are refetched on navigation (route change), so a role-permission change an admin makes is reflected within seconds. The backend guard is always authoritative; this only keeps UI affordances honest.
- Admin UI: roles list/create/edit/delete, a permission-toggle matrix (catalog × role), and assign-role-to-user on the user admin surface.

### D11 — Audit

Role create/update/delete, permission-assignment changes, and role-to-user assignment emit audit events via `audit-trail-base`. `roles` / `role_permissions` opt into `__audited__` where diff capture is meaningful; assignment changes use explicit `emit()`.

### D12 — RBAC × Keto boundary (the hybrid)

The two layers answer different questions, combined the standard way (RBAC + ReBAC/Zanzibar hybrid):
- **RBAC** = *what you can do* — functions/verbs. Coarse, role-driven.
- **Keto** = *which resources* — per-patient data relationships. Fine, relation-driven.

Routing rule:
- **Patient-data routes** (patient list/detail, pathways, etc.) stay **authenticated + Keto** with **no** RBAC permission. Keto's per-patient check (and SQL list-scoping) is authoritative; `patient.accessAll` is the only RBAC slug touching this layer (the bypass).
- **Config/admin + app-action routes** are gated by **`require_permission(slug)`**, no Keto dimension.
- **Both** are checked only where a route is genuinely an app-action AND patient-scoped (defense in depth).

Consequence: a `default` role with few permissions does **not** block patient care — caregivers keep patient access via Keto. It blocks only admin/app-action surfaces.

### D13 — Role deletion: block if members, purge when empty

`users.role_id` is `NOT NULL` with `ON DELETE RESTRICT`. A role with bound users CANNOT be deleted — the caller must reassign/empty it first. An **empty, non-`is_system`** role may be hard-deleted (purged) with its `role_permissions`. `is_system` roles (`admin`, `default`) are never deletable (D2).

### D14 — Last-admin safeguard

The service layer SHALL forbid any operation that would leave a tenant with zero users bound to a role holding the admin capability (`patient.accessAll` + role-write permissions): deleting/editing-away the `admin` role, or unbinding/reassigning the final admin user. Prevents permanent management lockout (otherwise recoverable only by direct DB/seed intervention).

### D15 — Roles seeded at tenant provisioning

The two `is_system` roles (`admin`, `default`) SHALL be seeded by this change's migration (existing tenants) AND whenever a new tenant is created (`tenant-base` provisioning). A tenant SHALL never exist without them; the first admin provisioned into a tenant is bound to `admin`.

### D16 — Patient identity via `patient_id`, not a role

Patient (mobile) routes guard on `users.patient_id IS NOT NULL` (plus Keto/ownership for any data), NOT on a role slug or RBAC permission. Patient-ness is a data fact, decoupled from RBAC entirely; patients hold the `default` role like other non-admins. `users.patient_id` and the mobile auth flow are unchanged; the prior enum-literal read (`role == "patient"`) moves to the `patient_id` check.

### D17 — Seed scripts (bundled)

The dev seed scripts are updated in this change: seed **one admin user + the `admin` role** (and the `default` role), seed patients (with `patient_id`), and **remove the Luscii data seeding** (bundled here per decision, not split out). `scripts/seed_users.py` / `seed_practitioners.py` move from the enum to `role_id`.

## Risks / Trade-offs

- **R1 — Empty-ish `default` role** — DOWNGRADED by D12: non-admins keep patient care (Keto) and emergency break-glass (`default` carries `breakGlass.request`); only admin/app-action surfaces wait on an admin granting slugs. Operator note in migration.
- **R2 — Escalation via role edit** — D7 guard, server-enforced, tested.
- **R2a — Escalation via role assignment** — D7a crown floor (admin-role / `patient.accessAll` assignment is admin-only), server-enforced, tested.
- **R3 — Bootstrap** — `admin` role seeded onto the admin user (D8); admin-only to grant the admin role.
- **R4 — Keto bypass regression** — `patient.accessAll` admin-only; re-run keto-access tests on the permission path.
- **R5 — Mobile patient auth** — identity via `patient_id` (D16); explicit mobile-login test; grep enum-literal reads.
- **R6 — Dead permissions** — code catalog + conformance test (every slug guarded).
- **R7 — Layer confusion** — D1/D12 boundary; the only seam is `patient.accessAll`.
- **R8 — Deletion orphans / management lockout** — D13 RESTRICT + D14 last-admin safeguard.
- **R9 — Tenant without roles** — D15 seeds at provisioning.

## Migration Plan

Single alembic migration with the data step in D9. Backwards-incompatible (drops the enum) — no flag; structural replacement. Deploy: migrate → admin grants the `default` role its app-action slugs → non-admins regain those surfaces (patient care + break-glass unaffected). Frontend ships in the same release (session `permissions[]` + gating).

## Phases

1. **Backend RBAC core** — catalog, `roles`/`role_permissions` models, migration (enum→role_id), seeds (admin+default), `require_permission`, escalation guards (D7/D7a), Keto-bypass swap, patient-id guard swap, audit hooks, seed-script updates (incl. Luscii removal). Re-point all `require_role` call sites.
2. **Session permissions API** — expose `permissions[]` + role slug; regenerate the typed client.
3. **Frontend gating** — `permissions.ts` rewrite, route + button gating, refetch-on-navigation, align `Role` types.
4. **Admin UI** — roles CRUD + permission matrix + assign-role-to-user.

## Open questions

- None outstanding. (Identity-type derivation, seeding, escalation, mobile, staleness, and Luscii-bundling are all resolved above.)
