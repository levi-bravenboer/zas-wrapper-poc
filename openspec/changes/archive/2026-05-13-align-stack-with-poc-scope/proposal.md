**Tier**: [poc]

**Promotes**: `BL-025` (backend section-12 keep/narrow/revert decision).

## Why

`apps/backend` and `apps/orchestrator` carry code that pre-dates the tightened PoC scope (`openspec/scope.md`):

1. **Backend drift in**: FHIR-shaped scaffolding (`app/schemas/fhir.py`, FHIR verbs on the HiX adapter Protocol, `tests/fixtures/fhir.py`). All `[mvp]` per scope.
2. **Orchestrator drift in**: full SMART-on-FHIR launch module + `/launch` route. `[mvp]` per scope.
3. **No structural foundation**: backend has no persistence, no repository layer, no documented layering. F1–F8 domains can't land cleanly until the spine is in place.

This change clears the out-of-tier scaffolding and lands the structural foundation (persistence + repositories + UoW session + documented layering). Domain implementations (F1–F8) land in follow-up `[poc]` changes — one worktree per domain.

## What Changes

**Remove (out-of-tier scaffolding)**
- **BREAKING**: drop `app/schemas/fhir.py` placeholder FHIR types (Patient / Observation / Encounter).
- **BREAKING**: narrow `app/adapters/hix/protocol.py` to a `ping()`-only `HixClient` Protocol; drop `get_patient` and FHIR-shaped fixtures (`app/adapters/hix/_fixtures.py`, `tests/fixtures/fhir.py`).
- **BREAKING**: slim `apps/backend/AGENTS.md` "FHIR-Readiness Rules" section to a one-paragraph pointer ("FHIR rules apply at `[mvp]`; see `openspec/scope.md`").
- **BREAKING**: remove `apps/orchestrator/src/modules/smart-launch/` and the `/launch` route; drop `smart-launch-stub` spec.
- Remove SMART references from orchestrator AGENTS.md / docs where they imply current PoC behaviour.

**Add (structural foundation only)**
- Persistence: SQLAlchemy 2.x async + Alembic wired against `BACKEND_DATABASE_URL` (SQLite for dev, Postgres-ready for prod).
- `app/repositories/` layer with `BaseRepository[T]` generic; no domain repositories land here.
- `get_session` request-scoped Unit of Work (auto-commit on success, rollback on exception).
- `apps/backend/AGENTS.md` rewritten: layer-by-type + domain-split-inside-every-layer layout, layer-rules table, DI rules (services as classes, never import `fastapi`), transaction-boundary rules, naming conventions, tests-mirror-tree.

**Out of scope (moved to follow-up `[poc]` changes — one per domain)**
- F1 user + auth domain (model, repository, auth service, login/logout/me routes, bootstrap admin).
- F2 dashboard counts.
- F3 pathway domain + composer skeleton.
- F4 patients-overview.
- F5 patient-view.
- F6 task-inbox + enrollment runtime.
- F8 admin-users.
- Seed data + MSW handlers for the orchestrator demo path.

## Capabilities

### Modified Capabilities

- `external-adapters`: HiX Protocol narrowed to `ping()`-only (no FHIR verbs in PoC). Luscii Protocol stays as today.

(Removal of `smart-launch-stub` is captured via a delta spec marking its requirements as removed; see `specs/smart-launch-stub/spec.md` in this change.)

## Impact

- **Code**: net-negative on `app/schemas/fhir.py`, `app/adapters/hix/_fixtures.py`, `tests/fixtures/fhir.py`, FHIR verbs on the HiX Protocol, and the entire `apps/orchestrator/src/modules/smart-launch/` tree + `/launch` route. Net-positive on `app/db/`, `app/repositories/base.py`, `apps/backend/alembic/`, and `apps/backend/AGENTS.md`.
- **Persistence**: introduces SQLAlchemy + Alembic to `apps/backend` (was in-memory only). Migration baseline + async env land here; no domain tables yet.
- **APIs**: backend OpenAPI surface unchanged — system router only. Orchestrator typegen unchanged.
- **Tests**: existing tests stay green; new `tests/conftest.py` fixtures (`db_engine`, `db_session`, `app`, `client`) ready for follow-up domain changes to consume.
- **Out of scope**: live HiX, live Luscii, real auth, HiX embed, notifications, two-way task sync — all `[mvp]`. All F1–F8 domain code lands in dedicated follow-up `[poc]` changes (one worktree per domain).
- **Risk**: this change adds persistence + alembic to a backend that had neither. The migration baseline must be authored carefully so the worktree (and CI) can re-run `alembic upgrade head` against a clean DB. No domain migrations land here; follow-up changes add their own.
