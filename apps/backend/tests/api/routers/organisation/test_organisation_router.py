from __future__ import annotations

import inspect
from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.routers.organisation import organisation_router
from app.db.models.user import User
from scripts.seed_organisations import (
    ORTHO_DEPT_ORG_ID,
    RUGREVAL_TEAM_ORG_ID,
    ZAS_ROOT_ORG_ID,
    seed_organisations,
)
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def seeded_zas_orgs(db_session, seeded_zas_users: list[User]) -> list:
    del seeded_zas_users
    orgs = await seed_organisations(db_session)
    await db_session.commit()
    return orgs


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


async def test_list_organisations_returns_tenant_tree(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get("/organisations")

    assert response.status_code == 200
    ids = {row["id"] for row in response.json()["items"]}
    assert {str(ZAS_ROOT_ORG_ID), str(ORTHO_DEPT_ORG_ID), str(RUGREVAL_TEAM_ORG_ID)} <= ids


async def test_list_organisations_allows_caregiver(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.get("/organisations")

    assert response.status_code == 200


async def test_list_organisations_without_cookie_returns_401(
    async_client: AsyncClient,
) -> None:
    response = await async_client.get("/organisations")

    assert response.status_code == 401


def test_router_source_marks_auth_harden() -> None:
    src = inspect.getsource(organisation_router)
    assert "AUTH-HARDEN" in src
