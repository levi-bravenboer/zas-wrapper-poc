## ADDED Requirements

### Requirement: Typer-based CLI module exists at `app/cli/`

The backend SHALL expose a Typer `app` at `app/cli/__init__.py` (and `app/cli/__main__.py` so `python -m app.cli` resolves to it) that aggregates all seed and operational subcommands. Alembic revisions SHALL NOT insert rows — every data-seed operation MUST be implemented as a CLI subcommand instead.

#### Scenario: CLI invocable

- **WHEN** a developer runs `python -m app.cli --help` inside the `zas_backend` container
- **THEN** the command exits 0 and prints the list of registered subcommands

#### Scenario: Alembic revisions are schema-only

- **WHEN** a reviewer inspects every file under `apps/backend/alembic/versions/` after this change
- **THEN** no `op.bulk_insert`, `op.execute("INSERT ...")`, or equivalent data-insert call MUST appear; revisions contain DDL only

### Requirement: `seed-tenant` subcommand seeds the ZAS tenant

The CLI SHALL register a `seed-tenant` subcommand that inserts the `zas` tenant (per the `tenant-base` capability) if missing and no-ops if present. Implementation MUST go through `TenantRepository` — no raw SQL.

#### Scenario: Successful seed

- **WHEN** `python -m app.cli seed-tenant` runs against an empty database
- **THEN** the command exits 0, logs `INFO seeded tenant slug=zas`, and the row is present

#### Scenario: Idempotent re-run

- **WHEN** `python -m app.cli seed-tenant` runs against a database that already has the `zas` row
- **THEN** the command exits 0, logs `INFO tenant slug=zas already present`, and no second row is created

### Requirement: `seed-all` umbrella subcommand exists

The CLI SHALL register a `seed-all` subcommand that runs every registered seed step in dependency order. In this change `seed-all` resolves to `seed-tenant` only; future changes append additional seeds (e.g. `seed-users`) to the umbrella in their own dependency order.

#### Scenario: Umbrella runs every seed

- **WHEN** `python -m app.cli seed-all` runs after this change
- **THEN** the command exits 0 and `tenants` contains the `zas` row

### Requirement: Moon tasks wrap the CLI

The `apps/backend/moon.yml` SHALL register at minimum a `seed-tenant` task and a `seed` task that run the corresponding CLI subcommands inside the `zas_backend` container.

#### Scenario: Moon tasks present

- **WHEN** a developer runs `moon run backend:seed-tenant`
- **THEN** the task MUST execute `python -m app.cli seed-tenant` inside `zas_backend` and surface its exit code
