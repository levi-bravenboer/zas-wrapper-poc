from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.tenant import Tenant
from app.db.models.user import User
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


async def test_list_users_requires_admin_role(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.get("/users")

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden.auth.role"


async def test_list_users_returns_tenant_rows_for_admin(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get("/users")

    assert response.status_code == 200
    emails = sorted(row["email"] for row in response.json())
    assert ADMIN_EMAIL in emails
    assert CAREGIVER_EMAIL in emails


async def test_list_users_without_cookie_returns_401(
    async_client: AsyncClient,
) -> None:
    response = await async_client.get("/users")

    assert response.status_code == 401


async def test_update_role_changes_target(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.patch(
        f"/users/{caregiver.id}/role", json={"role": Role.ADMIN.value}
    )

    assert response.status_code == 200
    assert response.json()["role"] == Role.ADMIN.value


async def test_update_role_rejects_caregiver_caller(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.patch(
        f"/users/{caregiver.id}/role", json={"role": Role.ADMIN.value}
    )

    assert response.status_code == 403


async def test_update_role_rejects_cross_tenant_target(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    del seeded_zas_users
    other = Tenant(id=uuid.uuid4(), slug="other", name="OTHER")
    db_session.add(other)
    await db_session.flush()
    other_user_id = uuid.uuid4()
    other_user = User(
        id=other_user_id,
        tenant_id=other.id,
        created_by=other_user_id,
        updated_by=other_user_id,
        email="alien@other.local",
        password_hash="hash",
        display_name="Alien",
        role=Role.CAREGIVER,
        is_active=True,
    )
    db_session.add(other_user)
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.patch(
        f"/users/{other_user.id}/role", json={"role": Role.ADMIN.value}
    )

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden.user.cross_tenant"


async def test_update_role_returns_404_for_missing_target(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.patch(
        f"/users/{uuid.uuid4()}/role", json={"role": Role.ADMIN.value}
    )

    assert response.status_code == 404


async def test_update_role_self_demotion_locks_out_admin_actions(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    admin = next(u for u in seeded_zas_users if u.email == ADMIN_EMAIL)
    await _login(async_client, ADMIN_EMAIL)

    demote = await async_client.patch(
        f"/users/{admin.id}/role", json={"role": Role.CAREGIVER.value}
    )
    assert demote.status_code == 200

    response = await async_client.get("/users")
    assert response.status_code == 403
