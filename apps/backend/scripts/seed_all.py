"""Run every registered seed step in dependency order.

Steps execute under a single `script_session()` so a failure in any step
short-circuits the rest and rolls back the shared transaction. Append new
seed helpers to `SEED_STEPS` in the order they depend on each other —
`seed_zas_tenant` first, downstream seeds (users, ...) after.

Run: `python -m scripts.seed_all` (or `python scripts/seed_all.py`).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from scripts._db import run_script
from scripts.seed_organisations import seed_organisations
from scripts.seed_patients import seed_patients
from scripts.seed_tenant import seed_zas_tenant
from scripts.seed_users import seed_users

SeedStep = Callable[[AsyncSession], Awaitable[object]]

# Order matters: tenant → users (admin self-FK breaks audit-FK cycle;
# organisation_id is NULL at this point) → organisations (audit hook stamps
# created_by=admin; back-fills users.organisation_id at the end) → patients
# (attaches to Rugrevalidatie team org seeded above; caregiver actor).
SEED_STEPS: list[SeedStep] = [
    seed_zas_tenant,
    seed_users,
    seed_organisations,
    seed_patients,
]


async def _seed(session: AsyncSession) -> None:
    for step in SEED_STEPS:
        await step(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
