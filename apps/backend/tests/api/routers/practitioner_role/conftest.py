from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.practitioner import Practitioner
from app.db.models.user import User
from scripts.seed_organisations import seed_organisations
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None: ...


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def seeded_caregiver_practitioner(
    db_session: AsyncSession, seeded_zas_users: list[User]
) -> Practitioner:
    """Tenant + bootstrap users + org tree + a Practitioner row for the caregiver.

    No `PractitionerRole` rows yet — tests drive the role lifecycle through
    the router itself.
    """

    del seeded_zas_users
    await seed_organisations(db_session)
    await db_session.commit()
    caregiver = (
        (await db_session.execute(select(User).where(User.email == CAREGIVER_EMAIL)))
        .scalars()
        .one()
    )
    admin = (
        (await db_session.execute(select(User).where(User.email == ADMIN_EMAIL))).scalars().one()
    )
    practitioner = Practitioner(
        tenant_id=caregiver.tenant_id,
        created_by=admin.id,
        updated_by=admin.id,
        user_id=caregiver.id,
        given_name="Demo",
        family_name="Caregiver",
    )
    db_session.add(practitioner)
    await db_session.commit()
    await db_session.refresh(practitioner)
    return practitioner
