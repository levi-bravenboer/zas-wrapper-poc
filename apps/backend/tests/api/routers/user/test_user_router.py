from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.practitioner.practitioner import Practitioner
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
    body = response.json()
    assert body["page"] == 1
    assert body["page_size"] == 25
    emails = sorted(row["email"] for row in body["items"])
    assert ADMIN_EMAIL in emails
    assert CAREGIVER_EMAIL in emails
    assert body["total"] == len(body["items"])


async def test_list_users_filters_by_is_active(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    caregiver.is_active = False
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/users", params={"filter[is_active]": "false"})

    assert response.status_code == 200
    body = response.json()
    emails = {row["email"] for row in body["items"]}
    assert CAREGIVER_EMAIL in emails
    assert ADMIN_EMAIL not in emails


async def test_list_users_filters_by_role_in(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get(
        "/users",
        params=[("filter[role]", Role.ADMIN.value), ("filter[role]", Role.CAREGIVER.value)],
    )

    assert response.status_code == 200
    roles = {row["role"] for row in response.json()["items"]}
    assert roles == {Role.ADMIN.value, Role.CAREGIVER.value}


async def test_list_users_search_matches_email_or_display_name(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    admin = next(u for u in seeded_zas_users if u.email == ADMIN_EMAIL)
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get("/users", params={"q": admin.email.split("@")[0]})

    assert response.status_code == 200
    emails = [row["email"] for row in response.json()["items"]]
    assert ADMIN_EMAIL in emails


async def test_list_users_sort_by_email_asc(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get("/users", params={"order_by": "email", "order": "asc"})

    assert response.status_code == 200
    emails = [row["email"] for row in response.json()["items"]]
    assert emails == sorted(emails)


async def test_list_users_has_practitioner_true_returns_only_users_with_practitioner(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    admin = next(u for u in seeded_zas_users if u.email == ADMIN_EMAIL)
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    db_session.add(
        Practitioner(
            tenant_id=caregiver.tenant_id,
            created_by=admin.id,
            updated_by=admin.id,
            user_id=caregiver.id,
            given_name="Test",
            family_name="Caregiver",
        )
    )
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/users", params={"filter[has_practitioner]": "true"})

    assert response.status_code == 200
    emails = {row["email"] for row in response.json()["items"]}
    assert CAREGIVER_EMAIL in emails
    assert ADMIN_EMAIL not in emails


async def test_list_users_has_practitioner_false_excludes_users_with_practitioner(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    admin = next(u for u in seeded_zas_users if u.email == ADMIN_EMAIL)
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    db_session.add(
        Practitioner(
            tenant_id=caregiver.tenant_id,
            created_by=admin.id,
            updated_by=admin.id,
            user_id=caregiver.id,
            given_name="Test",
            family_name="Caregiver",
        )
    )
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/users", params={"filter[has_practitioner]": "false"})

    assert response.status_code == 200
    emails = {row["email"] for row in response.json()["items"]}
    assert ADMIN_EMAIL in emails
    assert CAREGIVER_EMAIL not in emails


async def test_list_users_rejects_unknown_filter(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get("/users", params={"filter[bogus]": "x"})

    assert response.status_code == 422


async def test_list_users_without_cookie_returns_401(
    async_client: AsyncClient,
) -> None:
    response = await async_client.get("/users")

    assert response.status_code == 401


async def test_list_users_is_tenant_scoped(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    del seeded_zas_users
    other = Tenant(id=uuid.uuid4(), slug="other-list", name="OTHER")
    db_session.add(other)
    await db_session.flush()
    alien_id = uuid.uuid4()
    db_session.add(
        User(
            id=alien_id,
            tenant_id=other.id,
            created_by=alien_id,
            updated_by=alien_id,
            email="alien@other.local",
            password_hash="hash",
            display_name="Alien",
            role=Role.CAREGIVER,
            is_active=True,
        )
    )
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/users")

    assert response.status_code == 200
    emails = {row["email"] for row in response.json()["items"]}
    assert "alien@other.local" not in emails


async def test_get_user_returns_detail(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get(f"/users/{caregiver.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == CAREGIVER_EMAIL
    assert "updated_at" in body
    assert "external_idp" in body


async def test_get_user_rejects_caregiver_caller(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.get(f"/users/{caregiver.id}")

    assert response.status_code == 403


async def test_get_user_returns_404_for_missing_target(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.get(f"/users/{uuid.uuid4()}")

    assert response.status_code == 404


async def test_get_user_rejects_cross_tenant(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    del seeded_zas_users
    other = Tenant(id=uuid.uuid4(), slug="other-detail", name="OTHER")
    db_session.add(other)
    await db_session.flush()
    alien_id = uuid.uuid4()
    alien = User(
        id=alien_id,
        tenant_id=other.id,
        created_by=alien_id,
        updated_by=alien_id,
        email="alien@other.local",
        password_hash="hash",
        display_name="Alien",
        role=Role.CAREGIVER,
        is_active=True,
    )
    db_session.add(alien)
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(f"/users/{alien.id}")

    assert response.status_code == 403


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


async def test_set_user_active_toggles(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    await _login(async_client, ADMIN_EMAIL)

    deactivate = await async_client.patch(
        f"/users/{caregiver.id}/active", json={"is_active": False}
    )
    assert deactivate.status_code == 200
    assert deactivate.json()["is_active"] is False

    reactivate = await async_client.patch(f"/users/{caregiver.id}/active", json={"is_active": True})
    assert reactivate.status_code == 200
    assert reactivate.json()["is_active"] is True


async def test_set_user_active_rejects_caregiver_caller(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.patch(f"/users/{caregiver.id}/active", json={"is_active": False})
    assert response.status_code == 403


async def test_create_user_admin_branch(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.post(
        "/users",
        json={
            "email": "new.admin@zas.local",
            "role": Role.ADMIN.value,
            "display_name": "New Admin",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new.admin@zas.local"
    assert body["display_name"] == "New Admin"
    assert body["role"] == Role.ADMIN.value


async def test_create_user_caregiver_materialises_practitioner(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.post(
        "/users",
        json={
            "email": "new.care@zas.local",
            "role": Role.CAREGIVER.value,
            "given_name": "Eva",
            "family_name": "Bos",
            "qualification": "Verpleegkundige",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new.care@zas.local"
    assert body["display_name"] == "Eva Bos"

    practitioner = await async_client.get(f"/practitioners/{body['id']}")
    assert practitioner.status_code == 200, practitioner.text
    pbody = practitioner.json()
    assert pbody["given_name"] == "Eva"
    assert pbody["family_name"] == "Bos"
    assert pbody["qualification"] == "Verpleegkundige"


async def test_create_user_rejects_mixed_branch_payload(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.post(
        "/users",
        json={
            "email": "mixed@zas.local",
            "role": Role.ADMIN.value,
            "display_name": "Mixed",
            "given_name": "Should",
            "family_name": "Fail",
        },
    )

    assert response.status_code == 422


async def test_create_user_rejects_duplicate_email(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.post(
        "/users",
        json={
            "email": ADMIN_EMAIL,
            "role": Role.ADMIN.value,
            "display_name": "Dup",
        },
    )

    assert response.status_code == 409
    assert response.json()["code"] == "conflict.user.email_exists"


async def test_create_user_rejects_caregiver_caller(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    del seeded_zas_users
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.post(
        "/users",
        json={
            "email": "denied@zas.local",
            "role": Role.ADMIN.value,
            "display_name": "Denied",
        },
    )

    assert response.status_code == 403


async def test_update_user_demographics(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    await _login(async_client, ADMIN_EMAIL)

    response = await async_client.patch(
        f"/users/{caregiver.id}",
        json={"display_name": "Renamed Caregiver"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["display_name"] == "Renamed Caregiver"


async def test_update_user_rejects_cross_tenant(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    del seeded_zas_users
    other = Tenant(id=uuid.uuid4(), slug="other-update", name="OTHER")
    db_session.add(other)
    await db_session.flush()
    alien_id = uuid.uuid4()
    alien = User(
        id=alien_id,
        tenant_id=other.id,
        created_by=alien_id,
        updated_by=alien_id,
        email="alien@other.local",
        password_hash="hash",
        display_name="Alien",
        role=Role.CAREGIVER,
        is_active=True,
    )
    db_session.add(alien)
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.patch(f"/users/{alien.id}", json={"display_name": "Hack"})

    assert response.status_code == 403
    assert response.json()["code"] == "forbidden.user.cross_tenant"


async def test_update_user_rejects_caregiver_caller(
    async_client: AsyncClient, seeded_zas_users: list[User]
) -> None:
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.patch(f"/users/{caregiver.id}", json={"display_name": "Hack"})

    assert response.status_code == 403


async def test_set_user_active_rejects_cross_tenant(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_users: list[User],
) -> None:
    del seeded_zas_users
    other = Tenant(id=uuid.uuid4(), slug="other-active", name="OTHER")
    db_session.add(other)
    await db_session.flush()
    alien_id = uuid.uuid4()
    alien = User(
        id=alien_id,
        tenant_id=other.id,
        created_by=alien_id,
        updated_by=alien_id,
        email="alien@other.local",
        password_hash="hash",
        display_name="Alien",
        role=Role.CAREGIVER,
        is_active=True,
    )
    db_session.add(alien)
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.patch(f"/users/{alien.id}/active", json={"is_active": False})
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden.user.cross_tenant"
