## ADDED Requirements

### Requirement: Test tree mirrors source

`apps/backend/tests/` SHALL mirror the `app/` package layout:

```
tests/
  conftest.py
  api/            # one file per app/api/routers/<x>_router.py
  core/           # one file per app/core/<x>.py
  services/       # one file per app/services/<x>_service.py
  adapters/       # one file per adapter package
  fixtures/       # synthetic FHIR + domain fixtures
  utils/          # cookie helpers, factories
```

Tests SHALL NOT live outside this tree.

#### Scenario: New router has a matching test file

- **WHEN** a contributor adds `app/api/routers/foo_router.py`
- **THEN** the same PR adds `tests/api/test_foo_router.py`

### Requirement: `client` + `authed_client` fixtures

`tests/conftest.py` SHALL expose two fixtures:

- `client(app) -> TestClient`: returns a `TestClient` bound to the app built with test settings, no session cookie set.
- `authed_client(client) -> TestClient`: performs `POST /auth/login` with demo credentials once per test and returns the same `TestClient` with the session cookie attached.

Bare `TestClient(app)` calls in test bodies are forbidden.

#### Scenario: Authed call

- **WHEN** a test asserts behaviour of an authed-only future route via `authed_client.get("/...")`
- **THEN** the session cookie is included automatically and the route receives the demo user

### Requirement: Dependency overrides for adapters

`tests/conftest.py` SHALL document and demonstrate the pattern for overriding adapter dependencies via `app.dependency_overrides[get_hix_client] = lambda: <stub_instance>`. Tests requiring a failing adapter (e.g. readiness 503 case) MUST use this pattern rather than monkeypatching adapter internals.

#### Scenario: Readiness 503 test

- **WHEN** `tests/api/test_system_router.py` overrides `get_hix_client` with a stub whose `ping()` raises
- **THEN** the test exercises the readiness 503 path without touching the real stub implementation

### Requirement: Synthetic fixtures only

`tests/fixtures/` SHALL contain only synthetic data. Real patient names, real MRNs, real BSN numbers, and any payload copied from a live sandbox or production system are forbidden — reviewer-enforced.

#### Scenario: Reviewer rejects real data

- **WHEN** a PR adds `tests/fixtures/patient_jan_jansens.json` containing a real-looking BSN
- **THEN** the change is rejected, the file is regenerated with synthetic data, and the diff is rewritten

### Requirement: Asserts on response, not on mocks

Tests SHALL assert on response status, response body, side effects on the database (none yet), and cookie state. `assert mock.called` and `mock.assert_called_with(...)` against adapter stubs are forbidden — they reveal nothing about user-visible behaviour.

#### Scenario: Login test asserts response shape

- **WHEN** `tests/api/test_auth_router.py` covers the success case
- **THEN** the test asserts status 200, the response body matches `SessionUser`, and the `Set-Cookie` header is present — not that the auth service's `authenticate` mock was invoked

### Requirement: Time control via `freezegun`

Time-sensitive tests (cookie expiry, `started_at` snapshots) SHALL use `freezegun.freeze_time` rather than calling `time.sleep(...)` or computing relative timestamps with offsets.

#### Scenario: Expired cookie test

- **WHEN** `tests/api/test_auth_router.py` covers the 9-hour-old cookie case
- **THEN** it uses `freeze_time` to mint the cookie at `T-9h` and assert the 401 path at `T`
