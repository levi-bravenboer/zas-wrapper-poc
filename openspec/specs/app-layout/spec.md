# app-layout Specification

## Purpose
TBD - created by archiving change backend-setup. Update Purpose after archive.
## Requirements
### Requirement: `app/` package with factory function

`apps/backend/` SHALL expose its FastAPI application from an `app/` package via a `create_app() -> FastAPI` factory. `apps/backend/main.py` MUST be a thin entrypoint that imports `app` from `app.main`.

#### Scenario: Dev server boots via the factory

- **WHEN** a developer runs `uv run fastapi dev main.py` from `apps/backend/`
- **THEN** the server starts, `app.main.create_app()` is invoked once, and `/healthz` returns 200

#### Scenario: Test app built with overrides

- **WHEN** a test calls `create_app(settings_override=…)`
- **THEN** the returned `FastAPI` instance has the overridden settings and adapter dependencies registered for that test only

### Requirement: Canonical package tree

`app/` SHALL follow this layout. Other folders MUST NOT appear without an OpenSpec amendment.

```
app/
  __init__.py
  main.py              # create_app() + app = create_app()
  api/
    __init__.py        # mounts all routers
    routers/
      <domain>_router.py
  core/
    __init__.py
    settings.py
    logging.py
    errors.py
    security.py
    readiness.py
  schemas/
    <domain>.py        # Pydantic models
  services/
    <domain>_service.py
  adapters/
    <vendor>/
      __init__.py
      protocol.py
      stub.py
```

#### Scenario: New router placement

- **WHEN** a contributor adds a router for a new domain `foo`
- **THEN** the file lives at `app/api/routers/foo_router.py`, is mounted in `app/api/__init__.py`, and uses Pydantic models from `app/schemas/foo.py`

### Requirement: Routers carry only HTTP concerns

Routers under `app/api/routers/` SHALL parse the request, delegate to a service in `app/services/`, and format the response. Routers MUST NOT contain business logic, direct external I/O, or settings reads outside `Depends`.

#### Scenario: Business logic in a service

- **WHEN** an auth login route validates credentials
- **THEN** the route calls `auth_service.authenticate(...)` rather than performing the lookup inline

### Requirement: Layer import rules

Modules SHALL respect a one-way import dependency:

- `app.api.*` → may import from `app.schemas`, `app.services`, `app.core`, and `app.adapters` (only via `Depends`).
- `app.services.*` → may import from `app.schemas`, `app.core`, `app.adapters`. MUST NOT import from `fastapi`.
- `app.adapters.*` → may import `app.schemas`, `app.core`, external SDKs. MUST NOT import from `app.api` or `app.services`.
- `app.core.*` → stdlib + third-party only. MUST NOT import from `app.api`, `app.services`, `app.adapters`.
- `app.schemas.*` → `pydantic` + stdlib only.

#### Scenario: Service stays framework-agnostic

- **WHEN** a developer adds `from fastapi import Depends` to a file under `app/services/`
- **THEN** code review rejects the change and the import is moved to the calling router

