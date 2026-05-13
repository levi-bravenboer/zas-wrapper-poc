## Context

Backend ships auth + system routers only; persistence is in-memory; FHIR-shaped placeholders linger from `backend-setup` section 12. Orchestrator ships app shell + auth + a full SMART-on-FHIR launch module that scope.md now excludes from PoC. No documented backend layering, no repository layer, no transaction-boundary contract.

Scope ledger (`openspec/scope.md`) defines `F1`..`F8` and the hard invariants: never an MDR medical device, no real patient data, FHIR-ready *seam* (not FHIR-built), Belgian hosting for production. This change clears the out-of-tier scaffolding and lands the structural spine. F1–F8 domains land in follow-up `[poc]` changes — one worktree per domain.

## Goals / Non-Goals

**Goals:**

- Remove FHIR scaffolding from `apps/backend`.
- Remove SMART launch from `apps/orchestrator`.
- Make persistence real (SQLAlchemy 2.x async + Alembic) — required by every F2–F8 surface that follows.
- Land a `repositories/` layer with a `BaseRepository[T]` generic so follow-up domains slot in cleanly.
- Wire a request-scoped Unit of Work session dep (auto-commit on success, rollback on exception) so services and repositories never call `session.commit()` themselves.
- Document the layering contract in `apps/backend/AGENTS.md` (layer-by-type at the top, domain-split inside every layer; layer-rules import table; DI rules; tests mirror src tree).
- Preserve the FHIR-ready seam: HiX adapter Protocol stays — narrowed to `ping()` — so `[mvp]` swap-in is wiring, not a rewrite.

**Non-Goals:**

- Any F1–F8 domain code (user, auth, pathway, patient, enrollment, task, admin, dashboard). Each lands in its own follow-up `[poc]` change.
- Seed data / MSW handlers.
- Orchestrator feature wiring beyond the SMART removal.
- Live HiX / Luscii / IdP — `[mvp]`.

## Decisions

### Persistence: SQLAlchemy 2.x + Alembic, SQLite (dev) / Postgres-ready (prod)

- **Why**: PoC needs real persistence for pathways, patients, tasks, users (landing in follow-up changes). In-memory blocks F4 filtering, F6 task state mutation, F8 admin assignment.
- **Why SQLAlchemy 2.x async**: matches FastAPI's async story; mature; works against SQLite for the worktree and Postgres later without code change.
- **Why Alembic**: migration baseline is required even for PoC — schema will change as F-domain changes land. Avoids stop-the-world rewrites.
- **SQLite for dev only**. Settings selects DSN; tests use `sqlite+aiosqlite:///:memory:`; staging would use Postgres. Belgian hosting (`[mvp]`) drives Postgres choice.
- **Alternative considered**: Tortoise ORM (simpler), raw asyncpg. Rejected — SQLAlchemy is the de-facto FastAPI stack and migrations are unavoidable.

### Layering: layer-by-type at top, domain-split inside every layer

- `app/api/routers/<domain>/`, `app/services/<domain>/`, `app/repositories/<domain>/`, `app/db/models/<domain>/`, `app/schemas/<domain>/`. A domain MAY skip layers it does not need (e.g. `auth` reuses the `user` model + repository; `dashboard` reads aggregates and has no model).
- **Why hybrid**: pure module-by-feature hides cross-cutting infra (engine, base classes, errors); pure layer-by-type produces 200-file folders. Layer-at-top + domain-folder-inside keeps the seam direction one-way (`router → service → repository → db.models`) while keeping every feature's surface area in one navigable tree.
- Adapters plug in at the service layer via constructor DI. Repositories never see services, schemas, or HTTP. Cross-domain calls between services are allowed; cross-domain calls between repositories are not (compose at the service layer).

### Repository layer + Unit of Work session

- `BaseRepository[T]` generic in `app/repositories/base.py`; per-domain subclasses set `model: type[T]` and add entity-specific query methods.
- Repositories own SQL — services orchestrate, repositories fetch and persist. Repositories MUST NOT raise domain errors (return `None` / empty collections instead) and MUST NOT call `session.commit()`.
- `get_session` in `app/db/engine.py` is the **request-scoped unit of work**: commits on successful handler return, rolls back on raised exception. Services use `await session.flush()` when they need an INSERT-generated id mid-request; `async with session.begin_nested()` is the escape hatch for partial-atomicity savepoints.
- **Why**: keeps transaction boundary in one place (the session dep) instead of every service method. Follow-up domains can focus on business logic, not commit/rollback plumbing.

### Dependency injection: services as classes, constructor DI

- Services are classes (`class PathwayService: def __init__(self, repo: PathwayRepository, hix: HixClient) -> None`), not module functions. Adapters and sibling services are passed in via the constructor.
- Services NEVER import `fastapi`. Wiring (`Depends`) belongs to the router layer.
- Per-domain `Annotated[Service, Depends(get_<domain>_service)]` factories live next to the service in `app/services/<domain>/deps.py` and re-export the alias from the domain's `__init__.py`. Routers import the `<Domain>ServiceDep` alias only.
- **Why**: services stay framework-agnostic (testable without FastAPI's TestClient), and routers stay declarative.

### HiX adapter narrowing

- Keep `HixClient` Protocol, narrow to `async def ping() -> None` only. Stub returns immediately.
- **Why keep the Protocol**: it's the FHIR-ready seam. At `[mvp]` we restore FHIR verbs (`read`, `search`, `create`). The seam belongs to current architecture even though no code calls FHIR verbs today.
- Drop `app/schemas/fhir.py`, `app/adapters/hix/_fixtures.py`, `tests/fixtures/fhir.py`.

### SMART launch removal

- Delete `apps/orchestrator/src/modules/smart-launch/` and `src/routes/launch.tsx`.
- Spec `smart-launch-stub` gets a delta with `## REMOVED Requirements` covering every requirement currently in it.
- Auth becomes the only entry point: `/login` → `/` (dashboard). No `/launch?iss=...` path.
- **Why delete vs dormant**: smart-launch-stub was implemented PoC code, not a dormant proposal. Code that isn't wired and isn't tested rots. Restore at `[mvp]` from the archived `smart-launch-stub` spec.

### Tests mirror src tree

- `tests/services/pathway/test_pathway_service.py` mirrors `app/services/pathway/pathway_service.py`. Running `pytest tests/services/pathway/` exercises one domain end-to-end.
- Conftest cascades: shared fixtures in `tests/conftest.py`, layer-shared in `tests/<layer>/conftest.py`, domain-shared in `tests/<layer>/<domain>/conftest.py`.
- Session-scoped `db_engine` fixture runs `alembic upgrade head` against `sqlite+aiosqlite:///:memory:` once per session; per-test `db_session` opens a fresh `AsyncSession`. Router tests use FastAPI `TestClient` with `app.dependency_overrides` for DI stubbing.

## Risks / Trade-offs

- **Migration baseline risk**: introducing Alembic + an empty baseline in the same change. → Mitigation: env wires `config.attributes["connection"]` for async + offline modes; `alembic upgrade head` verified against fresh SQLite in tests before merge.
- **Empty repositories layer**: `BaseRepository[T]` lands without any concrete subclass. → Acceptable: the alternative (delaying it to the first domain change) just shifts the same code into a domain commit and obscures the layering decision.
- **Deletion of working SMART code**: someone may want it back at `[mvp]`. → Mitigation: archived spec + commit history; the implementation patterns survive even if the code doesn't.
- **Tests-mirror-tree rule is aspirational**: only `tests/conftest.py` + a few adapter tests exist today. → Acceptable: the rule documents the target so follow-up domain changes start in the right shape, not because we expect to backfill it here.

## Migration Plan

1. **Backend cleanup** (section 1) — already landed in earlier commits on this branch.
2. **Persistence foundation** (section 2) — SQLAlchemy + Alembic, empty baseline migration, conftest fixtures wired against `:memory:`; already landed.
3. **Structural foundation** (section 3) — repositories layer + UoW session dep + AGENTS.md rewrite; already landed.
4. **Orchestrator cleanup** (section 4) — SMART launch removal; pending.
5. **Verification** (section 5) — `moon ci` green, `openspec validate --strict` passes, backlog updated with follow-up F1–F8 change stubs, archive.

Rollback: revert per commit; alembic downgrades to baseline-zero (empty schema). No PoC data is real — wiping the DB is free.

## Open Questions

None outstanding for this narrowed scope. Domain-shape questions (composer textarea behaviour, bootstrap admin secret handling, F5 viz strategy) move with their respective F changes.
