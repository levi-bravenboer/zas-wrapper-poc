from __future__ import annotations

import inspect
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.practitioner import practitioner_router
from app.core.enums import Permission
from app.db.models.practitioner import Practitioner
from app.db.models.user import User
from scripts.seed_roles import DEFAULT_ROLE_SLUG
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL
from tests._rbac import grant_to_role

_DEFAULT_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password",
        json={"email": email, "password": _DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text


async def _caregiver(db_session: AsyncSession) -> User:
    return (
        (await db_session.execute(select(User).where(User.email == CAREGIVER_EMAIL)))
        .scalars()
        .one()
    )


# ---- create ---------------------------------------------------------------


async def test_admin_creates_practitioner_for_caregiver(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_orgs: list[User],
) -> None:
    del seeded_zas_orgs
    caregiver = await _caregiver(db_session)
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.post(
        "/practitioners",
        json={
            "user_id": str(caregiver.id),
            "given_name": "Demo",
            "family_name": "Caregiver",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user_id"] == str(caregiver.id)
    assert body["given_name"] == "Demo"
    assert body["roles"] == []


async def test_practitioner_create_rejects_duplicate(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_orgs: list[User],
) -> None:
    del seeded_zas_orgs
    caregiver = await _caregiver(db_session)
    await _login(async_client, ADMIN_EMAIL)
    body = {
        "user_id": str(caregiver.id),
        "given_name": "Demo",
        "family_name": "Caregiver",
    }
    first = await async_client.post("/practitioners", json=body)
    assert first.status_code == 201
    second = await async_client.post("/practitioners", json=body)
    assert second.status_code == 409


async def test_practitioner_create_rejects_admin_target(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_orgs: list[User],
) -> None:
    del seeded_zas_orgs
    admin = (
        (await db_session.execute(select(User).where(User.email == ADMIN_EMAIL))).scalars().one()
    )
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.post(
        "/practitioners",
        json={
            "user_id": str(admin.id),
            "given_name": "Wrong",
            "family_name": "Person",
        },
    )
    assert response.status_code == 422


async def test_practitioner_create_rejects_caregiver_actor(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_orgs: list[User],
) -> None:
    del seeded_zas_orgs
    caregiver = await _caregiver(db_session)
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.post(
        "/practitioners",
        json={
            "user_id": str(caregiver.id),
            "given_name": "X",
            "family_name": "Y",
        },
    )
    assert response.status_code == 403


# ---- get / update ---------------------------------------------------------


async def test_caregiver_can_read_own_practitioner(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_orgs: list[User],
) -> None:
    del seeded_zas_orgs
    caregiver = await _caregiver(db_session)
    admin = (
        (await db_session.execute(select(User).where(User.email == ADMIN_EMAIL))).scalars().one()
    )
    db_session.add(
        Practitioner(
            tenant_id=caregiver.tenant_id,
            created_by=admin.id,
            updated_by=admin.id,
            user_id=caregiver.id,
            given_name="Demo",
            family_name="Caregiver",
        )
    )
    await db_session.commit()
    # Caregiver self-read is permission-gated (practitionerRole.read); grant it
    # to the default role to simulate a configured caregiver.
    await grant_to_role(
        db_session, role_slug=DEFAULT_ROLE_SLUG, permission=Permission.PRACTITIONER_ROLE_READ
    )
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(f"/practitioners/{caregiver.id}")
    assert response.status_code == 200, response.text
    assert response.json()["user_id"] == str(caregiver.id)


async def test_practitioner_get_missing_returns_404(
    async_client: AsyncClient,
    seeded_zas_orgs: list[User],
) -> None:
    del seeded_zas_orgs
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(f"/practitioners/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_admin_updates_practitioner(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_orgs: list[User],
) -> None:
    del seeded_zas_orgs
    caregiver = await _caregiver(db_session)
    admin = (
        (await db_session.execute(select(User).where(User.email == ADMIN_EMAIL))).scalars().one()
    )
    db_session.add(
        Practitioner(
            tenant_id=caregiver.tenant_id,
            created_by=admin.id,
            updated_by=admin.id,
            user_id=caregiver.id,
            given_name="Demo",
            family_name="Caregiver",
        )
    )
    await db_session.commit()
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.patch(
        f"/practitioners/{caregiver.id}",
        json={"qualification": "MD"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["qualification"] == "MD"


# ---- source ---------------------------------------------------------------


def test_practitioner_router_marks_auth_harden() -> None:
    src = inspect.getsource(practitioner_router)
    assert "AUTH-HARDEN" in src
