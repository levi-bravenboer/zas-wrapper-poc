from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import Tenant
from app.repositories.tenant import TenantRepository


async def test_get_by_slug_returns_seeded_row(db_session: AsyncSession) -> None:
    repo = TenantRepository(db_session)
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS Antwerpen")
    await repo.add(tenant)
    await db_session.commit()

    result = await repo.get_by_slug("zas")

    assert result is not None
    assert result.slug == "zas"
    assert result.name == "ZAS Antwerpen"


async def test_get_by_slug_missing_returns_none(db_session: AsyncSession) -> None:
    repo = TenantRepository(db_session)

    result = await repo.get_by_slug("missing")

    assert result is None


@pytest.mark.parametrize(
    "bad_slug",
    [
        "Uppercase",
        "1starts-with-digit",
        "has space",
        "has_underscore",
        "",
    ],
)
async def test_invalid_slug_violates_check_constraint(
    db_session: AsyncSession, bad_slug: str
) -> None:
    repo = TenantRepository(db_session)
    tenant = Tenant(id=uuid.uuid4(), slug=bad_slug, name="bad")
    with pytest.raises(IntegrityError):
        await repo.add(tenant)
        await db_session.commit()
    await db_session.rollback()
