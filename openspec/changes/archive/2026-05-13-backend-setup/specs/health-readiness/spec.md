## ADDED Requirements

### Requirement: Liveness endpoint

`GET /health` SHALL return 200 unconditionally with `HealthResponse { status: "ok", version: str, started_at: datetime }`. The operation ID MUST be `get_health`.

#### Scenario: Always 200 while the process runs

- **WHEN** any client GETs `/health`
- **THEN** the response is 200 with `status == "ok"`, the deployed version, and the process start timestamp

### Requirement: Readiness endpoint

`GET /ready` SHALL aggregate registered readiness checks and return:

- 200 with `ReadinessResponse { status: "ready", checks: { <name>: "ok", ... } }` when every check passes.
- 503 with `ReadinessResponse { status: "not_ready", checks: { ... } }` when any check fails.

The operation ID MUST be `get_readiness`.

#### Scenario: All adapters healthy

- **WHEN** both `hix` and `luscii` stub adapters' `ping()` succeed
- **THEN** `/ready` returns 200 and `checks == { "hix": "ok", "luscii": "ok" }`

#### Scenario: One adapter unhealthy

- **WHEN** the `luscii` adapter's `ping()` raises
- **THEN** `/ready` returns 503 and `checks == { "hix": "ok", "luscii": "fail" }` with `status == "not_ready"`

### Requirement: Readiness registry

`app/core/readiness.py` SHALL expose a `ReadinessRegistry` allowing modules to register named `async ping_fn` callables. The system router SHALL iterate the registry in deterministic order to build the response.

#### Scenario: Adapter registration

- **WHEN** `app/api/__init__.py` runs at startup
- **THEN** `ReadinessRegistry` contains entries `hix` and `luscii` whose `ping_fn`s resolve the current adapter clients via the FastAPI dependency container
