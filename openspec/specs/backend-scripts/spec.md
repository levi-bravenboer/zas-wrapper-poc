# backend-scripts Specification

## Purpose
TBD - created by archiving change backend-tenant-base. Update Purpose after archive.
## Requirements
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

The scripts package SHALL provide a `scripts/seed_all.py` module that runs every registered seed step in dependency order. After this change, `seed_all` resolves to `seed_zas_tenant` then `seed_users`; if `seed_zas_tenant` raises or exits non-zero, `seed_users` MUST NOT run.

#### Scenario: Umbrella runs every seed in order

- **WHEN** `python -m scripts.seed_all` runs against an empty database
- **THEN** the command exits 0, `seed_zas_tenant` runs first and produces the `zas` tenant row, then `seed_users` runs and produces the bootstrap admin + demo caregiver rows under that tenant

#### Scenario: Umbrella aborts on tenant failure

- **WHEN** `python -m scripts.seed_all` runs and `seed_zas_tenant` fails (for example, the database is unreachable)
- **THEN** the command exits non-zero and `seed_users` MUST NOT run — no user rows are inserted

### Requirement: Moon tasks wrap the scripts

The `apps/backend/moon.yml` SHALL register at minimum a `seed-tenant` task and a `seed` task that run the corresponding script modules inside the `zas_backend` container.

#### Scenario: Moon tasks present

- **WHEN** a developer runs `moon run backend:seed-tenant`
- **THEN** the task MUST execute `python -m scripts.seed_tenant` inside `zas_backend` and surface its exit code

- **WHEN** a developer runs `moon run backend:seed`
- **THEN** the task MUST execute `python -m scripts.seed_all` inside `zas_backend` and surface its exit code

### Requirement: `scripts.seed_users` seeds bootstrap users

The scripts package SHALL provide a `scripts/seed_users.py` module that inserts the bootstrap admin (`admin@zas.local`, role `admin`, display name `"ZAS Admin"`) and the demo caregiver (`caregiver@zas.local`, role `caregiver`, display name `"Demo Caregiver"`) under the seeded `zas` tenant if missing, and no-ops on already-present rows. Implementation MUST go through `UserRepository.get_by_email(zas_tenant_id, email)` for the lookup and `UserRepository` for the insert — no raw SQL.

Each row's `password_hash` MUST be derived via argon2 from the corresponding env var — `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` for the admin row and `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` for the caregiver row — falling back to the literal `"changeme"` when unset. A `WARNING` log line MUST record each fallback. `scripts/seed_users.py` MUST carry a `# POC ONLY — bootstrap seed; replace before non-PoC deployment` banner explaining the fallback.

If the `zas` tenant row is missing when `scripts.seed_users` runs, the script MUST exit non-zero and log `ERROR cannot seed users: zas tenant missing — run seed_tenant first`. The script MUST NOT update existing rows — passwords are not re-hashed and roles are not corrected on second run.

#### Scenario: Successful seed

- **WHEN** `python -m scripts.seed_users` runs against a database that has the `zas` tenant but no users
- **THEN** the command exits 0, logs `INFO seeded user email=admin@zas.local role=admin` and `INFO seeded user email=caregiver@zas.local role=caregiver`, and the `users` table contains exactly the two rows under the `zas` tenant

#### Scenario: Idempotent re-run

- **WHEN** `python -m scripts.seed_users` runs against a database that already contains both seeded rows
- **THEN** the command exits 0, logs `INFO user email=admin@zas.local already present` and `INFO user email=caregiver@zas.local already present`, and no second row is created and no `password_hash` is updated

#### Scenario: Missing tenant precondition

- **WHEN** `python -m scripts.seed_users` runs against a database where the `zas` tenant row is missing
- **THEN** the command exits non-zero and logs `ERROR cannot seed users: zas tenant missing — run seed_tenant first`

#### Scenario: Env var password honoured

- **WHEN** `BACKEND_BOOTSTRAP_ADMIN_PASSWORD = "s3cret"` is exported and `scripts.seed_users` runs against a fresh DB with the `zas` tenant present
- **THEN** `PasswordHasher().verify(<admin password_hash>, "s3cret")` MUST return `True`

#### Scenario: Fallback password emits warning

- **WHEN** `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` is unset and `scripts.seed_users` runs against a fresh DB with the `zas` tenant present
- **THEN** `PasswordHasher().verify(<admin password_hash>, "changeme")` MUST return `True` and a `WARNING` line MUST be logged recording the fallback for `BACKEND_BOOTSTRAP_ADMIN_PASSWORD`

### Requirement: Moon task wraps `scripts.seed_users`

The `apps/backend/moon.yml` SHALL register a `seed-users` task that runs `python -m scripts.seed_users` inside the `zas_backend` container and surfaces its exit code.

#### Scenario: Moon task present

- **WHEN** a developer runs `moon run backend:seed-users`
- **THEN** the task MUST execute `python -m scripts.seed_users` inside `zas_backend` and surface its exit code

