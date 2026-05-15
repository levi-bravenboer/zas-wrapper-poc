from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from scripts.seed_tenant import seed_zas_tenant
from scripts.seed_users import (
    ADMIN_PASSWORD_ENV,
    CAREGIVER_PASSWORD_ENV,
    seed_users,
)


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def test_production_without_env_refuses(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("BACKEND_ENV", "production")
    monkeypatch.delenv(ADMIN_PASSWORD_ENV, raising=False)
    monkeypatch.delenv(CAREGIVER_PASSWORD_ENV, raising=False)
    await seed_zas_tenant(db_session)
    await db_session.commit()

    with pytest.raises(RuntimeError, match=ADMIN_PASSWORD_ENV):
        await seed_users(db_session)


async def test_production_with_env_succeeds(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("BACKEND_ENV", "production")
    monkeypatch.setenv(ADMIN_PASSWORD_ENV, "adm1n-strong")
    monkeypatch.setenv(CAREGIVER_PASSWORD_ENV, "careg1ver-strong")
    monkeypatch.setenv("BACKEND_SESSION_SECRET_KEY", "production-secret-not-default")
    await seed_zas_tenant(db_session)
    await db_session.commit()

    users = await seed_users(db_session)
    await db_session.commit()
    assert len(users) == 2


async def test_non_production_without_env_uses_fallback(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("BACKEND_ENV", "dev")
    monkeypatch.delenv(ADMIN_PASSWORD_ENV, raising=False)
    monkeypatch.delenv(CAREGIVER_PASSWORD_ENV, raising=False)
    await seed_zas_tenant(db_session)
    await db_session.commit()

    users = await seed_users(db_session)
    await db_session.commit()
    assert len(users) == 2
