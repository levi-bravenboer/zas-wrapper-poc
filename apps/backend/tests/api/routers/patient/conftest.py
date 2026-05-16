from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.care_team import CareTeam
from app.db.models.patient import Patient
from app.db.models.user import User
from scripts.seed_care_teams import seed_care_teams
from scripts.seed_organisations import seed_organisations
from scripts.seed_patients import seed_patients


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe `patients` + `organisations` + `users` + `tenants` around every patient router test."""


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def seeded_zas_patients(
    db_session: AsyncSession, seeded_zas_users: list[User]
) -> list[Patient]:
    del seeded_zas_users
    await seed_organisations(db_session)
    await db_session.commit()
    patients = await seed_patients(db_session)
    await db_session.commit()
    return patients


@pytest.fixture
async def seeded_zas_care_teams(
    db_session: AsyncSession, seeded_zas_users: list[User]
) -> tuple[list[Patient], list[CareTeam]]:
    del seeded_zas_users
    await seed_organisations(db_session)
    await db_session.commit()
    patients = await seed_patients(db_session)
    await db_session.commit()
    care_teams = await seed_care_teams(db_session)
    await db_session.commit()
    return patients, care_teams
