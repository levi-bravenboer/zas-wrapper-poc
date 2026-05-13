**Tier**: [poc]

**Promotes**: `BL-025` (backend section-12 keep/narrow/revert decision).

## Why

`apps/backend` and `apps/orchestrator` carry code that pre-dates the tightened PoC scope (`openspec/scope.md`). Two problems:

1. **Drift in**: backend ships FHIR-shaped scaffolding (`app/schemas/fhir.py`, FHIR verbs on the HiX adapter Protocol, `tests/fixtures/fhir.py`); orchestrator ships a full SMART-on-FHIR launch module + `/launch` route. Both are `[mvp]` per scope.
2. **Drift out**: F2–F8 surfaces have no real backend models or UI yet. Routes (`patienten`, `taken`, `zorgpaden`, `instellingen`) are placeholders; backend has only auth + system routers. Dashboard is a stub.

We need one umbrella change that defines the cleanup + the F1–F8 stubs so the rest of PoC work can build on a scope-aligned spine. No live integrations land here; this is the foundation pass.

## What Changes

**Remove (out-of-tier scaffolding)**
- **BREAKING**: drop `app/schemas/fhir.py` placeholder FHIR types (Patient / Observation / Encounter).
- **BREAKING**: narrow `app/adapters/hix/protocol.py` to a `ping()`-only `HixClient` Protocol; drop `get_patient` and FHIR-shaped fixtures (`app/adapters/hix/_fixtures.py`, `tests/fixtures/fhir.py`).
- **BREAKING**: slim `apps/backend/AGENTS.md` "FHIR-Readiness Rules" section to a one-paragraph pointer ("FHIR rules apply at `[mvp]`; see `openspec/scope.md`").
- **BREAKING**: remove `apps/orchestrator/src/modules/smart-launch/` and the `/launch` route; drop `smart-launch-stub` spec.
- Remove SMART references from orchestrator AGENTS.md / docs where they imply current PoC behaviour.

**Add (F1–F8 spine)**
- F7 backend: pathway / patient / task domain models + persistence (SQLAlchemy + Alembic), task service, OpenAPI surface for the routers below.
- F3 routers + UI shell: `POST /pathways`, `GET /pathways`, `GET /pathways/{id}`; `zorgpaden` route renders list + opens composer page (skeleton — composer interactions land in a follow-up `[poc]` change).
- F4 routers + UI: `GET /patients` with pathway/status filters; `patienten` route renders the list, row click → `F5`.
- F5 router + UI: `GET /patients/{id}` returning current pathway + step + Luscii block JSON; patient detail route renders the pathway viz.
- F6 routers + UI: `GET /tasks`, `POST /tasks/{id}/complete`; `taken` route renders the inbox.
- F8 routers + UI: `GET /users`, `POST /users/{id}/role`; `instellingen` route exposes admin list (bootstrapped admin only).
- F2 dashboard: counts query backed by the new routers; cards render real numbers, drill-down links wired.
- Seeded fixtures for caregivers, patients, pathways, tasks, one Luscii clinical care path JSON.

## Capabilities

### New Capabilities

- `pathway-domain`: F7 backend — pathway / patient / task domain models, repositories, services, OpenAPI surface; care pathway = our composition, clinical care path = opaque Luscii block (static JSON).
- `pathway-builder`: F3 — pathways list page, composer skeleton route, save-to-DB API hook, "saved = enrollable" semantics.
- `patients-overview`: F4 — patients list page with pathway + status filters, row → patient detail navigation.
- `patient-view`: F5 — single-patient page showing current pathway, current step, completed + upcoming steps, embedded Luscii clinical-care-path block from static JSON.
- `task-inbox`: F6 — cross-patient task inbox, mark-complete action updates pathway state.
- `admin-users`: F8 — minimal admin: list users, assign caregiver role; bootstrapped admin only.
- `dashboard-data`: F2 — backend counts endpoint feeding the dashboard cards; replaces the placeholder dashboard.

### Modified Capabilities

- `external-adapters`: HiX Protocol narrowed to `ping()`-only (no FHIR verbs in PoC). Luscii Protocol stays as today.
- `dashboard-shell`: dashboard cards bind to `dashboard-data` counts instead of static stubs; drill-down links wired to F4 / F6.

(Removal of `smart-launch-stub` is captured via a delta spec marking its requirements as removed; see `specs/smart-launch-stub/spec.md` in this change.)

## Impact

- **Code**: large net-positive surface in `apps/backend/app/` (models, routers, services, migrations) + `apps/orchestrator/src/modules/` (pathway, patient, task, admin modules). Net-negative on `app/schemas/fhir.py`, `app/adapters/hix/_fixtures.py`, `tests/fixtures/fhir.py`, `app/adapters/hix/protocol.py` FHIR verbs, and the entire `apps/orchestrator/src/modules/smart-launch/` tree + `/launch` route.
- **Persistence**: introduces SQLAlchemy + Alembic to `apps/backend` (was in-memory only). Migration baseline lands in this change.
- **APIs**: backend OpenAPI surface grows substantially (~6 routers added). Orchestrator regenerates `lib/api/schema.d.ts` via the existing typegen task.
- **Tests**: every new router gets pytest coverage; every new orchestrator module gets Vitest + (where it's a route flow) Playwright coverage.
- **Out of scope**: live HiX, live Luscii, real auth, HiX embed, notifications, two-way task sync — all `[mvp]`. The composer's drag-and-drop interaction, full block library, and pathway versioning are tracked under follow-up `[poc]` changes once this skeleton lands. Pathway publish step (`BL-031`) stays `[mvp]`.
- **Cross-stack contract**: every F gets an OpenAPI shape locked before the orchestrator binding lands so frontend tasks unblock as soon as the backend router merges.
- **Risk**: this change adds persistence + alembic to a backend that had neither. The migration baseline must be authored carefully so the worktree (and CI) can re-run `alembic upgrade head` against a clean DB.
