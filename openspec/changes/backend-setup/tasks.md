## 1. Layout migration

- [ ] 1.1 Create `apps/backend/app/` package with `__init__.py`, `main.py` exposing `create_app()` and `app = create_app()`
- [ ] 1.2 Move existing `/` and `/health` route handlers into `app/api/routers/system_router.py`
- [ ] 1.3 Reduce `apps/backend/main.py` to `from app.main import app` plus a docstring pointing at `app/main.py`
- [ ] 1.4 Update `apps/backend/moon.yml` `fileGroups.sources` to include `app/**/*.py` (already present per AGENTS.md — confirm)
- [ ] 1.5 Update `apps/backend/tests/test_health.py` to import from the new path; rename to `tests/api/test_system_router.py`
- [ ] 1.6 Verify `uv run fastapi dev main.py` boots and serves `/health`; `uv run pytest -q` stays green

## 2. Settings & environment

- [ ] 2.1 Add `pydantic-settings` to `apps/backend/pyproject.toml` runtime deps; `uv sync`
- [ ] 2.2 Create `app/core/settings.py` with `Settings(BaseSettings)` exposing: `env` (`dev` | `test` | `production`), `cors_origins: list[AnyHttpUrl]`, `session_secret_key: SecretStr`, `session_cookie_name: str = "BACKEND_SESSION"`, `public_url: AnyHttpUrl | None`, `hix_mode: Literal["stub", "live"] = "stub"`, `luscii_mode: Literal["stub", "live"] = "stub"`
- [ ] 2.3 Configure `Settings.model_config = SettingsConfigDict(env_prefix="BACKEND_", env_file=".env", extra="forbid")`
- [ ] 2.4 Expose `get_settings()` `@lru_cache` factory + `SettingsDep = Annotated[Settings, Depends(get_settings)]`
- [ ] 2.5 Add `apps/backend/.env.example` documenting every env var with a safe default
- [ ] 2.6 Add a startup check in `create_app()`: when `env == "production"` and `cors_origins` is empty or `session_secret_key` is the default, raise on boot
- [ ] 2.7 Write `tests/core/test_settings.py` covering load-from-env, default fallback, and production guard

## 3. CORS

- [ ] 3.1 Wire `fastapi.middleware.cors.CORSMiddleware` in `create_app()` with `allow_origins=settings.cors_origins`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`, `expose_headers=["Content-Type"]`
- [ ] 3.2 Default dev `cors_origins` in `.env.example` to `http://localhost:5173`
- [ ] 3.3 Add `tests/core/test_cors.py` asserting preflight from the dev origin succeeds and from an unknown origin fails

## 4. Errors & logging

- [ ] 4.1 Create `app/core/errors.py` with `ErrorResponse(BaseModel)` (`code: str`, `message: str`, `details: dict | None = None`) and a base `AppError(Exception)` with `code`, `status_code`, `message`, `details`
- [ ] 4.2 Add exception handlers in `app/main.py` for `HTTPException`, `RequestValidationError`, and `AppError`, all returning `ErrorResponse` JSON
- [ ] 4.3 Create `app/core/logging.py` configuring `logging.config.dictConfig` — JSON formatter in `production`, human formatter otherwise; install on `create_app()` startup
- [ ] 4.4 Add `log_fhir_ref(resource_type: str, resource_id: str) -> str` helper in `app/core/logging.py`; document as the only sanctioned way to mention FHIR resources in logs
- [ ] 4.5 Add `tests/core/test_errors.py` covering: `HTTPException` mapped to `ErrorResponse`, validation error mapped to `ErrorResponse` with field-level `details`, custom `AppError` subclass mapped correctly

## 5. Health & readiness

- [ ] 5.1 Define `HealthResponse(BaseModel)` (`status: Literal["ok"]`, `version: str`, `started_at: datetime`) in `app/schemas/health.py`
- [ ] 5.2 Define `ReadinessResponse(BaseModel)` (`status: Literal["ready", "not_ready"]`, `checks: dict[str, Literal["ok", "fail"]]`)
- [ ] 5.3 Move `/health` into `system_router.py`, return `HealthResponse`; record `started_at` once at app startup
- [ ] 5.4 Add `/ready` to `system_router.py`; iterate registered adapter pings; return 200 + `ready` if all ok, else 503 + `not_ready`
- [ ] 5.5 Update `tests/api/test_system_router.py` with cases for `/health` and `/ready` (all-ok, one-fail)

## 6. External adapters

- [ ] 6.1 Create `app/adapters/__init__.py` exposing the adapter registry
- [ ] 6.2 Create `app/adapters/hix/protocol.py` defining `class HixClient(Protocol)` with `async def ping() -> None` and placeholder `async def get_patient(reference: str) -> Patient` (Patient = stub Pydantic model in `app/schemas/fhir.py` for now)
- [ ] 6.3 Create `app/adapters/hix/stub.py` implementing `HixStubClient(HixClient)` — `ping()` is a no-op, `get_patient` returns a fixture from `app/adapters/hix/_fixtures.py`
- [ ] 6.4 Create `app/adapters/luscii/protocol.py` defining `class LusciiClient(Protocol)` with `async def ping() -> None`
- [ ] 6.5 Create `app/adapters/luscii/stub.py` implementing `LusciiStubClient`
- [ ] 6.6 Add `get_hix_client(settings: SettingsDep) -> HixClient` and `get_luscii_client(settings: SettingsDep) -> LusciiClient` factories returning the right impl per `settings.<vendor>_mode`
- [ ] 6.7 Register adapter pings with the readiness probe via a small `ReadinessRegistry` in `app/core/readiness.py`
- [ ] 6.8 Tests: `tests/adapters/test_hix_stub.py`, `tests/adapters/test_luscii_stub.py` cover the stub contract; `tests/api/test_system_router.py` overrides `get_hix_client` with a stub that raises in `ping()` to assert 503

## 7. Auth stub

- [ ] 7.1 Add `itsdangerous` runtime dep; `uv sync`
- [ ] 7.2 Create `app/schemas/auth.py` with `LoginRequest(username: str, password: str)` and `SessionUser(id: str, username: str, display_name: str)`
- [ ] 7.3 Create `app/services/auth_service.py` with `authenticate(username, password) -> SessionUser | None` against an in-memory `_USERS = {"clinician": SessionUser(id="u-1", username="clinician", display_name="Demo Clinician")}` and a paired password map. Document `# POC ONLY` banner at the top
- [ ] 7.4 Create `app/core/security.py` with `SessionSigner` wrapping `itsdangerous.URLSafeTimedSerializer`, methods `sign(user_id: str) -> str` and `unsign(token: str, max_age_seconds: int = 60*60*8) -> str | None`
- [ ] 7.5 Create `app/api/routers/auth_router.py` exposing `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`. Cookie attributes: `httponly=True`, `samesite="lax"`, `secure=settings.env == "production"`, `path="/"`
- [ ] 7.6 Add `CurrentUserDep = Annotated[SessionUser, Depends(get_current_user)]` dependency that reads + verifies the cookie, raises `AppError(code="auth.unauthenticated", status_code=401)` on miss
- [ ] 7.7 Mount `auth_router` in `app/api/__init__.py` with `prefix="/auth"`, `tags=["auth"]`
- [ ] 7.8 Tests: `tests/api/test_auth_router.py` covers login success (cookie set), login failure (401 + `auth.invalid_credentials`), `/me` with cookie, `/me` without cookie (401), `/me` with tampered cookie (401), logout clears cookie

## 8. OpenAPI contract polish

- [ ] 8.1 Audit every route — set `operation_id="<snake_case_verb_noun>"`, `response_model=<Model>`, `responses={4xx/5xx: {"model": ErrorResponse}}` where applicable
- [ ] 8.2 In `create_app()`, set `FastAPI(title="ZAS Wrapper Backend", version=..., servers=[{"url": settings.public_url}] if settings.public_url else None)`
- [ ] 8.3 Group routers in `app/api/__init__.py` with explicit `tags`: `auth`, `health`, `fhir` (placeholder), `luscii` (placeholder)
- [ ] 8.4 Add `app/openapi.py` `__main__` block writing `apps/backend/openapi.json` for offline orchestrator typegen
- [ ] 8.5 Add `backend:openapi` task in `apps/backend/moon.yml` running `uv run python -m app.openapi`
- [ ] 8.6 Commit a baseline `apps/backend/openapi.json` after the audit so frontend typegen can run without the dev server

## 9. Typecheck task

- [ ] 9.1 Add `pyright` to dev deps; `uv sync`
- [ ] 9.2 Configure `[tool.pyright]` in `pyproject.toml` — `include = ["app", "tests"]`, `typeCheckingMode = "basic"`, `pythonVersion = "3.13"`
- [ ] 9.3 Add `backend:typecheck` task to `apps/backend/moon.yml` running `uv run pyright`
- [ ] 9.4 Fix all reported type issues in the new code

## 10. Testing foundation

- [ ] 10.1 Create `tests/conftest.py` with fixtures: `settings` (test Settings override), `app` (built via `create_app()` with overridden deps), `client: TestClient`, `authed_client: TestClient` (logs in once + returns the client)
- [ ] 10.2 Create `tests/fixtures/__init__.py` + `tests/fixtures/fhir.py` with synthetic `Patient`, `Observation`, `Encounter` factories (no real-looking names, no real MRNs)
- [ ] 10.3 Create `tests/utils/__init__.py` + `tests/utils/cookies.py` helper for cookie-aware client construction
- [ ] 10.4 Add `freezegun` to dev deps for time-sensitive tests; document its use in `apps/backend/AGENTS.md`
- [ ] 10.5 Update `pyproject.toml` `[tool.pytest.ini_options]` — `testpaths = ["tests"]`, `pythonpath = ["."]`, `addopts = "-ra --strict-markers"`

## 11. Docs

- [ ] 11.1 Update `apps/backend/AGENTS.md` — replace the "Layout" section with the new tree; add "Layer Rules", "Naming Conventions", "Coding Rules", and "Testing" sections aligned with this proposal
- [ ] 11.2 Update `apps/backend/README.md` with: bootstrap order (`uv sync`, copy `.env.example`, `uv run fastapi dev main.py`), commands table, and a short architecture note pointing at `openspec/specs/`
- [ ] 11.3 Document the `# POC ONLY` banner convention in `AGENTS.md`

## 12. FHIR-ready domain layer

- [ ] 12.1 Add `fhir.resources` (R4 extras) to `apps/backend/pyproject.toml` runtime deps; `uv sync`
- [ ] 12.2 Create `app/fhir/__init__.py` (public re-exports only — no logic), `app/fhir/mappers/__init__.py`, `app/fhir/search.py`, `app/fhir/codes.py`
- [ ] 12.3 In `app/fhir/codes.py`, expose `IssueType` literal `Literal["not-found", "invalid", "security", "forbidden", "conflict", "processing", "transient", "informational"]` and a helper `code(issue_type, domain, reason) -> str` that emits `"<issue>.<domain>.<reason>"`
- [ ] 12.4 Update `app/core/errors.py` examples + docstrings to use the FHIR-aligned code shape; subclasses set `code = code("security", "auth", "invalid_credentials")` etc.
- [ ] 12.5 Update `app/adapters/hix/protocol.py`: replace `get_patient` placeholder with FHIR-verb methods — `async def read(self, resource_type: str, resource_id: str) -> fhir.resources.resource.Resource`, `async def search(self, resource_type: str, params: PatientSearch | ObservationSearch | ...) -> fhir.resources.bundle.Bundle`, `async def create(self, resource: fhir.resources.resource.Resource) -> fhir.resources.resource.Resource`. Stub returns synthetic resources from `app/adapters/hix/_fixtures.py`
- [ ] 12.6 `HixStubClient` fixtures populate `Meta.versionId = "1"` and `Meta.lastUpdated` from a fixed test clock
- [ ] 12.7 Keep `LusciiClient` Protocol vendor-shaped; add `app/adapters/luscii/mappers.py` with stub functions like `pathway_to_careplan(payload: dict) -> fhir.resources.careplan.CarePlan` (one example is enough — capability lands real ones)
- [ ] 12.8 Create `app/schemas/view/__init__.py` and `app/schemas/view/patient.py` with `PatientSummary(BaseModel)` — `id: str`, `name: str`, `birthdate: date | None`, `gender: Literal["male", "female", "other", "unknown"] | None`
- [ ] 12.9 Create `app/fhir/mappers/patient.py` with `to_summary(patient: Patient) -> PatientSummary` — pure function, no side effects
- [ ] 12.10 In `app/fhir/search.py`, define `PatientSearch(BaseModel)` with `name: str | None`, `birthdate: date | None`, `identifier: str | None`. Add one example for `ObservationSearch` so the pattern is visible
- [ ] 12.11 Define `Page[T](BaseModel)` (generic) in `app/schemas/view/pagination.py` with `entries: list[T]`, `total: int`, `next_cursor: str | None = None`. All list endpoints (when they land in later changes) use this shape
- [ ] 12.12 Add a reviewer-facing example route `GET /patients/{patient_id}` in `app/api/routers/patient_router.py` returning `PatientSummary` via `HixClient.read("Patient", patient_id)` → `mappers.patient.to_summary(...)`. Mounted with `tags=["patients"]`, `operation_id="get_patient_summary"`. (Demonstrates the pattern; later capabilities expand.)
- [ ] 12.13 Tests: `tests/fhir/test_mappers_patient.py` covers `to_summary` round-trip for synthetic fixtures (incl. missing optional fields); `tests/api/test_patient_router.py` covers happy path + 404 (`AppError(code="not-found.fhir.patient", status_code=404)`)
- [ ] 12.14 Update `tests/fixtures/fhir.py` (from §10.2) to build synthetic `fhir.resources` types — `make_patient(id="abc", name="Demo Patient", birthdate=date(1980,1,1)) -> Patient`. Document that all clinical fixtures use `fhir.resources` types, never plain dicts

## 13. Verification

- [ ] 13.1 `uv run ruff format --check` — clean
- [ ] 13.2 `uv run ruff check` — clean
- [ ] 13.3 `uv run pyright` — clean
- [ ] 13.4 `uv run pytest -q` — green
- [ ] 13.5 `uv run python -m app.openapi` — writes `openapi.json`; diff is reviewable
- [ ] 13.6 Manual: `uv run fastapi dev main.py`, then `curl -i http://localhost:8000/health`, `curl -i -c cookies.txt -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' -d '{"username":"clinician","password":"demo"}'`, `curl -i -b cookies.txt http://localhost:8000/auth/me`, `curl -i -b cookies.txt http://localhost:8000/patients/abc-123` — all green; cookie present; patient route returns `PatientSummary` shape
- [ ] 13.7 Cross-app: from a running orchestrator dev server with `VITE_API_MODE=live`, the auth flow hits the backend end-to-end
- [ ] 13.8 `openspec change validate backend-setup --strict` — passes
