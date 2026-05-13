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

Land the layering before any domain code. Everything below this point follows the layout, layer rules, DI contract, and transaction-boundary rules in `apps/backend/AGENTS.md`. Domain implementations land in follow-up `[poc]` changes per F (one worktree per domain).

- [x] 3.1 Roll back the first-pass entity scaffolding (domain models, services, routers, baseline migration) so the foundation lands on top of `e273eba`
- [x] 3.2 Drop the auth stub, `SessionSigner`, and `bootstrap_admin_*` settings/env defaults; they re-land inside the user + auth domain change
- [x] 3.3 Add `app/repositories/__init__.py` + `app/repositories/base.py` with a `BaseRepository[T]` generic
- [x] 3.4 Wire `get_session` in `app/db/engine.py` as a request-scoped unit of work (auto-commit on success, rollback on exception)
- [x] 3.5 Rewrite `apps/backend/AGENTS.md`: layout (layer-by-type + domain split inside every layer), layer-rules table, DI rules (services as classes, never import `fastapi`), transaction boundary, naming conventions, tests mirror tree
- [x] 3.6 Verify `moon run backend:typecheck` + `moon run backend:test` + `moon run backend:lint` — green
- [x] 3.7 Commit: `chore(backend): purge entity scaffolding and bootstrap admin coupling`, `feat(backend): add repositories layer and unit-of-work session dep`, `docs(backend): rewrite agents.md for domain-split layering`

## 4. Orchestrator cleanup (smart-launch removal)

- [x] 4.1 Delete `apps/orchestrator/src/modules/smart-launch/` (entire directory + tests)
- [x] 4.2 Delete `apps/orchestrator/src/routes/launch.tsx`
- [x] 4.3 Remove `/launch` references from `apps/orchestrator/src/app/router.ts`, README/docs, and any imports
- [x] 4.4 Update `apps/orchestrator/AGENTS.md`: drop SMART-launch references; note `/login` is the only entry point in PoC
- [x] 4.5 Run `moon run orchestrator:typecheck` + `moon run orchestrator:test` — green
- [x] 4.6 Commit: `chore(orchestrator): remove smart-launch module and route`

## 5. Verification

- [x] 5.1 `moon ci` — backend gates + orchestrator typecheck/test/lint/build/test-e2e green; orchestrator `format` task fails on pre-existing biome schema drift (`files.ignore` + `organizeImports` no longer valid in current biome) — not introduced by this change
- [x] 5.2 `openspec validate align-stack-with-poc-scope --strict` — passes
- [x] 5.3 Update `openspec/backlog.md` `BL-025` entry note marking resolution by this change
- [x] 5.4 Add follow-up `[poc]` change stubs to `openspec/backlog.md` for each F1–F8 domain (BL-035..BL-041)
- [ ] 5.5 Archive the change via `openspec archive align-stack-with-poc-scope`
