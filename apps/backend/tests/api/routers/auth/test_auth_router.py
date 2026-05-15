from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings
from app.db.models.user import User
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def test_login_sets_session_cookie(
    async_client: AsyncClient, settings: Settings, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    response = await async_client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": _DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == ADMIN_EMAIL
    assert body["role"] == "admin"
    assert response.cookies.get(settings.session_cookie_name)


async def test_login_rejects_wrong_password(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    response = await async_client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}
    )

    assert response.status_code == 401
    assert response.json()["code"] == "security.auth.invalid_credentials"


async def test_login_rejects_unknown_email(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    response = await async_client.post(
        "/auth/login", json={"email": "ghost@zas.local", "password": _DEFAULT_PASSWORD}
    )

    assert response.status_code == 401


async def test_me_returns_current_user_after_login(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await async_client.post(
        "/auth/login", json={"email": CAREGIVER_EMAIL, "password": _DEFAULT_PASSWORD}
    )

    response = await async_client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == CAREGIVER_EMAIL


async def test_me_without_cookie_returns_401(async_client: AsyncClient) -> None:
    response = await async_client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "security.auth.unauthenticated"


async def test_me_rejects_tampered_cookie(
    async_client: AsyncClient, settings: Settings, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    async_client.cookies.set(settings.session_cookie_name, "not-a-real-token")

    response = await async_client.get("/auth/me")

    assert response.status_code == 401


async def test_me_rejects_deactivated_user(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    admin = next(u for u in seeded_zas_users if u.email == ADMIN_EMAIL)
    await async_client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": _DEFAULT_PASSWORD}
    )

    db_admin = await db_session.merge(admin)
    db_admin.is_active = False
    await db_session.commit()

    response = await async_client.get("/auth/me")
    assert response.status_code == 401


async def test_logout_clears_session_cookie(
    async_client: AsyncClient, settings: Settings, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await async_client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": _DEFAULT_PASSWORD}
    )

    response = await async_client.post("/auth/logout")

    assert response.status_code == 204
    async_client.cookies.clear()
    assert (await async_client.get("/auth/me")).status_code == 401
