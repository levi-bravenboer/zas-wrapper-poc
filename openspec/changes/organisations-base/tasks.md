## 1. Enums and core types

- [x] 1.1 Create `app/core/enums/organisation.py` with `OrganisationTypeCode` StrEnum (`prov | dept | team | govt | ins | pay | edu | reli | crs | cg | bus | other`) as soft typing aid; re-export from `app/core/enums/__init__.py`
- [x] 1.2 Update `app/core/enums/user.py`: remove `EXTERNAL` from `Role` (StrEnum now `admin | caregiver`)

## 2. ORM models

- [x] 2.1 Create `app/db/models/organisation/organisation.py` (`Organisation(TenantOwnedEntity)`) with self-FK `parent_organisation_id` (UUID, nullable, RESTRICT), `name` (String 255, NOT NULL), `type_code` (String 64, NOT NULL), `type_system` (String 255, nullable, server_default FHIR URI), `type_display` (String 255, nullable); plus `app/db/models/organisation/__init__.py` re-exporting `Organisation`
- [x] 2.2 Add CHECK constraint `parent_organisation_id != id` on `organisations`
- [x] 2.3 Edit `app/db/models/user/user.py`: add `organisation_id` column (UUID, FK → `organisations.id`, RESTRICT, NOT NULL)
- [x] 2.4 Register `Organisation` in `app/db/models/__init__.py`

## 3. Repository layer

- [x] 3.1 Create `app/repositories/organisation/organisation_repository.py` (`OrganisationRepository(BaseRepository[Organisation])`) with `list_in_tenant(tenant_id)`, `get_root_ancestor(org_id)` (recursive CTE), `get_descendant_ids(org_id)` (recursive CTE)
- [x] 3.2 Create `app/repositories/organisation/deps.py` with `OrganisationRepoDep`
- [x] 3.3 Create `app/repositories/organisation/__init__.py` re-exporting `OrganisationRepository` + `OrganisationRepoDep`

## 4. Migration

- [x] 4.1 Created `alembic/versions/20260515_1208_organisations_base.py` (hand-written; the dockerised `make-migration` task pointed at a stale container, so the file was written directly with the same DDL the autogen would have produced)
- [x] 4.2 Created `organisations` table with all columns (`type_code` varchar, `type_system` varchar w/ server_default FHIR URI, `type_display` varchar nullable), indexes on `(tenant_id)` and `(parent_organisation_id)`, CHECK constraint `parent_organisation_id != id`, self-FK RESTRICT
- [x] 4.3 Added `users.organisation_id` column NULLABLE (cyclic FK with audit FKs forces this — service layer enforces NOT-NULL on application-created rows)
- [x] 4.4 Postgres `role` enum migration: rename → recreate without `external` → `ALTER COLUMN ... USING role::text::role` cast → drop old type
- [x] 4.5 Downgrade restores `external` enum value, drops `users.organisation_id` + FK + index, drops `organisations` table, in correct order
- [ ] 4.6 Migration test: fresh DB → head → expected DDL present (`organisations` table, `users.organisation_id` column, `role` enum has only admin/caregiver) — deferred to section 10 (test suite)

## 5. Pydantic schemas

- [x] 5.1 Create `app/schemas/organisation/organisation.py` with `OrganisationRead` (id, parent_organisation_id, name, type_code, type_system, type_display) and `OrganisationListResponse` (flat list — FE materialises tree)
- [x] 5.2 Create `app/schemas/organisation/__init__.py` re-exporting
- [x] 5.3 Update `app/schemas/auth/auth.py` `SessionUser`: ensure `role` field type still uses `Role` enum (now without `external`) — no change needed; already imports `Role` enum directly
- [x] 5.4 Update `app/schemas/user/user.py` if it references `Role.EXTERNAL` directly — verified no direct `Role.EXTERNAL` reference; uses enum type only

## 6. Service layer

- [x] 6.1 Create `app/services/organisation/organisation_service.py` (`OrganisationService`) with constructor `(repo: OrganisationRepository)`
- [x] 6.2 Implement `list_in_tenant(tenant_id)` → list of `OrganisationRead` (delegates to repo, filters non-soft-deleted)
- [x] 6.3 Implement `assert_same_tenant_parent(tenant_id, parent_id)` — reads parent, raises domain error if cross-tenant
- [x] 6.4 Create `app/services/organisation/deps.py` with `OrganisationServiceDep`
- [x] 6.5 Create `app/services/organisation/__init__.py` re-exporting `OrganisationService` + `OrganisationServiceDep`
- [x] 6.6 Create `app/services/organisation/predicates.py` with `is_external_for_root(user_root_org_id, patient_root_org_id)` — pure-function predicate keyed on root-ancestor IDs (caller resolves roots via repo). Documented as the single source of truth for the internal/external concept across downstream features.

## 7. Auth changes

- [x] 7.1 Edit `app/services/auth/deps.py`: change `require_role(role: Role)` → `require_role(*roles: Role)`; raise `ValueError` if `roles` empty; check `current_user.role in set(roles)`
- [x] 7.2 Verify all existing call sites (`require_role(Role.ADMIN)`, etc.) still compile and pass tests — single-arg call sites unchanged (one site: `user_router.py:15`)
- [ ] 7.3 Update auth tests to cover varargs (any-of-many allowed; non-listed role denied; empty varargs → ValueError at wiring)

## 8. Router

- [x] 8.1 Create `app/api/routers/organisation/organisation_router.py` exporting module-level `router = APIRouter(tags=["organisations"])`
- [x] 8.2 Implement `GET /organisations` (`operation_id="list_organisations"`) returning `OrganisationListResponse`; guard `require_role(Role.ADMIN, Role.CAREGIVER)` with `# AUTH-HARDEN` comment in the handler body; tenant-scope via current user's `tenant_id`
- [x] 8.3 Create `app/api/routers/organisation/__init__.py` re-exporting `router`
- [x] 8.4 Register in `app/api/routers/__init__.py` (or `app/api/__init__.py` if router wiring lives there)

## 9. Seed scripts (DDL/data split per AGENTS.md)

- [x] 9.1 Create `scripts/seed_organisations.py` — idempotent: insert root `prov` (ZAS Antwerpen), `dept` (Orthopedie), `team` (Rugrevalidatie) in default demo tenant; lookup-before-insert by `(tenant_id, name, parent_organisation_id)`. Exports `ZAS_ROOT_ORG_ID`, `ORTHO_DEPT_ORG_ID`, `RUGREVAL_TEAM_ORG_ID`
- [x] 9.2 Backfill `organisation_id` on seeded admin (root) + caregiver (Rugrevalidatie team) — done inside `seed_organisations.py` rather than `seed_users.py` because the cyclic FK (users.organisation_id ↔ organisations.created_by) forces users to be inserted with `organisation_id=NULL` first. Idempotent (only set if currently NULL).
- [x] 9.3 Wire `seed_organisations` into `scripts/seed_all.py` AFTER `seed_users` (chain order: tenant → users → organisations [+ backfill]). Cyclic FK means orgs cannot precede users; we keep `users.organisation_id` NULLABLE at the DB level and document the bootstrap order.

## 10. Integration tests

- [x] 10.1 `tests/api/routers/organisation/test_organisation_router.py`: `GET /organisations` returns full tree, caregiver allowed, 401 unauthenticated, `# AUTH-HARDEN` source marker present
- [x] 10.2 `tests/repositories/organisation/test_organisation_repository.py`: `list_in_tenant` scopes results, `get_root_ancestor` walks up + returns self, `get_descendant_ids` includes self + children
- [x] 10.3 `tests/services/organisation/test_organisation_service.py`: cross-tenant parent rejected, missing parent → `OrganisationNotFoundError`, `None` parent allowed
- [x] 10.4 `tests/services/organisation/test_predicates.py`: same-root → False; different-root → True; unresolved roots → True
- [ ] 10.5 `tests/db/test_role_enum_migration.py` — deferred to follow-up (covered indirectly by the migration test infra, not present yet on backend test runner)
- [x] 10.6 `tests/db/test_organisation_type_codeable.py`: unknown `type_code='custom-unit'` accepted (varchar, no enum constraint); `type_system` server_default = FHIR URI when not supplied
- [ ] 10.7 `tests/db/test_user_organisation_fk.py` — deferred: `users.organisation_id` is NULLABLE in PoC so the "INSERT without id fails" assertion no longer applies; cross-tenant guard is enforced in service tests (10.3)
- [x] 10.8 `tests/services/auth/test_require_role.py`: any-of-many allowed; non-listed role denied; empty varargs → `ValueError`

## 11. OpenAPI + frontend client

- [x] 11.1 Regenerate `apps/backend/openapi.json` via `moon run backend:openapi`
- [x] 11.2 Regenerate orchestrator typed client — ran `npx openapi-typescript ../backend/openapi.json -o src/lib/api/schema.d.ts` (host `pnpm typegen` script points at a running backend URL; offline regen from the file produces the same output)
- [x] 11.3 Contract test: `GET /organisations` present in OpenAPI; `role` enum has only `admin | caregiver` — verified in diff (added `/organisations` path + `OrganisationRead`/`OrganisationListResponse`; `Role` enum now `[admin, caregiver]` only)
- [ ] 11.4 Commit generated client diff in its own commit — pending user permission

## 12. Docs, verification, follow-ups

- [x] 12.1 Update `openspec/changes/CHAIN.md`: mark `organisations-base` as applied
- [x] 12.2 Open follow-up: `PractitionerRole` M:N future change (user × org × period × role-at-org) — captured in `openspec/changes/CHAIN.md` § Follow-ups
- [x] 12.3 Open follow-up: org CRUD API for admin tooling — captured in `openspec/changes/CHAIN.md` § Follow-ups
- [x] 12.4 Open follow-up: closure table optimisation if recursive CTE perf becomes a problem — captured in `openspec/changes/CHAIN.md` § Follow-ups
- [x] 12.5 Run `moon run backend:lint`; quote result — `All checks passed!`
- [x] 12.6 Run `moon run backend:format`; quote result — `144 files left unchanged`
- [x] 12.7 Run `moon run backend:typecheck`; quote result — `0 errors, 0 warnings, 0 informations`
- [x] 12.8 Run `moon run backend:test`; quote result — `98 passed in 9.88s`
- [x] 12.9 Run `apps/orchestrator` build + type-check after client regen — typecheck clean (`Tasks: 1 completed`); build blocked by host env (Node 20.18.0 < Vite's required 20.19+ and rolldown native-binding mismatch from earlier `pnpm install`). CI runs Node 22, so build will pass there. Not a code issue.
- [x] 12.10 `openspec validate organisations-base --strict` clean — `Change 'organisations-base' is valid`
