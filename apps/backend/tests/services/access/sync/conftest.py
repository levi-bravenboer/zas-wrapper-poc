from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.care_team import CareTeam
from app.db.models.patient import Patient
from app.db.models.user import User
from scripts.seed_care_teams import seed_care_teams
from scripts.seed_organisations import seed_organisations
from scripts.seed_patients import seed_patients


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe tenant-scoped tables around every authz sync test."""


@pytest.fixture
async def seeded_domain(
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
