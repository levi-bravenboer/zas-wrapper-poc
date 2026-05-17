from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.models.user import User
from scripts.seed_organisations import (
    ORTHO_DEPT_ORG_ID,
    RUGREVAL_TEAM_ORG_ID,
    ZAS_ROOT_ORG_ID,
    seed_organisations,
)
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"
_PATH = "/admin/organisations/tree"


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
        "/auth/login/password", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


async def test_patch_reorders_siblings(async_client: AsyncClient, seeded_zas_orgs: list) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.patch(
        _PATH,
        json={
            "moves": [
                {
                    "id": str(ORTHO_DEPT_ORG_ID),
                    "parent_organisation_id": str(ZAS_ROOT_ORG_ID),
                    "sort_index": 5,
                }
            ]
        },
    )

    assert response.status_code == 200, response.text
    items = response.json()["items"]
    ortho = next(o for o in items if o["id"] == str(ORTHO_DEPT_ORG_ID))
    assert ortho["sort_index"] == 5
    assert ortho["parent_organisation_id"] == str(ZAS_ROOT_ORG_ID)


async def test_patch_rejects_cycle(async_client: AsyncClient, seeded_zas_orgs: list) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    # Make the root the child of its own grandchild → cycle.
    response = await async_client.patch(
        _PATH,
        json={
            "moves": [
                {
                    "id": str(ZAS_ROOT_ORG_ID),
                    "parent_organisation_id": str(RUGREVAL_TEAM_ORG_ID),
                    "sort_index": 0,
                }
            ]
        },
    )

    assert response.status_code == 409
    assert response.json()["code"] == "organisation_tree_cycle"


async def test_patch_rejects_cross_tenant_parent(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.patch(
        _PATH,
        json={
            "moves": [
                {
                    "id": str(ORTHO_DEPT_ORG_ID),
                    "parent_organisation_id": str(uuid4()),
                    "sort_index": 0,
                }
            ]
        },
    )

    assert response.status_code in (403, 404)


async def test_patch_rejects_caregiver(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.patch(
        _PATH,
        json={
            "moves": [
                {
                    "id": str(ORTHO_DEPT_ORG_ID),
                    "parent_organisation_id": str(ZAS_ROOT_ORG_ID),
                    "sort_index": 0,
                }
            ]
        },
    )

    assert response.status_code == 403


async def test_patch_unauthenticated_returns_401(async_client: AsyncClient) -> None:
    response = await async_client.patch(
        _PATH,
        json={
            "moves": [
                {
                    "id": str(uuid4()),
                    "parent_organisation_id": None,
                    "sort_index": 0,
                }
            ]
        },
    )

    assert response.status_code == 401


async def test_patch_empty_moves_returns_422(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.patch(_PATH, json={"moves": []})
    assert response.status_code == 422


async def test_patch_oversized_moves_returns_422(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    moves = [
        {"id": str(uuid4()), "parent_organisation_id": None, "sort_index": i}
        for i in range(501)
    ]
    response = await async_client.patch(_PATH, json={"moves": moves})
    assert response.status_code == 422
