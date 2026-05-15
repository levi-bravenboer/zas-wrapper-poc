## ADDED Requirements

### Requirement: Operational scripts live under `scripts/`

The backend SHALL host every seed and operational entry point as a standalone Python module under `apps/backend/scripts/`. Each module MUST be invocable as `python -m scripts.<name>` (and equivalently `python scripts/<name>.py`) inside the `zas_backend` container, and MUST expose an importable async helper so tests and downstream scripts can drive the same logic without spawning a subprocess. Alembic revisions SHALL NOT insert rows — every data-seed operation MUST be implemented as a script instead.

#### Scenario: Script invocable as a module

- **WHEN** a developer runs `python -m scripts.seed_tenant` inside the `zas_backend` container against a reachable database
- **THEN** the command exits 0 and the script's logging output (configured via `app.core.logging.configure_logging`) appears in the container logs

#### Scenario: Alembic revisions are schema-only

- **WHEN** a reviewer inspects every file under `apps/backend/alembic/versions/` after this change
- **THEN** no `op.bulk_insert`, `op.execute("INSERT ...")`, or equivalent data-insert call MUST appear; revisions contain DDL only

### Requirement: `scripts.seed_tenant` seeds the ZAS tenant

The scripts package SHALL provide a `scripts/seed_tenant.py` module that inserts the `zas` tenant (per the `tenant-base` capability) if missing and no-ops if present. Implementation MUST go through `TenantRepository` — no raw SQL. The module MUST export the canonical UUID literal as `ZAS_TENANT_ID` so other scripts and tests reference one source of truth.

#### Scenario: Successful seed

- **WHEN** `python -m scripts.seed_tenant` runs against an empty database
- **THEN** the command exits 0, logs `INFO seeded tenant slug=zas`, and the row is present

#### Scenario: Idempotent re-run

- **WHEN** `python -m scripts.seed_tenant` runs against a database that already has the `zas` row
- **THEN** the command exits 0, logs `INFO tenant slug=zas already present`, and no second row is created

### Requirement: `scripts.seed_all` umbrella script exists

The scripts package SHALL provide a `scripts/seed_all.py` module that runs every registered seed step in dependency order. In this change `seed_all` resolves to `seed_zas_tenant` only; future changes append additional seeds (e.g. user bootstrap) to the umbrella in their own dependency order.

#### Scenario: Umbrella runs every seed

- **WHEN** `python -m scripts.seed_all` runs after this change
- **THEN** the command exits 0 and `tenants` contains the `zas` row

### Requirement: Moon tasks wrap the scripts

The `apps/backend/moon.yml` SHALL register at minimum a `seed-tenant` task and a `seed` task that run the corresponding script modules inside the `zas_backend` container.

#### Scenario: Moon tasks present

- **WHEN** a developer runs `moon run backend:seed-tenant`
- **THEN** the task MUST execute `python -m scripts.seed_tenant` inside `zas_backend` and surface its exit code

- **WHEN** a developer runs `moon run backend:seed`
- **THEN** the task MUST execute `python -m scripts.seed_all` inside `zas_backend` and surface its exit code
