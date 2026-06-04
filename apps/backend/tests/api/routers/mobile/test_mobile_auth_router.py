from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import CAREGIVER_EMAIL
from tests.api.routers.mobile.conftest import (
    PATIENT_EMAIL,
    PATIENT_PASSWORD,
    SeededPatientLogin,
)

_DEFAULT_CAREGIVER_PASSWORD = "changeme"


async def test_mobile_login_password_returns_patient_session_and_cookie(
    async_client: AsyncClient,
    settings: Settings,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    response = await async_client.post(
        "/mobile/auth/login/password",
        json={
            "tenant": ZAS_TENANT_SLUG,
            "email": PATIENT_EMAIL,
            "password": PATIENT_PASSWORD,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body["session"].keys()) == {"id", "given_name", "patient_id", "tenant_id"}
    assert body["session"]["id"] == str(seeded_zas_patient_user.user.id)
    assert body["session"]["patient_id"] == str(seeded_zas_patient_user.patient.id)
    assert body["session"]["given_name"] == seeded_zas_patient_user.patient.given_name
    assert body["session"]["tenant_id"] == str(seeded_zas_patient_user.user.tenant_id)
    assert response.cookies.get(settings.session_cookie_name)


async def test_mobile_login_rejects_wrong_password(
    async_client: AsyncClient,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    del seeded_zas_patient_user
    response = await async_client.post(
        "/mobile/auth/login/password",
        json={
            "tenant": ZAS_TENANT_SLUG,
            "email": PATIENT_EMAIL,
            "password": "wrong-pass",
        },
    )

    assert response.status_code == 401
    assert response.json()["code"] == "security.auth.invalid_credentials"


async def test_mobile_login_rejects_caregiver_email(
    async_client: AsyncClient,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    """Mobile route filters role == patient. Caregiver credentials must
    fail with the same generic 401 a wrong password would yield."""
    del seeded_zas_patient_user
    response = await async_client.post(
        "/mobile/auth/login/password",
        json={
            "tenant": ZAS_TENANT_SLUG,
            "email": CAREGIVER_EMAIL,
            "password": _DEFAULT_CAREGIVER_PASSWORD,
        },
    )

    assert response.status_code == 401
    assert response.json()["code"] == "security.auth.invalid_credentials"


async def test_mobile_login_rejects_unknown_tenant(
    async_client: AsyncClient,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    del seeded_zas_patient_user
    response = await async_client.post(
        "/mobile/auth/login/password",
        json={
            "tenant": "ghost-clinic",
            "email": PATIENT_EMAIL,
            "password": PATIENT_PASSWORD,
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "security.auth.unknown_tenant"


async def test_mobile_login_rejects_inactive_user(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    user = await db_session.merge(seeded_zas_patient_user.user)
    user.is_active = False
    await db_session.commit()

    response = await async_client.post(
        "/mobile/auth/login/password",
        json={
            "tenant": ZAS_TENANT_SLUG,
            "email": PATIENT_EMAIL,
            "password": PATIENT_PASSWORD,
        },
    )

    assert response.status_code == 401


async def test_mobile_me_returns_patient_session_after_login(
    async_client: AsyncClient,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    await async_client.post(
        "/mobile/auth/login/password",
        json={
            "tenant": ZAS_TENANT_SLUG,
            "email": PATIENT_EMAIL,
            "password": PATIENT_PASSWORD,
        },
    )

    response = await async_client.get("/mobile/auth/me")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(seeded_zas_patient_user.user.id)
    assert body["patient_id"] == str(seeded_zas_patient_user.patient.id)
    assert body["given_name"] == seeded_zas_patient_user.patient.given_name
    assert "family_name" not in body
    assert "role" not in body


async def test_mobile_me_without_cookie_returns_401(
    async_client: AsyncClient,
) -> None:
    response = await async_client.get("/mobile/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "security.auth.unauthenticated"


async def test_mobile_me_rejects_caregiver_session(
    async_client: AsyncClient,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    """Caregiver who logs in via `/auth/login/password` must not be able
    to query `/mobile/auth/me`."""
    del seeded_zas_patient_user
    await async_client.post(
        "/auth/login/password",
        json={"email": CAREGIVER_EMAIL, "password": _DEFAULT_CAREGIVER_PASSWORD},
    )

    response = await async_client.get("/mobile/auth/me")

    assert response.status_code == 401


async def test_caregiver_login_rejects_patient_user(
    async_client: AsyncClient,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    """Caregiver route filters role != patient. A patient user must get
    the same generic 401 a wrong password would yield."""
    del seeded_zas_patient_user
    response = await async_client.post(
        "/auth/login/password",
        json={"email": PATIENT_EMAIL, "password": PATIENT_PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "security.auth.invalid_credentials"


async def test_logout_clears_mobile_issued_cookie(
    async_client: AsyncClient,
    settings: Settings,
    seeded_zas_patient_user: SeededPatientLogin,
) -> None:
    """Mobile-issued cookie is cleared by the shared POST /auth/logout."""
    del seeded_zas_patient_user
    await async_client.post(
        "/mobile/auth/login/password",
        json={
            "tenant": ZAS_TENANT_SLUG,
            "email": PATIENT_EMAIL,
            "password": PATIENT_PASSWORD,
        },
    )
    assert async_client.cookies.get(settings.session_cookie_name)

    response = await async_client.post("/auth/logout")

    assert response.status_code == 204
    async_client.cookies.clear()
    assert (await async_client.get("/mobile/auth/me")).status_code == 401


@pytest.mark.parametrize("path", ["/mobile/auth/login/password"])
async def test_mobile_login_validates_request_body(
    async_client: AsyncClient,
    path: str,
) -> None:
    response = await async_client.post(path, json={"email": PATIENT_EMAIL})
    assert response.status_code == 422
