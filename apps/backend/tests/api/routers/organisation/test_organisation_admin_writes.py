from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.models.user import User
from scripts.seed_organisations import (
    ORTHO_DEPT_ORG_ID,
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
        "/auth/login/password", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


_TYPE_PROV = {
    "system": "http://terminology.hl7.org/CodeSystem/organization-type",
    "code": "prov",
    "display": "Healthcare Provider",
}


async def test_create_root_organisation(async_client: AsyncClient, seeded_zas_orgs: list) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.post(
        "/organisations",
        json={"name": "Acme Care", "type": _TYPE_PROV, "parent_organisation_id": None},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Acme Care"
    assert body["parent_organisation_id"] is None
    assert body["type_code"] == "prov"


async def test_create_child_organisation(async_client: AsyncClient, seeded_zas_orgs: list) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.post(
        "/organisations",
        json={
            "name": "Cardiologie",
            "type": _TYPE_PROV,
            "parent_organisation_id": str(ZAS_ROOT_ORG_ID),
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["parent_organisation_id"] == str(ZAS_ROOT_ORG_ID)


async def test_create_rejects_cross_tenant_parent(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.post(
        "/organisations",
        json={"name": "Foo", "type": _TYPE_PROV, "parent_organisation_id": str(uuid4())},
    )

    assert response.status_code in (403, 404)


async def test_create_rejects_caregiver_caller(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.post(
        "/organisations",
        json={"name": "Foo", "type": _TYPE_PROV, "parent_organisation_id": None},
    )

    assert response.status_code == 403


async def test_update_organisation_renames(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.patch(
        f"/organisations/{ZAS_ROOT_ORG_ID}", json={"name": "Zas Hospital BV"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Zas Hospital BV"


async def test_update_rejects_parent_organisation_id_in_body(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.patch(
        f"/organisations/{ZAS_ROOT_ORG_ID}",
        json={"parent_organisation_id": str(ORTHO_DEPT_ORG_ID)},
    )

    assert response.status_code == 422


async def test_delete_rejected_with_child_organisations(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.delete(f"/organisations/{ZAS_ROOT_ORG_ID}")

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "conflict.organisation.in_use"
    assert "organisations" in body["details"]["references"]


async def test_delete_succeeds_for_leaf_without_references(
    async_client: AsyncClient,
    seeded_zas_orgs: list,
    db_session,
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)

    create = await async_client.post(
        "/organisations",
        json={
            "name": "Leaf",
            "type": _TYPE_PROV,
            "parent_organisation_id": str(ZAS_ROOT_ORG_ID),
        },
    )
    leaf_id = create.json()["id"]

    response = await async_client.delete(f"/organisations/{leaf_id}")

    assert response.status_code == 204
    listing = await async_client.get("/organisations")
    ids = {row["id"] for row in listing.json()["items"]}
    assert leaf_id not in ids


async def test_delete_rejects_caregiver_caller(
    async_client: AsyncClient, seeded_zas_orgs: list
) -> None:
    del seeded_zas_orgs
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.delete(f"/organisations/{ZAS_ROOT_ORG_ID}")

    assert response.status_code == 403
