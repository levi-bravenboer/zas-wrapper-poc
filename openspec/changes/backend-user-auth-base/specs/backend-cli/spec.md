## ADDED Requirements

### Requirement: `seed-users` subcommand seeds bootstrap users

The CLI SHALL register a `seed-users` subcommand that inserts the bootstrap admin (`admin@zas.local`, role `admin`, display name `"ZAS Admin"`) and the demo caregiver (`caregiver@zas.local`, role `caregiver`, display name `"Demo Caregiver"`) under the seeded `zas` tenant if missing, and no-ops on already-present rows. Implementation MUST go through `UserRepository.get_by_email(zas_tenant_id, email)` for the lookup and `UserRepository` for the insert — no raw SQL.

Each row's `password_hash` MUST be derived via argon2 from the corresponding env var — `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` for the admin row and `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD` for the caregiver row — falling back to the literal `"changeme"` when unset. A `WARNING` log line MUST record each fallback. The `app/cli/seed.py` module MUST carry a `# POC ONLY — bootstrap seed; replace before non-PoC deployment` banner explaining the fallback.

If the `zas` tenant row is missing when `seed-users` runs, the command MUST exit non-zero and log `ERROR cannot seed users: zas tenant missing — run seed-tenant first`. The subcommand MUST NOT update existing rows — passwords are not re-hashed and roles are not corrected on second run.

#### Scenario: Successful seed

- **WHEN** `python -m app.cli seed-users` runs against a database that has the `zas` tenant but no users
- **THEN** the command exits 0, logs `INFO seeded user email=admin@zas.local role=admin` and `INFO seeded user email=caregiver@zas.local role=caregiver`, and the `users` table contains exactly the two rows under the `zas` tenant

#### Scenario: Idempotent re-run

- **WHEN** `python -m app.cli seed-users` runs against a database that already contains both seeded rows
- **THEN** the command exits 0, logs `INFO user email=admin@zas.local already present` and `INFO user email=caregiver@zas.local already present`, and no second row is created and no `password_hash` is updated

#### Scenario: Missing tenant precondition

- **WHEN** `python -m app.cli seed-users` runs against a database where the `zas` tenant row is missing
- **THEN** the command exits non-zero and logs `ERROR cannot seed users: zas tenant missing — run seed-tenant first`

#### Scenario: Env var password honoured

- **WHEN** `BACKEND_BOOTSTRAP_ADMIN_PASSWORD = "s3cret"` is exported and `seed-users` runs against a fresh DB with the `zas` tenant present
- **THEN** `PasswordHasher().verify(<admin password_hash>, "s3cret")` MUST return `True`

#### Scenario: Fallback password emits warning

- **WHEN** `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` is unset and `seed-users` runs against a fresh DB with the `zas` tenant present
- **THEN** `PasswordHasher().verify(<admin password_hash>, "changeme")` MUST return `True` and a `WARNING` line MUST be logged recording the fallback for `BACKEND_BOOTSTRAP_ADMIN_PASSWORD`

### Requirement: Moon task wraps `seed-users`

The `apps/backend/moon.yml` SHALL register a `seed-users` task that runs `python -m app.cli seed-users` inside the `zas_backend` container and surfaces its exit code.

#### Scenario: Moon task present

- **WHEN** a developer runs `moon run backend:seed-users`
- **THEN** the task MUST execute `python -m app.cli seed-users` inside `zas_backend` and surface its exit code

## MODIFIED Requirements

### Requirement: `seed-all` umbrella subcommand exists

The CLI SHALL register a `seed-all` subcommand that runs every registered seed step in dependency order. After this change, `seed-all` resolves to `seed-tenant` then `seed-users`; if `seed-tenant` raises or exits non-zero, `seed-users` MUST NOT run.

#### Scenario: Umbrella runs every seed in order

- **WHEN** `python -m app.cli seed-all` runs against an empty database
- **THEN** the command exits 0, `seed-tenant` runs first and produces the `zas` tenant row, then `seed-users` runs and produces the bootstrap admin + demo caregiver rows under that tenant

#### Scenario: Umbrella aborts on tenant failure

- **WHEN** `python -m app.cli seed-all` runs and `seed-tenant` fails (for example, the database is unreachable)
- **THEN** the command exits non-zero and `seed-users` MUST NOT run — no user rows are inserted
