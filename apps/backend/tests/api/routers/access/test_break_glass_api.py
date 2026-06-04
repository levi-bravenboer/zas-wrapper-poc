"""Break-glass route tests (REQ-NON-8): grant → access → revoke/expiry,
reason + duration validation, admin oversight."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.care_team import CareTeam
from app.db.models.patient import Patient
from app.db.models.user import User
from app.services.access.identity.password import PasswordHasher
from app.services.access.sync.reconciler import reconcile_all
from app.services.access.sync.relay import process_pending
from scripts.seed_users import ADMIN_EMAIL, ADMIN_USER_ID
from tests.fakes.keto import FakeKetoClient

_PASSWORD = "changeme"
SeededDomain = tuple[list[Patient], list[CareTeam]]


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _PASSWORD}
    )
    assert response.status_code == 200, response.text


async def _seed_substitute(db_session: AsyncSession, tenant_id: object) -> User:
    user = User(
        tenant_id=tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
        email="substitute@zas.local",
        password_hash=PasswordHasher().hash(_PASSWORD),
        display_name="Substitute",
        role=Role.CAREGIVER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def test_break_glass_grant_unlocks_patient(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_access_domain
    target = patients[0]
    await _seed_substitute(db_session, target.tenant_id)
    await reconcile_all(db_session, fake_keto)

    await _login(async_client, "substitute@zas.local")
    # no relation yet → existence hidden
    assert (await async_client.get(f"/patients/{target.id}")).status_code == 404

    response = await async_client.post(
        f"/patients/{target.id}/access-grants",
        json={"reason": "vervanging spoeddienst", "hours": 2},
    )
    assert response.status_code == 201, response.text
    # the grant's outbox row rides the same transaction; drain the relay
    await process_pending(db_session, fake_keto)

    assert (await async_client.get(f"/patients/{target.id}")).status_code == 200


async def test_break_glass_validation(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_access_domain
    target = patients[0]
    await _seed_substitute(db_session, target.tenant_id)
    await _login(async_client, "substitute@zas.local")

    whitespace = await async_client.post(
        f"/patients/{target.id}/access-grants", json={"reason": "   ", "hours": 1}
    )
    assert whitespace.status_code == 422

    over_cap = await async_client.post(
        f"/patients/{target.id}/access-grants",
        json={"reason": "vervanging", "hours": 99},
    )
    assert over_cap.status_code == 422
    assert over_cap.json()["code"] == "invalid.access_grant.duration_exceeds_cap"


async def test_admin_lists_and_revokes_grants(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_access_domain
    target = patients[0]
    await _seed_substitute(db_session, target.tenant_id)
    await reconcile_all(db_session, fake_keto)

    await _login(async_client, "substitute@zas.local")
    created = await async_client.post(
        f"/patients/{target.id}/access-grants",
        json={"reason": "vervanging spoeddienst", "hours": 2},
    )
    assert created.status_code == 201
    grant_id = created.json()["id"]
    await process_pending(db_session, fake_keto)

    await _login(async_client, ADMIN_EMAIL)
    listed = await async_client.get("/admin/access-grants?active=true")
    assert listed.status_code == 200
    grants = listed.json()
    assert [g["id"] for g in grants] == [grant_id]
    assert grants[0]["reason"] == "vervanging spoeddienst"

    revoked = await async_client.post(f"/admin/access-grants/{grant_id}/revoke")
    assert revoked.status_code == 200
    await process_pending(db_session, fake_keto)

    await _login(async_client, "substitute@zas.local")
    assert (await async_client.get(f"/patients/{target.id}")).status_code == 404
