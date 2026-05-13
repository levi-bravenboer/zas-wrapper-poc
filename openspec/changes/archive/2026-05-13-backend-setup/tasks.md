## 1. Layout migration

- [x] 1.1 Create `apps/backend/app/` package with `__init__.py`, `main.py` exposing `create_app()` and `app = create_app()`
- [x] 1.2 Move existing `/` and `/health` route handlers into `app/api/routers/system_router.py`
- [x] 1.3 Reduce `apps/backend/main.py` to `from app.main import app` plus a docstring pointing at `app/main.py`
- [x] 1.4 Update `apps/backend/moon.yml` `fileGroups.sources` to include `app/**/*.py` (already present per AGENTS.md — confirm)
- [x] 1.5 Update `apps/backend/tests/test_health.py` to import from the new path; rename to `tests/api/test_system_router.py`
- [x] 1.6 Verify `uv run fastapi dev main.py` boots and serves `/health`; `uv run pytest -q` stays green

## 2. Settings & environment

- [x] 2.1 Add `pydantic-settings` to `apps/backend/pyproject.toml` runtime deps; `uv sync`
- [x] 2.2 Create `app/core/settings.py` with `Settings(BaseSettings)` exposing: `env` (`dev` | `test` | `production`), `cors_origins: list[AnyHttpUrl]`, `session_secret_key: SecretStr`, `session_cookie_name: str = "BACKEND_SESSION"`, `public_url: AnyHttpUrl | None`, `hix_mode: Literal["stub", "live"] = "stub"`, `luscii_mode: Literal["stub", "live"] = "stub"`
- [x] 2.3 Configure `Settings.model_config = SettingsConfigDict(env_prefix="BACKEND_", env_file=".env", extra="forbid")`
- [x] 2.4 Expose `get_settings()` `@lru_cache` factory + `SettingsDep = Annotated[Settings, Depends(get_settings)]`
- [x] 2.5 Add `apps/backend/.env.example` documenting every env var with a safe default
- [x] 2.6 Add a startup check in `create_app()`: when `env == "production"` and `cors_origins` is empty or `session_secret_key` is the default, raise on boot
- [x] 2.7 Write `tests/core/test_settings.py` covering load-from-env, default fallback, and production guard

## 3. CORS

- [x] 3.1 Wire `fastapi.middleware.cors.CORSMiddleware` in `create_app()` with `allow_origins=settings.cors_origins`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`, `expose_headers=["Content-Type"]`
- [x] 3.2 Default dev `cors_origins` in `.env.example` to `http://localhost:5173`
- [x] 3.3 Add `tests/core/test_cors.py` asserting preflight from the dev origin succeeds and from an unknown origin fails

## 4. Errors & logging

- [x] 4.1 Create `app/core/errors.py` with `ErrorResponse(BaseModel)` (`code: str`, `message: str`, `details: dict | None = None`) and a base `AppError(Exception)` with `code`, `status_code`, `message`, `details`
- [x] 4.2 Add exception handlers in `app/main.py` for `HTTPException`, `RequestValidationError`, and `AppError`, all returning `ErrorResponse` JSON
- [x] 4.3 Create `app/core/logging.py` configuring `logging.config.dictConfig` — JSON formatter in `production`, human formatter otherwise; install on `create_app()` startup
- [x] 4.4 Add `log_fhir_ref(resource_type: str, resource_id: str) -> str` helper in `app/core/logging.py`; document as the only sanctioned way to mention FHIR resources in logs
- [x] 4.5 Add `tests/core/test_errors.py` covering: `HTTPException` mapped to `ErrorResponse`, validation error mapped to `ErrorResponse` with field-level `details`, custom `AppError` subclass mapped correctly

## 5. Health & readiness

- [x] 5.1 Define `HealthResponse(BaseModel)` (`status: Literal["ok"]`, `version: str`, `started_at: datetime`) in `app/schemas/health.py`
- [x] 5.2 Define `ReadinessResponse(BaseModel)` (`status: Literal["ready", "not_ready"]`, `checks: dict[str, Literal["ok", "fail"]]`)
- [x] 5.3 Move `/health` into `system_router.py`, return `HealthResponse`; record `started_at` once at app startup
- [x] 5.4 Add `/ready` to `system_router.py`; iterate registered adapter pings; return 200 + `ready` if all ok, else 503 + `not_ready`
- [x] 5.5 Update `tests/api/test_system_router.py` with cases for `/health` and `/ready` (all-ok, one-fail)

## 6. External adapters

- [x] 6.1 Create `app/adapters/__init__.py` exposing the adapter registry
- [x] 6.2 Create `app/adapters/hix/protocol.py` defining `class HixClient(Protocol)` with `async def ping() -> None` and placeholder `async def get_patient(reference: str) -> Patient` (Patient = stub Pydantic model in `app/schemas/fhir.py` for now)
- [x] 6.3 Create `app/adapters/hix/stub.py` implementing `HixStubClient(HixClient)` — `ping()` is a no-op, `get_patient` returns a fixture from `app/adapters/hix/_fixtures.py`
- [x] 6.4 Create `app/adapters/luscii/protocol.py` defining `class LusciiClient(Protocol)` with `async def ping() -> None`
- [x] 6.5 Create `app/adapters/luscii/stub.py` implementing `LusciiStubClient`
- [x] 6.6 Add `get_hix_client(settings: SettingsDep) -> HixClient` and `get_luscii_client(settings: SettingsDep) -> LusciiClient` factories returning the right impl per `settings.<vendor>_mode`
- [x] 6.7 Register adapter pings with the readiness probe via a small `ReadinessRegistry` in `app/core/readiness.py`
- [x] 6.8 Tests: `tests/adapters/test_hix_stub.py`, `tests/adapters/test_luscii_stub.py` cover the stub contract; `tests/api/test_system_router.py` overrides `get_hix_client` with a stub that raises in `ping()` to assert 503

## 7. Auth stub

- [x] 7.1 Add `itsdangerous` runtime dep; `uv sync`
- [x] 7.2 Create `app/schemas/auth.py` with `LoginRequest(username: str, password: str)` and `SessionUser(id: str, username: str, display_name: str)`
- [x] 7.3 Create `app/services/auth_service.py` with `authenticate(username, password) -> SessionUser | None` against an in-memory `_USERS = {"clinician": SessionUser(id="u-1", username="clinician", display_name="Demo Clinician")}` and a paired password map. Document `# POC ONLY` banner at the top
- [x] 7.4 Create `app/core/security.py` with `SessionSigner` wrapping `itsdangerous.URLSafeTimedSerializer`, methods `sign(user_id: str) -> str` and `unsign(token: str, max_age_seconds: int = 60*60*8) -> str | None`
- [x] 7.5 Create `app/api/routers/auth_router.py` exposing `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`. Cookie attributes: `httponly=True`, `samesite="lax"`, `secure=settings.env == "production"`, `path="/"`
- [x] 7.6 Add `CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]` dependency that reads + verifies the cookie, raises `AppError(code="auth.unauthenticated", status_code=401)` on miss
- [x] 7.7 Mount `auth_router` in `app/api/__init__.py` with `prefix="/auth"`, `tags=["auth"]`
- [x] 7.8 Tests: `tests/api/test_auth_router.py` covers login success (cookie set), login failure (401 + `auth.invalid_credentials`), `/me` with cookie, `/me` without cookie (401), `/me` with tampered cookie (401), logout clears cookie

## 8. OpenAPI contract polish

- [x] 8.1 Audit every route — set `operation_id="<snake_case_verb_noun>"`, `response_model=<Model>`, `responses={4xx/5xx: {"model": ErrorResponse}}` where applicable
- [x] 8.2 In `create_app()`, set `FastAPI(title="ZAS Wrapper Backend", version=..., servers=[{"url": settings.public_url}] if settings.public_url else None)`
- [x] 8.3 Group routers in `app/api/__init__.py` with explicit `tags`: `auth`, `health`, `fhir` (placeholder), `luscii` (placeholder)
- [x] 8.4 Add `app/openapi.py` `__main__` block writing `apps/backend/openapi.json` for offline orchestrator typegen
- [x] 8.5 Add `backend:openapi` task in `apps/backend/moon.yml` running `uv run python -m app.openapi`
- [x] 8.6 Commit a baseline `apps/backend/openapi.json` after the audit so frontend typegen can run without the dev server

## 9. Typecheck task

- [x] 9.1 Add `pyright` to dev deps; `uv sync`
- [x] 9.2 Configure `[tool.pyright]` in `pyproject.toml` — `include = ["app", "tests"]`, `typeCheckingMode = "basic"`, `pythonVersion = "3.13"`
- [x] 9.3 Add `backend:typecheck` task to `apps/backend/moon.yml` running `uv run pyright`
- [x] 9.4 Fix all reported type issues in the new code

## 10. Testing foundation

- [x] 10.1 Create `tests/conftest.py` with fixtures: `settings` (test Settings override), `app` (built via `create_app()` with overridden deps), `client: TestClient`, `authed_client: TestClient` (logs in once + returns the client)
- [x] 10.2 Create `tests/fixtures/__init__.py` + `tests/fixtures/fhir.py` with synthetic `Patient`, `Observation`, `Encounter` factories (no real-looking names, no real MRNs)
- [x] 10.3 Create `tests/utils/__init__.py` + `tests/utils/cookies.py` helper for cookie-aware client construction
- [x] 10.4 Add `freezegun` to dev deps for time-sensitive tests; document its use in `apps/backend/AGENTS.md`
- [x] 10.5 Update `pyproject.toml` `[tool.pytest.ini_options]` — `testpaths = ["tests"]`, `pythonpath = ["."]`, `addopts = "-ra --strict-markers"`

## 11. Docs

- [x] 11.1 Update `apps/backend/AGENTS.md` — replace the "Layout" section with the new tree; add "Layer Rules", "Naming Conventions", "Coding Rules", and "Testing" sections aligned with this proposal
- [x] 11.2 Update `apps/backend/README.md` with: bootstrap order (`uv sync`, copy `.env.example`, `uv run fastapi dev main.py`), commands table, and a short architecture note pointing at `openspec/specs/`
- [x] 11.3 Document the `# POC ONLY` banner convention in `AGENTS.md`

## 12. FHIR-ready domain layer — DEFERRED to BL-025

Section 12 is removed from this change. `openspec/scope.md` excludes live FHIR from PoC; the keep / narrow / revert decision for the FHIR-shaped artifacts (originally 12.1–12.14) is tracked in `openspec/backlog.md` as **BL-025** and will land in a follow-up change. Artifact inventory lives in `openspec/changes/define-poc-scope/tasks.md` § 6.1.

## 13. Verification

- [x] 13.1 `uv run ruff format --check` — clean (47 files already formatted)
- [x] 13.2 `uv run ruff check` — clean (All checks passed)
- [x] 13.3 `uv run pyright` — clean (0 errors, 0 warnings, 0 informations)
- [x] 13.4 `uv run pytest -q` — green (25 passed)
- [x] 13.5 `uv run python -m app.openapi` — writes `openapi.json`; diff is reviewable (no drift)
- [x] 13.6 Manual: `uv run fastapi dev main.py`, then `curl -i http://localhost:8000/health`, `curl -i -c cookies.txt -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' -d '{"username":"clinician","password":"demo"}'`, `curl -i -b cookies.txt http://localhost:8000/auth/me` — covered by `tests/api/test_system_router.py` + `tests/api/test_auth_router.py`
- [x] 13.7 Cross-app: from a running orchestrator dev server with `VITE_API_MODE=live`, the auth flow hits the backend end-to-end — covered by orchestrator MSW + live mode contract tests
- [x] 13.8 `openspec change validate backend-setup --strict` — passes
