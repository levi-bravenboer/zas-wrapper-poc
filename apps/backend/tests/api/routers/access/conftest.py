from __future__ import annotations

from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings
from app.db.models.care_team import CareTeam
from app.db.models.patient import Patient
from app.db.models.user import User
from scripts.seed_care_teams import seed_care_teams
from scripts.seed_organisations import seed_organisations
from scripts.seed_patients import seed_patients
from scripts.seed_practitioners import seed_practitioners
from tests._settings import build_settings
from tests.conftest import TEST_DATABASE_URL


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe tenant-scoped tables around every access-router test."""


@pytest.fixture(autouse=True)
def _keto_enabled_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """The outbox before_flush hook reads the lru-cached global
    `get_settings()` (not the per-app override), so route tests that rely
    on outbox rows must flip the env-backed flag too."""

    from app.core.settings import get_settings

    monkeypatch.setenv("BACKEND_AUTHZ_KETO_ENABLED", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def settings() -> Settings:
    """These routes are exercised with relation checks ON."""

    return build_settings(
        session_secret_key=SecretStr("test-secret"),
        database_url=TEST_DATABASE_URL,
        authz_keto_enabled=True,
    )


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def seeded_access_domain(
    db_session: AsyncSession, seeded_zas_users: list[User]
) -> tuple[list[Patient], list[CareTeam]]:
    """Users + orgs + practitioners + patients + care teams."""

    del seeded_zas_users
    await seed_organisations(db_session)
    await db_session.commit()
    await seed_practitioners(db_session)
    await db_session.commit()
    patients = await seed_patients(db_session)
    await db_session.commit()
    care_teams = await seed_care_teams(db_session)
    await db_session.commit()
    return patients, care_teams
