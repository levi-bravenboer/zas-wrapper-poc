"""Converge Keto to the tuple set derived from Postgres.

The cutover migration, the demo-seeding step, and the on-demand drift
fixer are all this one command. Safe to run any time; relations without a
domain source yet (`external_carer` demo seeds) are left untouched.

Run: `python -m scripts.reconcile_authz_tuples`.
"""

from __future__ import annotations

import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.services.access.permissions.keto_client import KetoClient
from app.services.access.sync.reconciler import reconcile_all
from scripts._db import run_script

logger = logging.getLogger(__name__)


async def _run(session: AsyncSession) -> None:
    async with httpx.AsyncClient(timeout=10.0) as http:
        stats = await reconcile_all(session, KetoClient(get_settings(), http), log_drift=False)
    logger.info(
        "authz tuples reconciled: %d inserted, %d orphaned deleted",
        stats.inserted,
        stats.deleted,
    )


def main() -> None:
    run_script(_run)


if __name__ == "__main__":
    main()
