from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from scripts.seed_organisations import seed_organisations


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None: ...


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def seeded_zas_orgs(db_session: AsyncSession, seeded_zas_users: list[User]) -> list[User]:
    """Seed orgs + return the bootstrap users (admin + caregiver)."""

    await seed_organisations(db_session)
    await db_session.commit()
    return seeded_zas_users
