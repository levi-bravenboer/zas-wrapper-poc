"""Minimal demo seed for the AWS throwaway environment.

Seeds only what a single-operator demo needs: the `zas` tenant, the `admin`
role (all permissions) + a single admin user (the deployer), the pathway
lane-kind catalogue, and the bladder-cancer pathway — then propagates to
Kratos (login) and Keto (authz). NO demo patients / practitioners / care
teams. Reuses the existing idempotent seed modules; selection is driven by
`SEED_PROFILE=demo` (which makes `seed_users` skip the caregiver + cast).

Run: `python -m scripts.seed_demo` (entrypoint runs this when SEED_PROFILE=demo).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from scripts._db import run_script
from scripts.seed_all import import_kratos_identities, reconcile_authz_tuples
from scripts.seed_bladder_cancer import seed_bladder_cancer
from scripts.seed_bladder_cancer_v2 import seed_bladder_cancer_v2
from scripts.seed_pathway import seed_lane_kinds
from scripts.seed_tenant import seed_zas_tenant
from scripts.seed_users import seed_users

SeedStep = Callable[[AsyncSession], Awaitable[object]]

# tenant → admin user (SEED_PROFILE=demo ⇒ admin only) → lane-kind catalogue
# → bladder pathway (authored by the admin actor; references lane kinds).
SEED_STEPS: list[SeedStep] = [
    seed_zas_tenant,
    seed_users,
    seed_lane_kinds,
    seed_bladder_cancer,
    seed_bladder_cancer_v2,
]


async def _seed(session: AsyncSession) -> None:
    for step in SEED_STEPS:
        await step(session)
    await import_kratos_identities(session)
    await reconcile_authz_tuples(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
