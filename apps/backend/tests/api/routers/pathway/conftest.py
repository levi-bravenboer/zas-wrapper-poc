from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pathway import Pathway, PathwayLaneKind
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.services.pathway.catalogue import SEEDED_LANE_KINDS


@pytest.fixture(autouse=True)
async def _autoclean_pathway_tables(db_session: AsyncSession) -> AsyncIterator[None]:
    """Wipe pathway domain + users/tenants around every test.

    Same FK-safe order as the service test conftest: pathway rows (with
    RESTRICT FK to tenants) must clear before tenants.
    """

    await _wipe(db_session)
    yield
    await _wipe(db_session)


async def _wipe(session: AsyncSession) -> None:
    await session.execute(delete(Pathway))
    await session.execute(delete(PathwayLaneKind))
    await session.execute(delete(User))
    await session.execute(delete(Tenant))
    await session.commit()


@pytest.fixture
async def lane_kinds(
    db_session: AsyncSession, seeded_zas_users: list[User]
) -> dict[str, PathwayLaneKind]:
    """Seed the four canonical lane kinds. Tests recreate the schema via
    `Base.metadata.create_all`, which skips `op.execute` seeds — so re-seed."""

    del seeded_zas_users
    rows = {
        code: PathwayLaneKind(id=uuid.uuid4(), code=code, label=label)
        for code, label in SEEDED_LANE_KINDS
    }
    db_session.add_all(rows.values())
    await db_session.commit()
    return rows


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
