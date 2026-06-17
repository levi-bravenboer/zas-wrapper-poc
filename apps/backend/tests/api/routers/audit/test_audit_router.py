from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

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


async def test_requires_admin_role(async_client: AsyncClient, seeded_zas_users: list[User]) -> None:
    del seeded_zas_users
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.get("/audit-events")

    assert response.status_code == 403


async def test_admin_lists_audit_events(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get("/audit-events")

    assert response.status_code == 200
    body = response.json()
    assert "items" in body and "total" in body


async def test_admin_login_is_recorded_and_filterable(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get(
        "/audit-events",
        params={"filter[event_code][eq]": "auth.login", "filter[result][eq]": "success"},
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert items, "admin login should have produced an auth.login/success audit event"
    # login now writes FHIR `action=execute` + `event_code=auth.login` (legacy
    # `login` action deprecated); outcome stays the orthogonal `result`.
    assert all(item["event_code"] == "auth.login" for item in items)
    assert all(item["action"] == "execute" for item in items)
    assert all(item["result"] == "success" for item in items)


def test_audit_events_has_no_write_operations(app: FastAPI) -> None:
    methods = set(app.openapi()["paths"]["/audit-events"].keys())
    assert methods == {"get"}
