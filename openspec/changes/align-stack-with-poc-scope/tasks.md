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
- [x] 2.3 Add `BACKEND_BOOTSTRAP_ADMIN_USERNAME` / `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` settings (dev defaults, never real)
- [x] 2.4 Create `app/db/__init__.py`, `app/db/engine.py` (engine + session factory), `app/db/base.py` (DeclarativeBase)
- [x] 2.5 Create `alembic.ini` + `apps/backend/alembic/` skeleton with async env.py wired to the engine
- [x] 2.6 Wire `pytest` fixture in `tests/conftest.py` to use `sqlite+aiosqlite:///:memory:` per session and run `alembic upgrade head` on session start
- [ ] 2.7 Commit: `feat(backend): add sqlalchemy alembic persistence foundation`

## 3. Domain models + baseline migration

- [ ] 3.1 Define `app/db/models/user.py` (User { id, username, password_hash, role, created_at })
- [ ] 3.2 Define `app/db/models/patient.py` (Patient { id, display_name, birthdate, created_at })
- [ ] 3.3 Define `app/db/models/pathway.py` (Pathway { id, name, owner_id, blocks: JSON, created_at, updated_at })
- [ ] 3.4 Define `app/db/models/enrollment.py` (PathwayEnrollment { id, pathway_id, patient_id, current_block_id, completed_block_ids: JSON, enrolled_at, completed_at }) with the unique-active-enrollment constraint
- [ ] 3.5 Define `app/db/models/task.py` (Task { id, enrollment_id, block_id, title, status, completed_at, completed_by })
- [ ] 3.6 Define block schemas in `app/schemas/blocks.py` as a Pydantic discriminated union (`appointment`, `decision`, `milestone`, `email`, `hix_task`, `luscii_care_path`)
- [ ] 3.7 Add typed `AppError` codes: `pathway.invalid_block_kind`, `enrollment.already_active`, `admin.self_demotion_forbidden`
- [ ] 3.8 Generate the baseline Alembic migration (`alembic revision --autogenerate`); verify `alembic upgrade head` on a fresh SQLite file
- [ ] 3.9 Add Alembic data migration seeding the bootstrapped admin user (idempotent)
- [ ] 3.10 Write pytest coverage for: block round-trip, invalid block kind, unique-active-enrollment, runtime advance
- [ ] 3.11 Run `moon run backend:test` — green
- [ ] 3.12 Commit: `feat(backend): add pathway domain models and migration baseline`

## 4. Runtime + services

- [ ] 4.1 Create `app/services/pathway_service.py` (CRUD over Pathway; save = enrollable)
- [ ] 4.2 Create `app/services/enrollment_service.py` (enroll patient, advance runtime, complete tasks)
- [ ] 4.3 Create `app/services/task_service.py` (list pending tasks for caregiver, complete + advance)
- [ ] 4.4 Create `app/services/admin_service.py` (list users, assign role, self-demotion guard)
- [ ] 4.5 Pytest coverage per service — golden path + every typed error path
- [ ] 4.6 Commit: `feat(backend): add pathway runtime and services`

## 5. Backend routers (F2–F8)

- [ ] 5.1 `app/api/routers/pathway_router.py` — `GET /pathways`, `GET /pathways/{id}`, `POST /pathways`, `PUT /pathways/{id}`; auth-required
- [ ] 5.2 `app/api/routers/patient_router.py` — `GET /patients` with `pathway_id` + `status` filters, `GET /patients/{id}` with enrollment + pathway + runtime state
- [ ] 5.3 `app/api/routers/task_router.py` — `GET /tasks`, `POST /tasks/{id}/complete`
- [ ] 5.4 `app/api/routers/admin_router.py` — `GET /users`, `POST /users/{id}/role`; admin-required
- [ ] 5.5 `app/api/routers/dashboard_router.py` — `GET /dashboard/summary` with `enrolled_patients`, `pending_tasks`, `active_pathways`
- [ ] 5.6 Wire all routers in `app/main.py`; expose under `/api/v1` if that's the existing prefix, else root (match `backend-setup` decisions)
- [ ] 5.7 Pytest coverage per router — golden path, unauth, forbidden, validation error envelope
- [ ] 5.8 Run `moon run backend:test` + `moon run backend:typecheck` + `moon run backend:lint` — all green
- [ ] 5.9 Commit: `feat(backend): add pathway patient task admin dashboard routers`

## 6. Orchestrator cleanup (smart-launch removal)

- [ ] 6.1 Delete `apps/orchestrator/src/modules/smart-launch/` (entire directory + tests)
- [ ] 6.2 Delete `apps/orchestrator/src/routes/launch.tsx`
- [ ] 6.3 Remove `/launch` references from `apps/orchestrator/src/app/router.ts`, README/docs, and any imports
- [ ] 6.4 Update `apps/orchestrator/AGENTS.md`: drop SMART-launch references; note `/login` is the only entry point in PoC
- [ ] 6.5 Run `moon run orchestrator:typecheck` + `moon run orchestrator:test` — green
- [ ] 6.6 Commit: `chore(orchestrator): remove smart-launch module and route`

## 7. Orchestrator typegen sync

- [ ] 7.1 Run `moon run orchestrator:typegen` to refresh `apps/orchestrator/src/lib/api/schema.d.ts` against the new backend OpenAPI
- [ ] 7.2 Spot-check generated types exist for each new route in `pathway/`, `patient/`, `task/`, `admin/`, `dashboard/` operations
- [ ] 7.3 Commit: `chore(orchestrator): regenerate api schema after backend additions`

## 8. Orchestrator: pathway-builder (F3)

- [ ] 8.1 Create `apps/orchestrator/src/modules/pathway/` (api, hooks, keys, schemas)
- [ ] 8.2 Implement list page at `apps/orchestrator/src/routes/_auth/zorgpaden.tsx` (replace placeholder)
- [ ] 8.3 Add composer route at `apps/orchestrator/src/routes/_auth/zorgpaden.$pathwayId.tsx` with the dev-composer JSON textarea + Save button
- [ ] 8.4 Wire toast on save error via `ErrorResponse.code` i18n lookup
- [ ] 8.5 Vitest coverage for hooks + components; Playwright happy path for create + save
- [ ] 8.6 Commit: `feat(orchestrator): add pathway list and composer skeleton`

## 9. Orchestrator: patients-overview (F4)

- [ ] 9.1 Create `apps/orchestrator/src/modules/patient/` (api, hooks, keys, schemas)
- [ ] 9.2 Implement list page at `apps/orchestrator/src/routes/_auth/patienten.tsx` with pathway + status filters reflected in URL search params
- [ ] 9.3 Vitest coverage for filter behaviour; row-click navigation test
- [ ] 9.4 Commit: `feat(orchestrator): add patients overview with filters`

## 10. Orchestrator: patient-view (F5)

- [ ] 10.1 Add detail route at `apps/orchestrator/src/routes/_auth/patienten.$patientId.tsx`
- [ ] 10.2 Render block list with current-block highlight + completed strike-through
- [ ] 10.3 Implement Luscii block embed (read-only JSON code panel — no transformation)
- [ ] 10.4 Vitest coverage: current-block highlight, completed marker, Luscii payload renders verbatim
- [ ] 10.5 Commit: `feat(orchestrator): add patient detail with pathway visualization`

## 11. Orchestrator: task-inbox (F6)

- [ ] 11.1 Create `apps/orchestrator/src/modules/task/` (api, hooks, keys, schemas)
- [ ] 11.2 Implement inbox at `apps/orchestrator/src/routes/_auth/taken.tsx` (replace placeholder)
- [ ] 11.3 Wire Complete action with optimistic update + cache invalidation for the affected enrollment
- [ ] 11.4 Vitest coverage for complete action; Playwright happy path: complete task → patient view shows advanced step
- [ ] 11.5 Commit: `feat(orchestrator): add task inbox`

## 12. Orchestrator: admin-users (F8)

- [ ] 12.1 Create `apps/orchestrator/src/modules/admin/` (api, hooks, keys, schemas)
- [ ] 12.2 Implement admin page at `apps/orchestrator/src/routes/_auth/instellingen.tsx` (replace placeholder) with admin-only guard + forbidden state
- [ ] 12.3 Wire role-assign action with self-demotion error toast
- [ ] 12.4 Vitest coverage for guard, forbidden render, role assignment
- [ ] 12.5 Commit: `feat(orchestrator): add admin users page`

## 13. Orchestrator: dashboard data (F2)

- [ ] 13.1 Create `apps/orchestrator/src/modules/dashboard/` (api, hooks, keys)
- [ ] 13.2 Replace static `DashboardPage` content with three count cards bound to `GET /dashboard/summary`
- [ ] 13.3 Wire drill-down navigation per card (patients → `/patienten`, tasks → `/taken`, pathways → `/zorgpaden`)
- [ ] 13.4 Add loading skeletons + error state
- [ ] 13.5 Vitest coverage for loading, error, drill-down
- [ ] 13.6 Commit: `feat(orchestrator): bind dashboard cards to live counts`

## 14. Seed data + MSW handlers

- [ ] 14.1 Author Alembic data migration (or a `seed` CLI) seeding: 1 admin, 2 caregivers, 5 synthetic patients, 2 sample pathways (one with a `luscii_care_path` block carrying static JSON), 1 enrollment per patient, a few pending tasks
- [ ] 14.2 Update `apps/orchestrator/src/mocks/handlers/` to mirror every new endpoint so Playwright runs without a live backend
- [ ] 14.3 Verify the demo path manually: login → dashboard → create pathway → enroll patient → patient view → complete task → dashboard counts update

## 15. Verification

- [ ] 15.1 `moon ci` — full affected-only build + lint + typecheck + test green
- [ ] 15.2 `openspec validate align-stack-with-poc-scope --strict` — passes
- [ ] 15.3 Read-aloud test on a new contributor: open `scope.md` + every `## ADDED Requirements` in this change; can they describe F1–F8 in under two minutes? (`owner: user`)
- [ ] 15.4 Update `openspec/backlog.md` `BL-025` entry note: "Resolved by `align-stack-with-poc-scope` on YYYY-MM-DD — section 12 narrowed, FHIR placeholders removed."
- [ ] 15.5 Archive the change via `openspec archive align-stack-with-poc-scope`
