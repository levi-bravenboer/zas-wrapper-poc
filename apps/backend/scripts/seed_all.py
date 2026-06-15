"""Run every registered seed step in dependency order.

Steps execute under a single `script_session()` so a failure in any step
short-circuits the rest and rolls back the shared transaction. Append new
seed helpers to `SEED_STEPS` in the order they depend on each other —
`seed_zas_tenant` first, downstream seeds (users, ...) after.

Run: `python -m scripts.seed_all` (or `python scripts/seed_all.py`).
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.services.access.identity.kratos_client import KratosClient
from app.services.luscii.catalogue_snapshot import import_catalogue_snapshots_if_empty
from scripts._db import run_script
from scripts.import_identities_kratos import import_identities
from scripts.seed_care_teams import seed_care_teams
from scripts.seed_organisations import seed_organisations
from scripts.seed_access_entitlements import seed_access_entitlements
from scripts.seed_pathway import seed_lane_kinds, seed_rugrevalidatie
from scripts.seed_luscii_demo import seed_luscii_demo
from scripts.seed_patient_users import seed_patient_users
from scripts.seed_patients import seed_patients
from scripts.seed_practitioners import seed_practitioners
from scripts.seed_tenant import seed_zas_tenant
from scripts.seed_users import seed_users

SeedStep = Callable[[AsyncSession], Awaitable[object]]

# Order matters: tenant → users (admin self-FK breaks audit-FK cycle;
# organisation_id is NULL at this point) → organisations (audit hook stamps
# created_by=admin; back-fills users.organisation_id at the end) → patients
# (attaches to Rugrevalidatie team org seeded above; caregiver actor) →
# care_teams (one active team + caregiver primary participant per patient,
# satisfies the visibility predicate so the demo caregiver can see patients).
# Pathway lane-kind catalogue + Rugrevalidatie demo pathway seed last so the
# pathway rows reference the seeded admin actor.
SEED_STEPS: list[SeedStep] = [
    seed_zas_tenant,
    seed_users,
    seed_organisations,
    seed_practitioners,
    seed_patients,
    seed_patient_users,
    seed_care_teams,
    seed_lane_kinds,
    seed_rugrevalidatie,
    # access-entitlements demo data (campuses, specialisms, carepath links,
    # external GP, multi-role human) — after pathways, before Kratos import
    seed_access_entitlements,
    # Luscii fixture-mode demo links + localisations — wires the first N
    # seeded patients to the canned UUIDs served by `LusciiFixtureClient`
    # when `BACKEND_LUSCII_FIXTURES=true` and no real token is configured.
    # Harmless in production-with-token: the link rows just point at UUIDs
    # the real Luscii API doesn't recognise.
    seed_luscii_demo,
]

logger = logging.getLogger(__name__)


async def _import_kratos_identities(session: AsyncSession) -> None:
    """Final step: link every seeded user to a Kratos identity.

    Skips with a warning when Kratos is unreachable (e.g. seeding while the
    ory compose slice is down) — logins won't work until
    `scripts.import_identities_kratos` runs against a live Kratos.
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            await import_identities(session, KratosClient(get_settings(), http))
    except httpx.TransportError:
        logger.warning(
            "kratos unreachable — identity import skipped; "
            "run `python -m scripts.import_identities_kratos` once kratos is up"
        )


async def _seed(session: AsyncSession) -> None:
    for step in SEED_STEPS:
        await step(session)
    # Luscii label catalogue from the committed snapshots — vendor reference
    # data, independent of the tenant steps above. Imports only into empty
    # tables (boot re-runs stay cheap, a fresher manual sync is never
    # clobbered); skips with a warning when snapshots are absent.
    await import_catalogue_snapshots_if_empty(session)
    await _import_kratos_identities(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
