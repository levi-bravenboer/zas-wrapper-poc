from __future__ import annotations

import inspect

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.practitioner_role import practitioner_role_router
from app.db.models.practitioner import Practitioner
from scripts.seed_organisations import ORTHO_DEPT_ORG_ID, RUGREVAL_TEAM_ORG_ID
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password",
        json={"email": email, "password": _DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text


# ---- open + list ---------------------------------------------------------


async def test_admin_opens_role(
    async_client: AsyncClient,
    seeded_caregiver_practitioner: Practitioner,
) -> None:
    practitioner = seeded_caregiver_practitioner
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.post(
        "/practitioner-roles",
        json={
            "practitioner_id": str(practitioner.id),
            "organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "code": "nurse",
            "is_primary": True,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["is_primary"] is True
    assert body["period_end"] is None


async def test_list_filters_by_practitioner(
    async_client: AsyncClient,
    seeded_caregiver_practitioner: Practitioner,
) -> None:
    practitioner = seeded_caregiver_practitioner
    await _login(async_client, ADMIN_EMAIL)
    await async_client.post(
        "/practitioner-roles",
        json={
            "practitioner_id": str(practitioner.id),
            "organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "code": "nurse",
            "is_primary": True,
        },
    )
    response = await async_client.get(
        "/practitioner-roles",
        params={"practitioner_id": str(practitioner.id), "is_open": "true"},
    )
    assert response.status_code == 200, response.text
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["practitioner_id"] == str(practitioner.id)


# ---- primary demotion ----------------------------------------------------


async def test_opening_primary_demotes_existing_primary(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_caregiver_practitioner: Practitioner,
) -> None:
    practitioner = seeded_caregiver_practitioner
    await _login(async_client, ADMIN_EMAIL)
    first = await async_client.post(
        "/practitioner-roles",
        json={
            "practitioner_id": str(practitioner.id),
            "organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "code": "nurse",
            "is_primary": True,
        },
    )
    assert first.status_code == 201
    second = await async_client.post(
        "/practitioner-roles",
        json={
            "practitioner_id": str(practitioner.id),
            "organisation_id": str(ORTHO_DEPT_ORG_ID),
            "code": "nurse",
            "is_primary": True,
        },
    )
    assert second.status_code == 201, second.text

    db_session.expunge_all()
    response = await async_client.get(
        "/practitioner-roles",
        params={"practitioner_id": str(practitioner.id), "is_open": "true"},
    )
    rows = response.json()
    primaries = [r for r in rows if r["is_primary"]]
    assert len(primaries) == 1
    assert primaries[0]["organisation_id"] == str(ORTHO_DEPT_ORG_ID)


async def test_duplicate_open_at_same_org_rejected(
    async_client: AsyncClient,
    seeded_caregiver_practitioner: Practitioner,
) -> None:
    practitioner = seeded_caregiver_practitioner
    await _login(async_client, ADMIN_EMAIL)
    body = {
        "practitioner_id": str(practitioner.id),
        "organisation_id": str(RUGREVAL_TEAM_ORG_ID),
        "code": "nurse",
    }
    first = await async_client.post("/practitioner-roles", json=body)
    assert first.status_code == 201
    second = await async_client.post("/practitioner-roles", json=body)
    assert second.status_code == 409


# ---- close ---------------------------------------------------------------


async def test_close_role_sets_period_end_and_drops_primary(
    async_client: AsyncClient,
    seeded_caregiver_practitioner: Practitioner,
) -> None:
    practitioner = seeded_caregiver_practitioner
    await _login(async_client, ADMIN_EMAIL)
    opened = await async_client.post(
        "/practitioner-roles",
        json={
            "practitioner_id": str(practitioner.id),
            "organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "code": "nurse",
            "is_primary": True,
        },
    )
    role_id = opened.json()["id"]
    response = await async_client.delete(f"/practitioner-roles/{role_id}")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["period_end"] is not None
    assert body["is_primary"] is False


# ---- authz ---------------------------------------------------------------


async def test_promoting_closed_role_to_primary_rejected(
    async_client: AsyncClient,
    seeded_caregiver_practitioner: Practitioner,
) -> None:
    practitioner = seeded_caregiver_practitioner
    await _login(async_client, ADMIN_EMAIL)
    opened = await async_client.post(
        "/practitioner-roles",
        json={
            "practitioner_id": str(practitioner.id),
            "organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "code": "nurse",
            "is_primary": False,
        },
    )
    role_id = opened.json()["id"]
    closed = await async_client.delete(f"/practitioner-roles/{role_id}")
    assert closed.status_code == 200
    response = await async_client.patch(
        f"/practitioner-roles/{role_id}",
        json={"is_primary": True},
    )
    assert response.status_code == 409


async def test_update_rejects_period_end_field(
    async_client: AsyncClient,
    seeded_caregiver_practitioner: Practitioner,
) -> None:
    practitioner = seeded_caregiver_practitioner
    await _login(async_client, ADMIN_EMAIL)
    opened = await async_client.post(
        "/practitioner-roles",
        json={
            "practitioner_id": str(practitioner.id),
            "organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "code": "nurse",
        },
    )
    role_id = opened.json()["id"]
    response = await async_client.patch(
        f"/practitioner-roles/{role_id}",
        json={"period_end": None},
    )
    assert response.status_code == 422


async def test_caregiver_write_rejected(
    async_client: AsyncClient,
    seeded_caregiver_practitioner: Practitioner,
) -> None:
    practitioner = seeded_caregiver_practitioner
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.post(
        "/practitioner-roles",
        json={
            "practitioner_id": str(practitioner.id),
            "organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "code": "nurse",
        },
    )
    assert response.status_code == 403


def test_practitioner_role_router_marks_auth_harden() -> None:
    src = inspect.getsource(practitioner_role_router)
    assert "AUTH-HARDEN" in src
