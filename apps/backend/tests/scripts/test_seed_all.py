from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import Tenant
from scripts.seed_tenant import ZAS_TENANT_ID, ZAS_TENANT_SLUG
from tests.scripts._util import run_script_subprocess


async def test_seed_all_seeds_tenant(db_session: AsyncSession) -> None:
    result = run_script_subprocess("scripts.seed_all")
    assert result.returncode == 0, result.stderr

    row = (
        await db_session.execute(select(Tenant).where(Tenant.slug == ZAS_TENANT_SLUG))
    ).scalar_one_or_none()
    assert row is not None
    assert row.id == ZAS_TENANT_ID
