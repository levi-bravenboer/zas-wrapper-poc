## ADDED Requirements

### Requirement: Single typed Settings object

All env-driven configuration SHALL flow through a single `Settings(BaseSettings)` class in `app/core/settings.py`, loaded via `pydantic-settings` from `.env` plus the process environment. Route, service, and adapter code MUST NOT call `os.environ` directly.

#### Scenario: Env var picked up

- **WHEN** `BACKEND_SESSION_SECRET_KEY=topsecret` is exported and the app starts
- **THEN** `Settings.session_secret_key.get_secret_value() == "topsecret"`

#### Scenario: Unknown env var rejected

- **WHEN** `BACKEND_NONSENSE=foo` is set
- **THEN** startup fails because `Settings.model_config` has `extra="forbid"`

### Requirement: Settings dependency

A `SettingsDep = Annotated[Settings, Depends(get_settings)]` SHALL be the only way for routers and services to access settings. `get_settings()` MUST be `@lru_cache`-memoised so it returns the same instance for the process lifetime.

#### Scenario: Cached across requests

- **WHEN** two consecutive requests resolve `SettingsDep`
- **THEN** they receive the same `Settings` instance

### Requirement: Production guardrails on boot

`create_app()` SHALL inspect `Settings` at startup and refuse to start when `env == "production"` and any of the following hold: `session_secret_key` equals the dev default, `cors_origins` is empty, `public_url` is `None`.

#### Scenario: Refuses unsafe production boot

- **WHEN** the process starts with `BACKEND_ENV=production` and no `BACKEND_SESSION_SECRET_KEY` override
- **THEN** the app raises a startup error naming the missing setting and exits non-zero

### Requirement: `.env.example` committed

`apps/backend/.env.example` SHALL exist, list every env var the `Settings` class recognises, and document a safe default for each. The file MUST stay in sync with `Settings`; reviewers reject PRs that add a setting without updating it.

#### Scenario: Fresh clone has guidance

- **WHEN** a contributor copies `.env.example` to `.env` and runs the dev server
- **THEN** the server boots without further env configuration
