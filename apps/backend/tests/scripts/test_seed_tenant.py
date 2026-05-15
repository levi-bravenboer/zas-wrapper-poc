from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import Tenant
from scripts.seed_tenant import ZAS_TENANT_ID, ZAS_TENANT_SLUG, seed_zas_tenant
from tests.scripts._util import run_script_subprocess


async def test_seed_zas_tenant_inserts_row(db_session: AsyncSession) -> None:
    tenant = await seed_zas_tenant(db_session)
    await db_session.commit()

    assert tenant.id == ZAS_TENANT_ID
    assert tenant.slug == ZAS_TENANT_SLUG
    assert tenant.name == "ZAS Antwerpen"

    row = (
        await db_session.execute(select(Tenant).where(Tenant.slug == ZAS_TENANT_SLUG))
    ).scalar_one_or_none()
    assert row is not None
    assert row.id == ZAS_TENANT_ID


async def test_seed_zas_tenant_is_idempotent(db_session: AsyncSession) -> None:
    await seed_zas_tenant(db_session)
    await db_session.commit()
    await seed_zas_tenant(db_session)
    await db_session.commit()

    count = (
        await db_session.execute(
            select(func.count()).select_from(Tenant).where(Tenant.slug == ZAS_TENANT_SLUG)
        )
    ).scalar_one()
    assert count == 1


def test_seed_tenant_script_main_exits_clean() -> None:
    result = run_script_subprocess("scripts.seed_tenant")
    assert result.returncode == 0, result.stderr
