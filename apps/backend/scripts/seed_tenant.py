# POC ONLY — bootstrap seed; replace before non-PoC deployment.
#
# Bootstrap seed values live here so tests and follow-up seed scripts can
# import a single source of truth. The `zas` tenant UUID is stable across
# environments — downstream seeds (users, etc.) FK to it.

"""Idempotent seed of the `zas` tenant row.

Run: `python -m scripts.seed_tenant` (or `python scripts/seed_tenant.py`).
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import Tenant
from app.repositories.tenant import TenantRepository
from scripts._db import run_script

logger = logging.getLogger(__name__)

ZAS_TENANT_ID: UUID = UUID("00000000-0000-4000-8000-00000000a5a5")
ZAS_TENANT_NAME = "ZAS Antwerpen"
ZAS_TENANT_SLUG = "zas"


async def seed_zas_tenant(session: AsyncSession) -> Tenant:
    """Insert the `zas` tenant if missing. Return the row either way."""

    repo = TenantRepository(session)
    existing = await repo.get_by_slug(ZAS_TENANT_SLUG)
    if existing is not None:
        logger.info("tenant slug=%s already present", ZAS_TENANT_SLUG)
        return existing
    tenant = Tenant(id=ZAS_TENANT_ID, slug=ZAS_TENANT_SLUG, name=ZAS_TENANT_NAME)
    await repo.add(tenant)
    logger.info("seeded tenant slug=%s", ZAS_TENANT_SLUG)
    return tenant


async def _seed(session: AsyncSession) -> None:
    await seed_zas_tenant(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
