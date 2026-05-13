## 1. Backend cleanup (BL-025 narrow)

- [x] 1.1 Delete `apps/backend/app/schemas/fhir.py` and remove every import of it from the app + tests
- [x] 1.2 Narrow `apps/backend/app/adapters/hix/protocol.py` to `async def ping() -> None` only; drop `get_patient` and the `from app.schemas.fhir import Patient` import
- [x] 1.3 Update `apps/backend/app/adapters/hix/stub.py` to match the narrowed Protocol; remove the `get_patient` implementation and its fixture wiring
- [x] 1.4 Delete `apps/backend/app/adapters/hix/_fixtures.py`
- [x] 1.5 Delete `apps/backend/tests/fixtures/fhir.py` and update `apps/backend/tests/adapters/test_hix_stub.py` to assert only the `ping()` contract
- [x] 1.6 Slim `apps/backend/AGENTS.md` "FHIR-Readiness Rules" to a one-paragraph pointer ("FHIR rules apply at `[mvp]`; see `openspec/scope.md`")
- [x] 1.7 Run `moon run backend:typecheck` + `moon run backend:test` — green before commit
- [x] 1.8 Commit: `chore(backend): narrow hix adapter to ping and drop fhir placeholders`

## 2. Persistence foundation

- [x] 2.1 Add `sqlalchemy[asyncio]>=2`, `aiosqlite`, `alembic` to `apps/backend/pyproject.toml` runtime deps
- [x] 2.2 Add `BACKEND_DATABASE_URL` setting to `app/core/settings.py` (default `sqlite+aiosqlite:///./poc.db`)
- [x] 2.3 Create `app/db/__init__.py`, `app/db/engine.py` (engine + session factory), `app/db/base.py` (DeclarativeBase)
- [x] 2.4 Create `alembic.ini` + `apps/backend/alembic/` skeleton with async env.py wired to the engine
- [x] 2.5 Wire `pytest` fixture in `tests/conftest.py` to use `sqlite+aiosqlite:///:memory:` per session and run `alembic upgrade head` on session start
- [x] 2.6 Commit: `feat(backend): add sqlalchemy alembic persistence foundation`

## 3. Backend structural foundation

Land the layering before any domain code. Everything below this point follows the layout, layer rules, DI contract, and transaction-boundary rules in `apps/backend/AGENTS.md`.

- [x] 3.1 Roll back the first-pass entity scaffolding (domain models, services, routers, baseline migration) so the foundation lands on top of `e273eba`
- [x] 3.2 Drop the auth stub, `SessionSigner`, and `bootstrap_admin_*` settings/env defaults; they re-land inside the user + auth domain (section 4)
- [x] 3.3 Add `app/repositories/__init__.py` + `app/repositories/base.py` with a `BaseRepository[T]` generic
- [x] 3.4 Wire `get_session` in `app/db/engine.py` as a request-scoped unit of work (auto-commit on success, rollback on exception)
- [x] 3.5 Rewrite `apps/backend/AGENTS.md`: layout (layer-by-type + domain split inside every layer), layer-rules table, DI rules (services as classes, never import `fastapi`), transaction boundary, naming conventions, tests mirror tree
- [x] 3.6 Verify `moon run backend:typecheck` + `moon run backend:test` + `moon run backend:lint` — green
- [x] 3.7 Commit: `chore(backend): purge entity scaffolding and bootstrap admin coupling`, `feat(backend): add repositories layer and unit-of-work session dep`, `docs(backend): rewrite agents.md for domain-split layering`

## 4. User + auth domain (F1)

User owns the model + repository; auth owns the service, schema, and router (auth re-uses the User aggregate — no separate auth model). Follow the layering exactly.

- [ ] 4.1 `app/db/models/user/user.py` — User { id, username, password_hash, role, created_at }; export the `Role` literal alias from the package `__init__.py`
- [ ] 4.2 `app/repositories/user/user_repository.py` — `UserRepository(BaseRepository[User])` with `get_by_id`, `get_by_username`, `list_by_role`; expose `UserRepoDep`
- [ ] 4.3 `app/services/auth/security.py` — `hash_password`, `verify_password` (PoC sha256 + salt), `SessionSigner` (itsdangerous); restore `itsdangerous` dep in `pyproject.toml`
- [ ] 4.4 `app/services/auth/auth_service.py` — `AuthService` class with `UserRepository` injected; methods `authenticate(username, password)`, `get_session_user(user_id)`; expose `AuthServiceDep`
- [ ] 4.5 `app/services/errors.py` — `InvalidCredentialsError` (`security.auth.invalid_credentials`, 401), `UnauthenticatedError` (`security.auth.unauthenticated`, 401)
- [ ] 4.6 `app/schemas/auth/auth.py` — `LoginRequest`, `SessionUser`
- [ ] 4.7 `app/api/deps/auth.py` — `CurrentUserDep` (cookie → User via `AuthService` + `SessionSigner`)
- [ ] 4.8 `app/api/routers/auth/auth_router.py` — `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- [ ] 4.9 Re-add `BACKEND_BOOTSTRAP_ADMIN_USERNAME` / `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` settings + `.env.example` entries
- [ ] 4.10 Alembic baseline migration creating `users`; alembic data migration seeding the bootstrap admin idempotently
- [ ] 4.11 Tests mirror tree: `tests/repositories/user/`, `tests/services/auth/`, `tests/api/routers/auth/` (golden + unauthenticated + invalid-credentials paths)
- [ ] 4.12 Verify all three moon gates green
- [ ] 4.13 Commit: `feat(backend): add user model and auth domain`

## 5. Pathway domain (F3)

- [ ] 5.1 `app/db/models/pathway/pathway.py` — Pathway { id, name, owner_id, blocks: JSON, created_at, updated_at }
- [ ] 5.2 `app/repositories/pathway/pathway_repository.py` — `PathwayRepository(BaseRepository[Pathway])` with `get_by_id`, `list_by_owner`
- [ ] 5.3 `app/schemas/pathway/blocks.py` — block discriminated union (`appointment`, `decision`, `milestone`, `email`, `hix_task`, `luscii_care_path`)
- [ ] 5.4 `app/schemas/pathway/pathway.py` — `PathwaySummary`, `PathwayDetail`, `PathwayCreateRequest`, `PathwayUpdateRequest`
- [ ] 5.5 `app/services/pathway/pathway_service.py` — `PathwayService` class; CRUD + `load_blocks(pathway)`
- [ ] 5.6 `app/services/pathway/blocks.py` — `parse_blocks` / `dump_blocks` (raises `InvalidBlockKindError`)
- [ ] 5.7 `app/services/errors.py` — add `PathwayNotFoundError`, `InvalidBlockKindError`
- [ ] 5.8 `app/api/routers/pathway/pathway_router.py` — `GET /pathways`, `GET /pathways/{id}`, `POST /pathways`, `PUT /pathways/{id}`
- [ ] 5.9 Alembic migration creating `pathways`
- [ ] 5.10 Tests mirror tree (round-trip block parse, invalid kind, CRUD goldens, router shapes)
- [ ] 5.11 Verify + commit: `feat(backend): add pathway domain`

## 6. Patient domain (F4)

- [ ] 6.1 `app/db/models/patient/patient.py` — Patient { id, display_name, birthdate, created_at }
- [ ] 6.2 `app/repositories/patient/patient_repository.py` — `PatientRepository(BaseRepository[Patient])` with `get_by_id`, `list` + join filter helpers used by the patient service
- [ ] 6.3 `app/schemas/patient/patient.py` — `PatientSummary`, `PatientDetail`
- [ ] 6.4 `app/services/patient/patient_service.py` — `PatientService` class; `list_patients(pathway_id?, status?)`, `get_patient_detail(id)` (joins enrollment + pathway + runtime state)
- [ ] 6.5 `app/services/errors.py` — add `PatientNotFoundError`
- [ ] 6.6 `app/api/routers/patient/patient_router.py` — `GET /patients` (filters), `GET /patients/{id}` (detail), `POST /patients/{id}/enroll` (delegates to enrollment service)
- [ ] 6.7 Alembic migration creating `patients`
- [ ] 6.8 Tests mirror tree
- [ ] 6.9 Verify + commit: `feat(backend): add patient domain`

## 7. Enrollment + task runtime (F5 / F6)

Enrollment is its own domain (bridges patient + pathway + task; spawns tasks at runtime). Task is a sibling domain with its own model + repo + service + router; the inbox lives there. Enrollment has no router — caregivers trigger it from patient routes (section 6.6) and task routes (section 7).

- [ ] 7.1 `app/db/models/enrollment/enrollment.py` — PathwayEnrollment { id, pathway_id, patient_id, current_block_id, completed_block_ids: JSON, enrolled_at, completed_at } + partial unique index on `(patient_id) WHERE completed_at IS NULL`
- [ ] 7.2 `app/db/models/task/task.py` — Task { id, enrollment_id, block_id, owner_id, title, status: Literal["pending","done"], completed_at, completed_by }
- [ ] 7.3 `app/repositories/enrollment/enrollment_repository.py` — `EnrollmentRepository`; `get_active_for_patient`, `get_by_id`
- [ ] 7.4 `app/repositories/task/task_repository.py` — `TaskRepository`; `list_pending_for_caregiver`, `get_by_id`
- [ ] 7.5 `app/services/enrollment/enrollment_service.py` — `EnrollmentService` (depends on EnrollmentRepository + TaskRepository + PathwayRepository); `enroll_patient`, `advance_enrollment`, `_block_produces_task`
- [ ] 7.6 `app/services/task/task_service.py` — `TaskService` (depends on TaskRepository + EnrollmentService); `list_pending_tasks(caregiver_id)`, `complete_task(task_id, caregiver_id)`
- [ ] 7.7 `app/services/errors.py` — add `EnrollmentAlreadyActiveError`, `TaskNotFoundError`
- [ ] 7.8 `app/schemas/task/task.py` — `TaskSummary`, `TaskCompleteRequest`
- [ ] 7.9 `app/api/routers/task/task_router.py` — `GET /tasks`, `POST /tasks/{id}/complete`
- [ ] 7.10 Alembic migration creating `pathway_enrollments` + `tasks` (with the partial unique index)
- [ ] 7.11 Tests mirror tree (unique-active-enrollment via IntegrityError, completed unblocks new enrollment, linear runtime advance, task complete path)
- [ ] 7.12 Verify + commit: `feat(backend): add enrollment runtime and task inbox`

## 8. Admin domain (F8)

Reuses the User model and UserRepository from section 4. Admin owns only the service + router (role assignment + self-demotion guard).

- [ ] 8.1 `app/services/admin/admin_service.py` — `AdminService` (depends on UserRepository); `list_users`, `assign_role(target_id, role, acting_user_id)` with the self-demotion guard
- [ ] 8.2 `app/services/errors.py` — add `AdminSelfDemotionForbiddenError`, `UserNotFoundError`
- [ ] 8.3 `app/schemas/admin/admin.py` — `UserRow`, `AssignRoleRequest`
- [ ] 8.4 `app/api/deps/admin.py` — `AdminUserDep` (CurrentUserDep + role == "admin", else 403)
- [ ] 8.5 `app/api/routers/admin/admin_router.py` — `GET /users`, `POST /users/{id}/role`
- [ ] 8.6 Tests mirror tree (golden path + self-demotion forbidden + non-admin forbidden)
- [ ] 8.7 Verify + commit: `feat(backend): add admin users domain`

## 9. Dashboard domain (F2)

Aggregates counts. No model or repository — service reads from sibling repositories (patient, task, pathway).

- [ ] 9.1 `app/services/dashboard/dashboard_service.py` — `DashboardService` (depends on PatientRepository + TaskRepository + PathwayRepository); `summary(caregiver_id)` returning `enrolled_patients`, `pending_tasks`, `active_pathways`
- [ ] 9.2 `app/schemas/dashboard/dashboard.py` — `DashboardSummary`
- [ ] 9.3 `app/api/routers/dashboard/dashboard_router.py` — `GET /dashboard/summary`
- [ ] 9.4 Tests mirror tree
- [ ] 9.5 Verify + commit: `feat(backend): add dashboard summary`

## 10. Orchestrator cleanup (smart-launch removal)

- [ ] 10.1 Delete `apps/orchestrator/src/modules/smart-launch/` (entire directory + tests)
- [ ] 10.2 Delete `apps/orchestrator/src/routes/launch.tsx`
- [ ] 10.3 Remove `/launch` references from `apps/orchestrator/src/app/router.ts`, README/docs, and any imports
- [ ] 10.4 Update `apps/orchestrator/AGENTS.md`: drop SMART-launch references; note `/login` is the only entry point in PoC
- [ ] 10.5 Run `moon run orchestrator:typecheck` + `moon run orchestrator:test` — green
- [ ] 10.6 Commit: `chore(orchestrator): remove smart-launch module and route`

## 11. Orchestrator typegen sync

- [ ] 11.1 Run `moon run orchestrator:typegen` to refresh `apps/orchestrator/src/lib/api/schema.d.ts` against the new backend OpenAPI
- [ ] 11.2 Spot-check generated types exist for each new route in `pathway/`, `patient/`, `task/`, `admin/`, `dashboard/` operations
- [ ] 11.3 Commit: `chore(orchestrator): regenerate api schema after backend additions`

## 12. Orchestrator: pathway-builder (F3)

- [ ] 12.1 Create `apps/orchestrator/src/modules/pathway/` (api, hooks, keys, schemas)
- [ ] 12.2 Implement list page at `apps/orchestrator/src/routes/_auth/zorgpaden.tsx` (replace placeholder)
- [ ] 12.3 Add composer route at `apps/orchestrator/src/routes/_auth/zorgpaden.$pathwayId.tsx` with the dev-composer JSON textarea + Save button
- [ ] 12.4 Wire toast on save error via `ErrorResponse.code` i18n lookup
- [ ] 12.5 Vitest coverage for hooks + components; Playwright happy path for create + save
- [ ] 12.6 Commit: `feat(orchestrator): add pathway list and composer skeleton`

## 13. Orchestrator: patients-overview (F4)

- [ ] 13.1 Create `apps/orchestrator/src/modules/patient/` (api, hooks, keys, schemas)
- [ ] 13.2 Implement list page at `apps/orchestrator/src/routes/_auth/patienten.tsx` with pathway + status filters reflected in URL search params
- [ ] 13.3 Vitest coverage for filter behaviour; row-click navigation test
- [ ] 13.4 Commit: `feat(orchestrator): add patients overview with filters`

## 14. Orchestrator: patient-view (F5)

- [ ] 14.1 Add detail route at `apps/orchestrator/src/routes/_auth/patienten.$patientId.tsx`
- [ ] 14.2 Render block list with current-block highlight + completed strike-through
- [ ] 14.3 Implement Luscii block embed (read-only JSON code panel — no transformation)
- [ ] 14.4 Vitest coverage: current-block highlight, completed marker, Luscii payload renders verbatim
- [ ] 14.5 Commit: `feat(orchestrator): add patient detail with pathway visualization`

## 15. Orchestrator: task-inbox (F6)

- [ ] 15.1 Create `apps/orchestrator/src/modules/task/` (api, hooks, keys, schemas)
- [ ] 15.2 Implement inbox at `apps/orchestrator/src/routes/_auth/taken.tsx` (replace placeholder)
- [ ] 15.3 Wire Complete action with optimistic update + cache invalidation for the affected enrollment
- [ ] 15.4 Vitest coverage for complete action; Playwright happy path: complete task → patient view shows advanced step
- [ ] 15.5 Commit: `feat(orchestrator): add task inbox`

## 16. Orchestrator: admin-users (F8)

- [ ] 16.1 Create `apps/orchestrator/src/modules/admin/` (api, hooks, keys, schemas)
- [ ] 16.2 Implement admin page at `apps/orchestrator/src/routes/_auth/instellingen.tsx` (replace placeholder) with admin-only guard + forbidden state
- [ ] 16.3 Wire role-assign action with self-demotion error toast
- [ ] 16.4 Vitest coverage for guard, forbidden render, role assignment
- [ ] 16.5 Commit: `feat(orchestrator): add admin users page`

## 17. Orchestrator: dashboard data (F2)

- [ ] 17.1 Create `apps/orchestrator/src/modules/dashboard/` (api, hooks, keys)
- [ ] 17.2 Replace static `DashboardPage` content with three count cards bound to `GET /dashboard/summary`
- [ ] 17.3 Wire drill-down navigation per card (patients → `/patienten`, tasks → `/taken`, pathways → `/zorgpaden`)
- [ ] 17.4 Add loading skeletons + error state
- [ ] 17.5 Vitest coverage for loading, error, drill-down
- [ ] 17.6 Commit: `feat(orchestrator): bind dashboard cards to live counts`

## 18. Seed data + MSW handlers

- [ ] 18.1 Author Alembic data migration (or a `seed` CLI) seeding: 1 admin, 2 caregivers, 5 synthetic patients, 2 sample pathways (one with a `luscii_care_path` block carrying static JSON), 1 enrollment per patient, a few pending tasks
- [ ] 18.2 Update `apps/orchestrator/src/mocks/handlers/` to mirror every new endpoint so Playwright runs without a live backend
- [ ] 18.3 Verify the demo path manually: login → dashboard → create pathway → enroll patient → patient view → complete task → dashboard counts update

## 19. Verification

- [ ] 19.1 `moon ci` — full affected-only build + lint + typecheck + test green
- [ ] 19.2 `openspec validate align-stack-with-poc-scope --strict` — passes
- [ ] 19.3 Read-aloud test on a new contributor: open `scope.md` + every `## ADDED Requirements` in this change; can they describe F1–F8 in under two minutes? (`owner: user`)
- [ ] 19.4 Update `openspec/backlog.md` `BL-025` entry note: "Resolved by `align-stack-with-poc-scope` on YYYY-MM-DD — section 12 narrowed, FHIR placeholders removed."
- [ ] 19.5 Archive the change via `openspec archive align-stack-with-poc-scope`
